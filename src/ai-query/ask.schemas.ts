import { z } from 'zod';
import { sourceSchema } from '../data-sources/data-source.schemas.js';

export const askRequestSchema = z.strictObject({
  question: z.string().min(1).max(2_000),
  sources: z.array(sourceSchema).min(1),
});

export type AskRequest = z.infer<typeof askRequestSchema>;
