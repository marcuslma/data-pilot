import { z } from 'zod';

const sourceKinds = ['postgres', 'mongodb'] as const;

export const sourceSchema = z
  .strictObject({
    kind: z.enum(sourceKinds),
    connectionUrl: z.string().min(1),
  })
  .superRefine((source, context) => {
    const protocol = protocolFor(source.connectionUrl);
    const matches =
      (source.kind === 'postgres' &&
        ['postgres:', 'postgresql:'].includes(protocol)) ||
      (source.kind === 'mongodb' &&
        ['mongodb:', 'mongodb+srv:'].includes(protocol));

    if (!matches) {
      context.addIssue({
        code: 'custom',
        path: ['connectionUrl'],
        message: 'Connection URL does not match the source kind.',
      });
    }
  });

export const catalogRequestSchema = z.strictObject({ source: sourceSchema });
export const queryRequestSchema = z.strictObject({
  source: sourceSchema,
  query: z.record(z.string(), z.unknown()),
});

export type Source = z.infer<typeof sourceSchema>;
export type CatalogRequest = z.infer<typeof catalogRequestSchema>;
export type QueryRequest = z.infer<typeof queryRequestSchema>;

function protocolFor(value: string): string {
  try {
    return new URL(value).protocol;
  } catch {
    return '';
  }
}
