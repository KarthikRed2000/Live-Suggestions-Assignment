import Groq from 'groq-sdk';
import { CHAT_PROMPT, DETAILED_ANSWER_PROMPT } from '@/lib/prompts';

interface ChatPayload {
  message: string;
  transcript: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
  suggestion?: { type: string; title: string; preview: string } | null;
  model?: string;
  chatPrompt?: string;
  detailedAnswerPrompt?: string;
}

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-groq-api-key');
  if (!apiKey) {
    return Response.json({ error: 'Missing Groq API key' }, { status: 401 });
  }

  const body: ChatPayload = await request.json();
  const {
    message,
    transcript,
    chatHistory = [],
    suggestion,
    model,
    chatPrompt: customChatPrompt,
    detailedAnswerPrompt: customDetailedPrompt,
  } = body;

  const groq = new Groq({ apiKey });

  let messages: { role: 'system' | 'user' | 'assistant'; content: string }[];

  if (suggestion) {
    // Clicked suggestion → focused detailed answer, no prior chat history needed
    const systemContent = (customDetailedPrompt || DETAILED_ANSWER_PROMPT)
      .replace('{{TRANSCRIPT}}', transcript || '')
      .replace('{{TYPE}}', suggestion.type)
      .replace('{{TITLE}}', suggestion.title)
      .replace('{{PREVIEW}}', suggestion.preview);

    messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: message },
    ];
  } else {
    // Regular chat → include full chat history
    const systemContent = (customChatPrompt || CHAT_PROMPT).replace(
      '{{TRANSCRIPT}}',
      transcript || '',
    );

    messages = [
      { role: 'system', content: systemContent },
      ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];
  }

  try {
    const stream = await groq.chat.completions.create({
      messages,
      model: model || 'openai/gpt-oss-120b',
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content ?? '';
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            }
          } finally {
            controller.close();
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat request failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
