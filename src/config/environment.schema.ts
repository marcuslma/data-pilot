import { z } from 'zod';
import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_REASONING_EFFORT,
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORTS,
} from '../ai-query/openai-configuration.js';

const MAX_PORT = 65_535;

const positiveSafeInteger = z
  .coerce.number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, 'Must be a positive safe integer.');

export const environmentSchema = z
  .object({
    NODE_ENV: z.preprocess(
      normalizeRequiredString,
      z.enum(['development', 'test', 'production']),
    ),
    OPENAI_API_KEY: z.string().trim().min(1),
    PORT: z.preprocess(
      normalizeOptionalString,
      z.coerce.number().int().min(1).max(MAX_PORT).default(3000),
    ),
    OPENAI_MODEL: z.preprocess(
      normalizeOptionalString,
      z.enum(OPENAI_MODELS).default(DEFAULT_OPENAI_MODEL),
    ),
    OPENAI_REASONING_EFFORT: z.preprocess(
      normalizeOptionalString,
      z
        .enum(OPENAI_REASONING_EFFORTS)
        .default(DEFAULT_OPENAI_REASONING_EFFORT),
    ),
    MAX_ASK_SOURCES: optionalPositiveSafeInteger(10),
    MAX_ASK_SUMMARY_ROWS_PER_EXECUTION: optionalPositiveSafeInteger(100),
    MAX_ASK_SUMMARY_CONTENT_CHARS: optionalPositiveSafeInteger(50_000),
    OBSERVE_APP_KEY: z.preprocess(
      normalizeOptionalString,
      z.string().min(1).optional(),
    ),
    OBSERVE_APP_SECRET: z.preprocess(
      normalizeOptionalString,
      z.string().min(1).optional(),
    ),
    OBSERVE_SERVICE_ID: optionalStringWithDefault('data-pilot'),
  })
  .superRefine((configuration, context) => {
    const hasAppKey = configuration.OBSERVE_APP_KEY !== undefined;
    const hasAppSecret = configuration.OBSERVE_APP_SECRET !== undefined;

    if (hasAppKey === hasAppSecret) {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasAppKey ? 'OBSERVE_APP_SECRET' : 'OBSERVE_APP_KEY'],
      message: 'OBSERVE_APP_KEY and OBSERVE_APP_SECRET must be set together.',
    });
  });

export type EnvironmentConfiguration = z.output<typeof environmentSchema>;

function optionalPositiveSafeInteger(defaultValue: number) {
  return z.preprocess(
    normalizeOptionalString,
    positiveSafeInteger.default(defaultValue),
  );
}

function optionalStringWithDefault(defaultValue: string) {
  return z.preprocess(
    normalizeOptionalString,
    z.string().min(1).default(defaultValue),
  );
}

function normalizeRequiredString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptionalString(value: unknown): unknown {
  const normalized = normalizeRequiredString(value);

  return normalized === '' ? undefined : normalized;
}
