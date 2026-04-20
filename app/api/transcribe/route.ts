import Groq, { toFile } from 'groq-sdk';

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-groq-api-key');
  if (!apiKey) {
    return Response.json({ error: 'Missing Groq API key' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const audioBlob = formData.get('audio') as Blob | null;
  const model = (formData.get('model') as string) || 'whisper-large-v3';

  if (!audioBlob || audioBlob.size === 0) {
    return Response.json({ error: 'No audio provided' }, { status: 400 });
  }

  const groq = new Groq({ apiKey });

  try {
    const file = await toFile(audioBlob, 'audio.webm', { type: audioBlob.type || 'audio/webm' });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model,
      response_format: 'json',
      language: 'en',
    });

    return Response.json({ text: transcription.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
