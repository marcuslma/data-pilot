import {
  catalogRequestSchema,
  queryRequestSchema,
  sourceSchema,
} from './data-source.schemas.js';

describe('data-source Zod schemas', () => {
  it.each([
    ['postgres', 'postgresql://localhost/test'],
    ['postgres', 'postgres://localhost/test'],
    ['mongodb', 'mongodb://localhost/test'],
    ['mongodb', 'mongodb+srv://cluster.example/test'],
  ])('accepts a matching %s connection URL', (kind, connectionUrl) => {
    expect(sourceSchema.safeParse({ kind, connectionUrl }).success).toBe(true);
  });

  it('rejects a URL whose protocol does not match the source kind', () => {
    const result = sourceSchema.safeParse({
      kind: 'postgres',
      connectionUrl: 'mongodb://localhost/test',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed connection URL', () => {
    expect(
      sourceSchema.safeParse({
        kind: 'postgres',
        connectionUrl: 'not-a-url',
      }).success,
    ).toBe(false);
  });

  it('rejects unexpected nested source fields', () => {
    expect(
      catalogRequestSchema.safeParse({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
          extra: true,
        },
      }).success,
    ).toBe(false);
  });

  it('requires a query object rather than null', () => {
    expect(
      queryRequestSchema.safeParse({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
        query: null,
      }).success,
    ).toBe(false);
  });

  it('rejects unexpected top-level request fields', () => {
    expect(
      catalogRequestSchema.safeParse({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
        extra: true,
      }).success,
    ).toBe(false);
  });
});
