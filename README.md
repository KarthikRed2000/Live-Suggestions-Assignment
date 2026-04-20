# TwinMind Live Suggestions

An AI meeting copilot that listens to your microphone, transcribes speech in real time, and surfaces 3 contextually relevant suggestions every ~30 seconds. Click any suggestion for a detailed answer. Ask follow-up questions in the chat.

**Live demo:** https://live-suggestions-assignment.vercel.app/

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · Groq SDK  
**Models:** Whisper Large V3 (transcription) · GPT-OSS 120B (`openai/gpt-oss-120b`) (suggestions + chat)

---

## Setup

### Prerequisites

- Node.js 18+
- A Groq API key from [console.groq.com](https://console.groq.com)

### Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Settings**, paste your Groq API key, and save.

### Deploy to Vercel

```bash
npx vercel
```

No environment variables needed — the API key is entered by the user at runtime and sent per-request. This matches the assignment spec and keeps the deploy zero-config.

---

## Architecture

```
app/
  page.tsx               — Orchestration: state, recording flow, suggestion/chat dispatch
  components/
    TranscriptPanel.tsx  — Left column: mic button, transcript display
    SuggestionsPanel.tsx — Middle column: suggestion batches, refresh button
    ChatPanel.tsx        — Right column: streaming chat with suggestion context
    SettingsModal.tsx    — Tabbed settings: API key, models, prompts, context windows
  api/
    transcribe/route.ts  — POST audio → Groq Whisper → text
    suggestions/route.ts — POST transcript context → GPT-OSS 120B → 3 suggestions (JSON)
    chat/route.ts        — POST message + context → GPT-OSS 120B → streaming response
hooks/
  useAudioRecorder.ts    — MediaRecorder management: 30s chunk windows, flush on demand
lib/
  types.ts               — TypeScript interfaces
  prompts.ts             — Default prompts with template placeholders
  constants.ts           — Default settings values and suggestion type styles
```

### Data flow

1. `useAudioRecorder` records in 30-second windows by stopping and restarting `MediaRecorder`. Each stop produces a complete, independently decodable WebM file — avoiding the partial-header problem of `timeslice`.
2. Each chunk is posted to `/api/transcribe` (Groq Whisper). The returned text is appended to the transcript.
3. After each transcription, `/api/suggestions` is called with the last `suggestionContextWindow` characters of transcript (default 3 000 chars ≈ 2–3 minutes). This returns 3 suggestions.
4. Clicking a suggestion posts to `/api/chat` with the full suggestion context and the `detailedAnswerPrompt`. The response streams token-by-token.
5. Manual **Refresh** flushes the active recording chunk early (stops → transcribes → restarts), then regenerates suggestions.
6. The **Export** button downloads a JSON file with full transcript, all suggestion batches (with timestamps), and the complete chat history.

### API key handling

The key is stored in `localStorage` and sent as `x-groq-api-key` on every API route call. API routes are thin proxies — they read the header, create a per-request Groq client, and forward to Groq. No server-side key storage.

---

## Prompt strategy

All prompts live in `lib/prompts.ts` and are fully editable in the Settings → Prompts tab.

### Live suggestions (`SUGGESTION_PROMPT`)

**Goal:** Surface the 3 most immediately useful things in the last 60–90 seconds of conversation.

**Key decisions:**

- **Five suggestion types** — ANSWER, QUESTION, FACT, COUNTER, CLARIFY — cover the different ways a copilot can add value in a meeting. Varying the types across a batch prevents the model from defaulting to all questions or all facts.
- **Recency bias** — the prompt explicitly asks the model to focus on the last 60–90 seconds. Older context is sent in a separate `<earlier_context>` block so the model has background without anchoring to stale topics.
- **Standalone preview value** — the prompt rules require previews to contain actual information, not "click to learn more" teasers. This means a user can skim the suggestions panel and still extract value without opening chat.
- **JSON output** — `response_format: { type: "json_object" }` with a `{"suggestions":[...]}` envelope ensures reliable structured output from GPT-OSS 120B.
- **Temperature 0.75** — slightly creative to avoid repetitive suggestion patterns across batches, but grounded enough to stay relevant.

### Detailed answers (`DETAILED_ANSWER_PROMPT`)

When a suggestion is clicked, a focused prompt is used instead of the regular chat prompt. This gives the model the full suggestion context (type, title, preview) alongside the transcript, producing a more targeted 150–300 word answer than a general chat response would. No prior chat history is included — this keeps the answer focused on the suggestion rather than pulled off-topic by earlier conversation.

### Chat (`CHAT_PROMPT`)

Minimal prompt: the model gets the transcript as context and the full chat history. Temperature 0.7. The model is told to reference specific things from the conversation when answering, which keeps it grounded without over-constraining it for general knowledge questions.

### Context windows

| Setting | Default | Rationale |
|---|---|---|
| `suggestionContextWindow` | 3 000 chars | ~2–3 min of speech; keeps suggestions timely |
| `detailedAnswerContextWindow` | 10 000 chars | More context → better detailed answers |

Both are editable in Settings → Advanced with a slider.

---

## Tradeoffs

**MediaRecorder stop/restart vs timeslice:** Using `timeslice` is simpler but produces partial WebM chunks that Whisper cannot decode independently. Stop/restart gives complete WebM files per chunk at the cost of a tiny gap in recording between windows (imperceptible in practice).

**Client-side API key vs env variable:** The assignment requires users to paste their own key, so env-based secrets don't apply. The key is never logged server-side and only lives in `localStorage` + request headers.

**No streaming for suggestions:** Suggestions are returned as a single JSON object. Streaming partial JSON is complex to parse reliably; the latency (~1–2s on GPT-OSS 120B at 500 tok/s) is acceptable for a 30s refresh cycle.

**Single chat model for both suggestions and chat:** GPT-OSS 120B is used for both, per the assignment spec. A smaller model (e.g. GPT-OSS 20B) could be used for suggestions to reduce latency, but this would require splitting the model config.
