import Groq from 'groq-sdk';
import { SUGGESTION_PROMPT } from '@/lib/prompts';

interface SuggestionPayload {
  recentTranscript: string;
  earlierContext?: string;
  prompt?: string;
  model?: string;
}

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-groq-api-key');
  if (!apiKey) {
    return Response.json({ error: 'Missing Groq API key' }, { status: 401 });
  }

  const body: SuggestionPayload = await request.json();
  const { recentTranscript, earlierContext, prompt: customPrompt, model } = body;

  const groq = new Groq({ apiKey });

  const promptTemplate = customPrompt || SUGGESTION_PROMPT;

  const contextBlock = earlierContext
    ? `<earlier_context>\n${earlierContext}\n</earlier_context>`
    : '';

  const promptContent = promptTemplate
    .replace('{{RECENT_TRANSCRIPT}}', recentTranscript || '(no transcript yet)')
    .replace('{{FULL_CONTEXT}}', contextBlock);

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: promptContent }],
      model: model || 'openai/gpt-oss-120b',
      temperature: 0.75,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    let responseText = completion.choices[0]?.message?.content ?? '{"suggestions":[]}';

    // Strip markdown fences the model sometimes adds despite json_object mode
    responseText = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return Response.json({ suggestions: [] });
    }

    // Accept both {"suggestions":[...]} and a bare array [...] at the root
    const raw: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>)?.suggestions)
        ? ((parsed as Record<string, unknown>).suggestions as unknown[])
        : [];

    // Validate shape and take exactly 3
    const suggestions = raw
      .filter(
        (s): s is { type: string; title: string; preview: string } =>
          typeof s === 'object' &&
          s !== null &&
          'type' in s &&
          'title' in s &&
          'preview' in s,
      )
      .slice(0, 3);

    return Response.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate suggestions';
    return Response.json({ error: message }, { status: 500 });
  }
}
