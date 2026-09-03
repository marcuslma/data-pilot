import { z } from 'zod';
import { sourceSchema } from '../data-sources/data-source.schemas.js';

const MAX_SOURCES = 10;
const MAX_RELATIONSHIPS = 100;
const sourceIdSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);

const namedSourceSchema = z.strictObject({
  sourceId: sourceIdSchema,
  source: sourceSchema,
});

const namedSourcesSchema = z
  .array(namedSourceSchema)
  .min(2)
  .max(MAX_SOURCES)
  .superRefine((sources, context) => {
    const sourceIds = new Set<string>();

    sources.forEach((source, index) => {
      if (sourceIds.has(source.sourceId)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'sourceId'],
          message: 'Source IDs must be unique.',
        });
      }

      sourceIds.add(source.sourceId);
    });
  });

const endpointSchema = z.strictObject({
  sourceId: sourceIdSchema,
  namespace: z.string().trim().min(1).max(256),
  entity: z.string().trim().min(1).max(256),
  field: z.string().trim().min(1).max(512),
});

const relationshipDefinitionSchema = z.strictObject({
  left: endpointSchema,
  right: endpointSchema,
  operator: z.literal('equals'),
  cardinality: z.enum([
    'one-to-one',
    'one-to-many',
    'many-to-one',
    'many-to-many',
  ]),
  joinType: z.enum(['inner', 'left']),
});

export const relationshipSuggestionsRequestSchema = z.strictObject({
  sources: namedSourcesSchema,
});

export const relationshipValidationRequestSchema = z.strictObject({
  sources: namedSourcesSchema,
  relationships: z.array(relationshipDefinitionSchema).max(MAX_RELATIONSHIPS),
});

export type RelationshipSuggestionsRequest = z.infer<
  typeof relationshipSuggestionsRequestSchema
>;
export type RelationshipValidationRequest = z.infer<
  typeof relationshipValidationRequestSchema
>;
