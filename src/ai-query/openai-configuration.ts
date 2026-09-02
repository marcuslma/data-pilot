export const OPENAI_MODELS = [
  'gpt-5-nano',
  'gpt-5.6-luna',
  'gpt-5.6-terra',
  'gpt-5.6-sol',
] as const;

export const OPENAI_REASONING_EFFORTS = [
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type OpenAiModel = (typeof OPENAI_MODELS)[number];
export type OpenAiReasoningEffort =
  (typeof OPENAI_REASONING_EFFORTS)[number];

export interface OpenAiConfiguration {
  apiKey: string;
  model: OpenAiModel;
  reasoningEffort: OpenAiReasoningEffort;
}

export const DEFAULT_OPENAI_MODEL: OpenAiModel = 'gpt-5-nano';
export const DEFAULT_OPENAI_REASONING_EFFORT: OpenAiReasoningEffort = 'medium';
