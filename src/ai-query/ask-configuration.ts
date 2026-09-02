import type { AskConfiguration } from './ai-query.types.js';

const DEFAULT_MAX_SOURCES = 10;
const DEFAULT_MAX_SUMMARY_ROWS_PER_EXECUTION = 100;
const DEFAULT_MAX_SUMMARY_CONTENT_CHARS = 50_000;

export function createAskConfiguration(
  environment: Record<string, string | undefined>,
): AskConfiguration {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = environment.OPENAI_MODEL?.trim();

  return {
    maxSources: parsePositiveInteger(
      environment.MAX_ASK_SOURCES,
      'MAX_ASK_SOURCES',
      DEFAULT_MAX_SOURCES,
    ),
    maxSummaryRowsPerExecution: parsePositiveInteger(
      environment.MAX_ASK_SUMMARY_ROWS_PER_EXECUTION,
      'MAX_ASK_SUMMARY_ROWS_PER_EXECUTION',
      DEFAULT_MAX_SUMMARY_ROWS_PER_EXECUTION,
    ),
    maxSummaryContentChars: parsePositiveInteger(
      environment.MAX_ASK_SUMMARY_CONTENT_CHARS,
      'MAX_ASK_SUMMARY_CONTENT_CHARS',
      DEFAULT_MAX_SUMMARY_CONTENT_CHARS,
    ),
    openAi: apiKey && model ? { apiKey, model } : undefined,
  };
}

function parsePositiveInteger(
  value: string | undefined,
  name: string,
  defaultValue: number,
): number {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}
