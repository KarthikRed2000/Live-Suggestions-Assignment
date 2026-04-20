import { SUGGESTION_PROMPT, DETAILED_ANSWER_PROMPT, CHAT_PROMPT } from './prompts';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  groqApiKey: '',
  suggestionModel: 'openai/gpt-oss-120b',
  transcriptionModel: 'whisper-large-v3',
  suggestionPrompt: SUGGESTION_PROMPT,
  detailedAnswerPrompt: DETAILED_ANSWER_PROMPT,
  chatPrompt: CHAT_PROMPT,
  // ~3 minutes of speech at ~150 words/min ≈ 3000 chars
  suggestionContextWindow: 3000,
  // Larger window for detailed answers — more context = better answers
  detailedAnswerContextWindow: 10000,
};

export const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  ANSWER: 'ANSWER',
  QUESTION_TO_ASK: 'QUESTION TO ASK',
  FACT_CHECK: 'FACT CHECK',
  TALKING_POINT: 'TALKING POINT',
  CLARIFY: 'CLARIFY',
};

// Inline style objects — avoids Tailwind purging dynamic class names at build time
export const SUGGESTION_TYPE_COLORS: Record<
  string,
  { background: string; color: string; border: string }
> = {
  ANSWER:         { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.35)' },  // emerald
  QUESTION_TO_ASK:{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)' },  // blue
  FACT_CHECK:     { background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.35)' },  // orange
  TALKING_POINT:  { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.35)' },  // violet
  CLARIFY:        { background: 'rgba(6,182,212,0.15)',  color: '#22d3ee', border: '1px solid rgba(6,182,212,0.35)' },   // cyan
};
