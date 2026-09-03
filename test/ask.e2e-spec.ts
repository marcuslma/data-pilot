import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { vi } from 'vitest';
import { configureApplication } from '../src/application.setup.js';
import { AppModule } from '../src/app.module.js';
import {
  AI_QUERY_PROVIDER,
  type AiQueryProvider,
} from '../src/ai-query/ai-query.types.js';
import type { DataSourceAdapter } from '../src/data-sources/data-source.adapter.js';
import { DataSourceRegistry } from '../src/data-sources/data-source.registry.js';

describe('AI query endpoint (e2e)', () => {
  let app: INestApplication<App>;

  const adapter: DataSourceAdapter = {
    kind: 'postgres',
    inspect: vi.fn(async () => ({ kind: 'postgres', namespaces: [] })),
    inspectDetailed: vi.fn(async () => ({
      catalog: { kind: 'postgres', namespaces: [] },
      fieldProfiles: [],
    })),
    execute: vi.fn(async () => ({
      kind: 'postgres',
      rows: [{ total: 151 }],
      returnedCount: 1,
    })),
  };
  const provider: AiQueryProvider = {
    plan: vi.fn(async () => ({
      queries: [
        {
          sourceId: 'source_1',
          query: { language: 'sql', text: 'SELECT 151 AS total' } as const,
        },
      ],
      unavailableReason: '',
    })),
    summarize: vi.fn(async () => 'Há 151 Pokémon em Kanto.'),
  };

  beforeEach(async () => {
    vi.mocked(adapter.inspect).mockClear();
    vi.mocked(adapter.execute).mockClear();
    vi.mocked(provider.plan).mockClear();
    vi.mocked(provider.summarize).mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSourceRegistry)
      .useValue({ get: () => adapter })
      .overrideProvider(AI_QUERY_PROVIDER)
      .useValue(provider)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  it('returns an answer and secret-free audit data for a valid request', async () => {
    const response = await request(app.getHttpServer())
      .post('/ask')
      .send({
        question: 'Quantos Pokémon existem em Kanto?',
        sources: [
          {
            kind: 'postgres',
            connectionUrl: 'postgresql://user:request-secret@private-host/pokemon',
          },
        ],
      })
      .expect(200);

    expect(response.body).toEqual({
      answer: 'Há 151 Pokémon em Kanto.',
      executions: [
        {
          sourceId: 'source_1',
          kind: 'postgres',
          stage: 'execute',
          status: 'succeeded',
          query: { language: 'sql', text: 'SELECT 151 AS total' },
          result: {
            kind: 'postgres',
            rows: [{ total: 151 }],
            returnedCount: 1,
          },
          truncatedForSummary: false,
        },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain('request-secret');
    expect(JSON.stringify(response.body)).not.toContain('private-host');
  });

  it('rejects a request without a question', async () => {
    await request(app.getHttpServer())
      .post('/ask')
      .send({
        sources: [
          { kind: 'postgres', connectionUrl: 'postgresql://localhost/pokemon' },
        ],
      })
      .expect(400);
  });

  it('rejects unexpected body properties', async () => {
    await request(app.getHttpServer())
      .post('/ask')
      .send({
        question: 'teste',
        sources: [
          { kind: 'postgres', connectionUrl: 'postgresql://localhost/pokemon' },
        ],
        extra: 'not accepted',
      })
      .expect(400);
  });

  it('rejects a source URL that does not match its source kind before inspection', async () => {
    const response = await request(app.getHttpServer())
      .post('/ask')
      .send({
        question: 'teste',
        sources: [
          { kind: 'postgres', connectionUrl: 'mongodb://localhost/starwars' },
        ],
      })
      .expect(400);

    expect(JSON.stringify(response.body)).toContain(
      'Connection URL does not match the source kind.',
    );

    expect(adapter.inspect).not.toHaveBeenCalled();
  });

  it('rejects unsafe planned SQL before adapter execution', async () => {
    vi.mocked(provider.plan).mockResolvedValueOnce({
      queries: [
        {
          sourceId: 'source_1',
          query: { language: 'sql', text: 'SELECT 1; SELECT 2' } as const,
        },
      ],
      unavailableReason: '',
    });

    await request(app.getHttpServer())
      .post('/ask')
      .send({
        question: 'teste',
        sources: [
          { kind: 'postgres', connectionUrl: 'postgresql://localhost/pokemon' },
        ],
      })
      .expect(502)
      .expect((response) => {
        expect(response.body.message).toBe(
          'AI provider returned an invalid query plan.',
        );
      });

    expect(adapter.execute).not.toHaveBeenCalled();
  });

  afterEach(async () => {
    await app.close();
  });
});
