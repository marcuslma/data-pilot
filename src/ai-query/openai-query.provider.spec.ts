import { vi } from 'vitest';
import { OpenAiQueryProvider } from './openai-query.provider.js';

describe('OpenAiQueryProvider', () => {
  it('returns a structured SQL planned query from a structured model response', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        queries: [
          {
            sourceId: 'source_1',
            query: { language: 'sql', text: 'SELECT 1' },
          },
        ],
        unavailableReason: '',
      }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'gpt-5-nano',
      'high',
    );

    await expect(
      provider.plan({
        question: 'conte os registros',
        sources: [
          {
            sourceId: 'source_1',
            kind: 'postgres',
            catalog: { kind: 'postgres', namespaces: [] },
          },
        ],
      }),
    ).resolves.toEqual({
      queries: [
        {
          sourceId: 'source_1',
          query: { language: 'sql', text: 'SELECT 1' },
        },
      ],
      unavailableReason: '',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-nano',
        reasoning: { effort: 'high' },
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: 'json_schema',
            strict: true,
            schema: expect.objectContaining({
              properties: expect.objectContaining({
                queries: expect.objectContaining({
                  items: expect.objectContaining({
                    properties: expect.objectContaining({
                      sourceId: expect.objectContaining({
                        enum: ['source_1'],
                      }),
                      query: expect.objectContaining({
                        properties: expect.objectContaining({
                          language: expect.objectContaining({
                            enum: ['sql'],
                          }),
                          text: { type: 'string' },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('sends the complete tolerant PostgreSQL text-matching policy to the query planner', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        queries: [
          {
            sourceId: 'source_1',
            query: { language: 'sql', text: 'SELECT 1' },
          },
        ],
        unavailableReason: '',
      }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'gpt-5-nano',
      'medium',
    );

    await provider.plan({
      question: 'Qual o número do poskémon pikachu, mewtwo e charizard?',
      sources: [
        {
          sourceId: 'source_1',
          kind: 'postgres',
          catalog: { kind: 'postgres', namespaces: [] },
        },
      ],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringMatching(
          /use ILIKE with '%' wildcards instead\s+of case-sensitive = or IN comparisons/s,
        ),
      }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringMatching(
          /fallback fragment for each requested value\s+with OR or ILIKE ANY/s,
        ),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringMatching(
          /Do not use optional PostgreSQL extensions or functions such\s+as pg_trgm, similarity, levenshtein, or unaccent/s,
        ),
      }),
    );
  });

  it('returns a Portuguese answer from a structured synthesis response', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({ answer: 'Há 151 Pokémon em Kanto.' }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'gpt-5-nano',
      'medium',
    );

    await expect(
      provider.summarize({
        question: 'quantos Pokémon existem?',
        executions: [
          {
            sourceId: 'source_1',
            kind: 'postgres',
            rows: [{ total: 151 }],
            returnedCount: 1,
            truncatedForSummary: false,
          },
        ],
      }),
    ).resolves.toBe('Há 151 Pokémon em Kanto.');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-nano',
        reasoning: { effort: 'medium' },
        store: false,
      }),
    );
  });

  it('parses JSON fields from a structured MongoDB planned query', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        queries: [
          {
            sourceId: 'source_1',
            query: {
              language: 'mongo',
              operation: 'find',
              collection: 'planets',
              filterJson: '{"episodes":"V"}',
              projectionJson: '{}',
              sortJson: '{"name":1}',
              limit: null,
              pipelineJson: '[]',
            },
          },
        ],
        unavailableReason: '',
      }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'gpt-5-nano',
      'medium',
    );

    await expect(
      provider.plan({
        question: 'Quais planetas aparecem no Episódio V?',
        sources: [
          {
            sourceId: 'source_1',
            kind: 'mongodb',
            catalog: { kind: 'mongodb', namespaces: [] },
          },
        ],
      }),
    ).resolves.toEqual({
      queries: [
        {
          sourceId: 'source_1',
          query: {
            language: 'mongo',
            operation: 'find',
            collection: 'planets',
            filter: { episodes: 'V' },
            projection: {},
            sort: { name: 1 },
            pipeline: [],
          },
        },
      ],
      unavailableReason: '',
    });
  });

  it('rejects an invalid MongoDB sort direction from a model response', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        queries: [
          {
            sourceId: 'source_1',
            query: {
              language: 'mongo',
              operation: 'find',
              collection: 'planets',
              filterJson: '{}',
              projectionJson: '{}',
              sortJson: '{"name":2}',
              limit: null,
              pipelineJson: '[]',
            },
          },
        ],
        unavailableReason: '',
      }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'gpt-5-nano',
      'medium',
    );

    await expect(
      provider.plan({
        question: 'Liste os planetas.',
        sources: [
          {
            sourceId: 'source_1',
            kind: 'mongodb',
            catalog: { kind: 'mongodb', namespaces: [] },
          },
        ],
      }),
    ).rejects.toThrow('AI provider returned an invalid response.');
  });

  it('forbids planned queries when no catalog is supplied', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        queries: [],
        unavailableReason: 'Não há fontes disponíveis.',
      }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'gpt-5-nano',
      'medium',
    );

    await provider.plan({ question: 'teste', sources: [] });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.objectContaining({
          format: expect.objectContaining({
            schema: expect.objectContaining({
              properties: expect.objectContaining({
                queries: expect.objectContaining({ maxItems: 0 }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('hides provider failures', async () => {
    const create = vi.fn(async () => {
      throw new Error('provider failure with secret detail');
    });
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'gpt-5-nano',
      'medium',
    );

    const operation = provider.plan({ question: 'teste', sources: [] });

    await expect(operation).rejects.toThrow('AI provider request failed.');
    await expect(operation).rejects.not.toThrow('secret detail');
  });
});
