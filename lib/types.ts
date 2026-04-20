export type SuggestionType =
  | 'ANSWER'
  | 'QUESTION_TO_ASK'
  | 'FACT_CHECK'
  | 'TALKING_POINT'
  | 'CLARIFY';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  preview: string;
  timestamp: number;
}

export interface SuggestionBatch {
  id: string;
  suggestions: Suggestion[];
  timestamp: number;
}

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestionContext?: {
    type: SuggestionType;
    title: string;
    preview: string;
  };
}

export interface Settings {
  groqApiKey: string;
  suggestionModel: string;
  transcriptionModel: string;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
  suggestionContextWindow: number;
  detailedAnswerContextWindow: number;
}
