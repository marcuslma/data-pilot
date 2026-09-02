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

const DEFAULT_OPENAI_MODEL: OpenAiModel = 'gpt-5-nano';
const DEFAULT_OPENAI_REASONING_EFFORT: OpenAiReasoningEffort = 'medium';

export function createOpenAiConfiguration(
  environment: Record<string, string | undefined>,
): OpenAiConfiguration | undefined {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = parseOpenAiModel(environment.OPENAI_MODEL);
  const reasoningEffort = parseOpenAiReasoningEffort(
    environment.OPENAI_REASONING_EFFORT,
  );

  return apiKey ? { apiKey, model, reasoningEffort } : undefined;
}

function parseOpenAiModel(value: string | undefined): OpenAiModel {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_OPENAI_MODEL;
  }

  const model = value.trim();

  if (isOpenAiModel(model)) {
    return model;
  }

  throw new Error(
    `OPENAI_MODEL must be one of: ${OPENAI_MODELS.join(', ')}.`,
  );
}

function isOpenAiModel(value: string): value is OpenAiModel {
  return OPENAI_MODELS.some((model) => model === value);
}

function parseOpenAiReasoningEffort(
  value: string | undefined,
): OpenAiReasoningEffort {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_OPENAI_REASONING_EFFORT;
  }

  const effort = value.trim();

  if (isOpenAiReasoningEffort(effort)) {
    return effort;
  }

  throw new Error(
    `OPENAI_REASONING_EFFORT must be one of: ${OPENAI_REASONING_EFFORTS.join(', ')}.`,
  );
}

function isOpenAiReasoningEffort(
  value: string,
): value is OpenAiReasoningEffort {
  return OPENAI_REASONING_EFFORTS.some((effort) => effort === value);
}
