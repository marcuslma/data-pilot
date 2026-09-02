import { ServiceUnavailableException } from '@nestjs/common';
import { vi } from 'vitest';
import { OpenAiQueryProvider } from './openai-query.provider.js';
import { UnconfiguredAiQueryProvider } from './unconfigured-ai-query.provider.js';

describe('OpenAiQueryProvider', () => {
  it('uses strict structured output without storing a planning response', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        queries: [
          {
            sourceId: 'source_1',
            nativeQueryJson: '{"language":"sql","text":"SELECT 1"}',
          },
        ],
        unavailableReason: '',
      }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'test-model',
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
          nativeQueryJson: '{"language":"sql","text":"SELECT 1"}',
        },
      ],
      unavailableReason: '',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: 'json_schema',
            strict: true,
          }),
        }),
      }),
    );
  });

  it('returns a Portuguese answer from a structured synthesis response', async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({ answer: 'Há 151 Pokémon em Kanto.' }),
    }));
    const provider = new OpenAiQueryProvider(
      { responses: { create } } as never,
      'test-model',
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
      'test-model',
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
      'test-model',
    );

    const operation = provider.plan({ question: 'teste', sources: [] });

    await expect(operation).rejects.toThrow('AI provider request failed.');
    await expect(operation).rejects.not.toThrow('secret detail');
  });
});

describe('UnconfiguredAiQueryProvider', () => {
  it('returns a generic 503 error when OpenAI is not configured', async () => {
    const provider = new UnconfiguredAiQueryProvider();

    await expect(provider.plan({ question: 'teste', sources: [] })).rejects.toThrow(
      new ServiceUnavailableException('AI query provider is not configured.'),
    );
  });
});
