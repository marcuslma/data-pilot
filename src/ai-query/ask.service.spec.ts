import {
  BadGatewayException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { vi } from 'vitest';
import { DataSourceService } from '../data-sources/data-source.service.js';
import type {
  DataSourceCatalog,
  NativeQuery,
  QueryResult,
} from '../data-sources/data-source.types.js';
import type {
  AiQueryProvider,
  AskConfiguration,
} from './ai-query.types.js';
import { AskService } from './ask.service.js';

const postgresCatalog: DataSourceCatalog = {
  kind: 'postgres',
  namespaces: [],
};

const postgresQuery: NativeQuery = {
  language: 'sql',
  text: 'SELECT count(*) AS total FROM pokemon',
};

const defaultResult: QueryResult = {
  kind: 'postgres',
  rows: [{ total: 151 }],
  returnedCount: 1,
};

const configuration: AskConfiguration = {
  maxSources: 10,
  maxSummaryRowsPerExecution: 100,
  maxSummaryContentChars: 50_000,
};

  const dataSource = {
    inspect: vi.fn(),
    validateSource: vi.fn(),
    validateNativeQuery: vi.fn(),
  execute: vi.fn(),
};
const provider = {
  plan: vi.fn(),
  summarize: vi.fn(),
};

describe('AskService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dataSource.inspect.mockResolvedValue(postgresCatalog);
    dataSource.validateSource.mockImplementation((source: unknown) => source);
    dataSource.validateNativeQuery.mockImplementation(
      (_kind: unknown, query: unknown) => query as NativeQuery,
    );
    dataSource.execute.mockResolvedValue(defaultResult);
    provider.plan.mockResolvedValue({
      queries: [
        {
          sourceId: 'source_1',
          query: postgresQuery,
        },
      ],
      unavailableReason: '',
    });
    provider.summarize.mockResolvedValue('Há 151 Pokémon em Kanto.');
  });

  it('sends only source IDs and catalogs to the provider', async () => {
    const response = await createService().ask({
      question: 'Quantos Pokémon existem em Kanto?',
      sources: [
        {
          kind: 'postgres',
          connectionUrl: 'postgresql://user:secret@private-host/pokemon',
        },
      ],
    });

    expect(provider.plan).toHaveBeenCalledWith({
      question: 'Quantos Pokémon existem em Kanto?',
      sources: [
        {
          sourceId: 'source_1',
          kind: 'postgres',
          catalog: postgresCatalog,
        },
      ],
    });
    expect(provider.summarize).toHaveBeenCalledWith({
      question: 'Quantos Pokémon existem em Kanto?',
      executions: [
        {
          sourceId: 'source_1',
          kind: 'postgres',
          rows: [{ total: 151 }],
          returnedCount: 1,
          truncatedForSummary: false,
        },
      ],
    });
    expect(JSON.stringify(provider.plan.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(provider.summarize.mock.calls)).not.toContain(
      'private-host',
    );
    expect(JSON.stringify(response)).not.toContain('postgresql://');
  });

  it('executes a structured planned query without parsing JSON text', async () => {
    provider.plan.mockResolvedValueOnce({
      queries: [{ sourceId: 'source_1', query: postgresQuery }],
      unavailableReason: '',
    });

    const response = await createService().ask(validRequest());

    expect(response).toEqual({
      answer: 'Há 151 Pokémon em Kanto.',
      executions: [
        {
          sourceId: 'source_1',
          kind: 'postgres',
          stage: 'execute',
          status: 'succeeded',
          query: postgresQuery,
          result: defaultResult,
          truncatedForSummary: false,
        },
      ],
    });
  });

  it('rejects an unknown planned source before executing any query', async () => {
    provider.plan.mockResolvedValue({
      queries: [
        {
          sourceId: 'source_404',
          query: postgresQuery,
        },
      ],
      unavailableReason: '',
    });

    await expect(createService().ask(validRequest())).rejects.toThrow(
      new BadGatewayException('AI provider returned an invalid query plan.'),
    );
    expect(dataSource.execute).not.toHaveBeenCalled();
  });

  it('rejects an invalid source before inspecting any source', async () => {
    dataSource.validateSource.mockImplementation((source: {
      kind: string;
      connectionUrl: string;
    }) => {
      if (source.connectionUrl.startsWith('mongodb:')) {
        throw new BadRequestException('Connection URL does not match the source kind.');
      }

      return source;
    });

    await expect(
      createService().ask({
        question: 'teste',
        sources: [
          {
            kind: 'postgres',
            connectionUrl: 'mongodb://localhost/not-postgres',
          },
        ],
      }),
    ).rejects.toThrow(
      new BadRequestException('Connection URL does not match the source kind.'),
    );
    expect(dataSource.inspect).not.toHaveBeenCalled();
  });

  it('rejects duplicate planned sources before executing any query', async () => {
    provider.plan.mockResolvedValue({
      queries: [
        {
          sourceId: 'source_1',
          query: postgresQuery,
        },
        {
          sourceId: 'source_1',
          query: postgresQuery,
        },
      ],
      unavailableReason: '',
    });

    await expect(createService().ask(validRequest())).rejects.toThrow(
      new BadGatewayException('AI provider returned an invalid query plan.'),
    );
    expect(dataSource.execute).not.toHaveBeenCalled();
  });

  it('rejects a native query rejected by the data-source validator before execution', async () => {
    dataSource.validateNativeQuery.mockImplementation(() => {
      throw new BadRequestException('Invalid native query.');
    });

    await expect(createService().ask(validRequest())).rejects.toThrow(
      new BadGatewayException('AI provider returned an invalid query plan.'),
    );
    expect(dataSource.execute).not.toHaveBeenCalled();
  });

  it('keeps a catalog failure while answering from a healthy source', async () => {
    dataSource.inspect.mockImplementation((source: { kind: string }) => {
      if (source.kind === 'mongodb') {
        throw new UnprocessableEntityException('connection secret');
      }

      return Promise.resolve(postgresCatalog);
    });

    const response = await createService().ask({
      question: 'Quantos Pokémon existem?',
      sources: [
        { kind: 'postgres', connectionUrl: 'postgresql://localhost/pokemon' },
        { kind: 'mongodb', connectionUrl: 'mongodb://localhost/starwars' },
      ],
    });

    expect(provider.plan).toHaveBeenCalledWith({
      question: 'Quantos Pokémon existem?',
      sources: [
        {
          sourceId: 'source_1',
          kind: 'postgres',
          catalog: postgresCatalog,
        },
      ],
    });
    expect(response.executions).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'source_2',
          kind: 'mongodb',
          stage: 'catalog',
          status: 'failed',
          error: 'Unable to access the MongoDB source.',
        },
      ]),
    );
    expect(response.answer).toBe('Há 151 Pokémon em Kanto.');
  });

  it('returns the unavailable reason without execution when the plan has no query', async () => {
    provider.plan.mockResolvedValue({
      queries: [],
      unavailableReason: 'Os catálogos disponíveis não contêm essa informação.',
    });

    await expect(createService().ask(validRequest())).resolves.toEqual({
      answer: 'Os catálogos disponíveis não contêm essa informação.',
      executions: [],
    });
    expect(dataSource.execute).not.toHaveBeenCalled();
    expect(provider.summarize).not.toHaveBeenCalled();
  });

  it('returns 422 when every planned execution fails', async () => {
    dataSource.execute.mockRejectedValue(
      new UnprocessableEntityException('connection secret'),
    );

    await expect(createService().ask(validRequest())).rejects.toThrow(
      new UnprocessableEntityException('Unable to execute any planned query.'),
    );
    expect(provider.summarize).not.toHaveBeenCalled();
  });

  it('limits rows sent to the provider while preserving the full response result', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({ index }));
    dataSource.execute.mockResolvedValue({
      kind: 'postgres',
      rows,
      returnedCount: 101,
    });

    const response = await createService().ask(validRequest());

    expect(provider.summarize).toHaveBeenCalledWith({
      question: 'Quantos Pokémon existem em Kanto?',
      executions: [
        {
          sourceId: 'source_1',
          kind: 'postgres',
          rows: rows.slice(0, 100),
          returnedCount: 101,
          truncatedForSummary: true,
        },
      ],
    });
    expect(response.executions).toEqual([
      {
        sourceId: 'source_1',
        kind: 'postgres',
        stage: 'execute',
        status: 'succeeded',
        query: postgresQuery,
        result: { kind: 'postgres', rows, returnedCount: 101 },
        truncatedForSummary: true,
      },
    ]);
  });

  it('rejects a request above the configured source limit', async () => {
    await expect(
      createService({ ...configuration, maxSources: 1 }).ask({
        question: 'teste',
        sources: [
          { kind: 'postgres', connectionUrl: 'postgresql://localhost/one' },
          { kind: 'postgres', connectionUrl: 'postgresql://localhost/two' },
        ],
      }),
    ).rejects.toThrow(new BadRequestException('Too many data sources.'));
    expect(dataSource.inspect).not.toHaveBeenCalled();
  });
});

function createService(configurationOverride = configuration): AskService {
  return new AskService(
    dataSource as unknown as DataSourceService,
    provider as unknown as AiQueryProvider,
    configurationOverride,
  );
}

function validRequest() {
  return {
    question: 'Quantos Pokémon existem em Kanto?',
    sources: [
      {
        kind: 'postgres' as const,
        connectionUrl: 'postgresql://localhost/pokemon',
      },
    ],
  };
}
