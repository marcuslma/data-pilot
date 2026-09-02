import {
  INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import type { DataSourceAdapter } from './../src/data-sources/data-source.adapter.js';
import { DataSourceRegistry } from './../src/data-sources/data-source.registry.js';
import { vi } from 'vitest';

describe('Data sources (e2e)', () => {
  let app: INestApplication<App>;
  let originalNodeEnv: string | undefined;

  const adapter: DataSourceAdapter = {
    kind: 'postgres',
    inspect: vi.fn(async () => ({ kind: 'postgres', namespaces: [] })),
    execute: vi.fn(async () => ({ kind: 'postgres', rows: [], returnedCount: 0 })),
  };

  beforeEach(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    vi.mocked(adapter.inspect).mockResolvedValue({
      kind: 'postgres',
      namespaces: [],
    });
    vi.mocked(adapter.execute).mockResolvedValue({
      kind: 'postgres',
      rows: [],
      returnedCount: 0,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSourceRegistry)
      .useValue({ get: () => adapter })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('rejects an unsupported source kind at the DTO boundary', async () => {
    await request(app.getHttpServer())
      .post('/catalog')
      .send({
        source: {
          kind: 'redis',
          connectionUrl: 'redis://localhost',
        },
      })
      .expect(400);
  });

  it('rejects a catalog request without a source at the DTO boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog')
      .send({})
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('source should not be null or undefined'),
      ]),
    );
  });

  it('rejects a query request without a query object at the DTO boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/query')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('query must be an object'),
      ]),
    );
  });

  it('returns the normalized catalog from the selected adapter', async () => {
    await request(app.getHttpServer())
      .post('/catalog')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
      })
      .expect(201)
      .expect({ kind: 'postgres', namespaces: [] });
  });

  it('returns the query result from the selected adapter', async () => {
    await request(app.getHttpServer())
      .post('/query')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
        query: { language: 'sql', text: 'SELECT 1' },
      })
      .expect(201)
      .expect({ kind: 'postgres', rows: [], returnedCount: 0 });
  });

  it('returns a secret-free 422 response when catalog inspection fails', async () => {
    const secretMessage =
      'connection failed for postgresql://admin:catalog-secret@private-host/analytics';
    vi.mocked(adapter.inspect).mockRejectedValueOnce(
      new UnprocessableEntityException(secretMessage),
    );

    const response = await request(app.getHttpServer())
      .post('/catalog')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl:
            'postgresql://admin:request-secret@private-host/analytics',
        },
      })
      .expect(422);

    expect(response.body.message).toBe(
      'Unable to access the PostgreSQL source.',
    );
    expect(JSON.stringify(response.body)).not.toContain(secretMessage);
    expect(JSON.stringify(response.body)).not.toContain('catalog-secret');
    expect(JSON.stringify(response.body)).not.toContain('request-secret');
  });

  it('returns a secret-free 422 response when query execution fails', async () => {
    const secretMessage =
      'query failed for postgresql://admin:query-secret@private-host/analytics';
    vi.mocked(adapter.execute).mockRejectedValueOnce(
      new UnprocessableEntityException(secretMessage),
    );

    const response = await request(app.getHttpServer())
      .post('/query')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl:
            'postgresql://admin:request-secret@private-host/analytics',
        },
        query: { language: 'sql', text: 'SELECT 1' },
      })
      .expect(422);

    expect(response.body.message).toBe(
      'Unable to access the PostgreSQL source.',
    );
    expect(JSON.stringify(response.body)).not.toContain(secretMessage);
    expect(JSON.stringify(response.body)).not.toContain('query-secret');
    expect(JSON.stringify(response.body)).not.toContain('request-secret');
  });

  it('rejects a connection protocol that does not match its source kind', async () => {
    await request(app.getHttpServer())
      .post('/catalog')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl: 'mongodb://localhost/test',
        },
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe(
          'Connection URL does not match the source kind.',
        );
      });
  });

  it('rejects an SQL query sent to a MongoDB source', async () => {
    await request(app.getHttpServer())
      .post('/query')
      .send({
        source: {
          kind: 'mongodb',
          connectionUrl: 'mongodb://localhost/test',
        },
        query: { language: 'sql', text: 'SELECT 1' },
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('Invalid native query.');
      });
  });

  it('rejects a MongoDB query sent to a PostgreSQL source', async () => {
    await request(app.getHttpServer())
      .post('/query')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
        query: { language: 'mongo', operation: 'find', collection: 'orders' },
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('Invalid native query.');
      });
  });

  it('rejects an invalid MongoDB operation', async () => {
    await request(app.getHttpServer())
      .post('/query')
      .send({
        source: {
          kind: 'mongodb',
          connectionUrl: 'mongodb://localhost/test',
        },
        query: { language: 'mongo', operation: 'update', collection: 'orders' },
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('Invalid native query.');
      });
  });

  it('rejects unexpected body properties through the production validation pipe', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog')
      .send({
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
          extra: 'not accepted',
        },
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('extra')]),
    );
  });

  it.each(['catalog', 'query'])(
    'blocks the %s route in production before a source is touched',
    async (route) => {
      process.env.NODE_ENV = 'production';

      const body =
        route === 'catalog'
          ? {
              source: {
                kind: 'postgres',
                connectionUrl: 'postgresql://localhost/test',
              },
            }
          : {
              source: {
                kind: 'postgres',
                connectionUrl: 'postgresql://localhost/test',
              },
              query: { language: 'sql', text: 'SELECT 1' },
            };

      await request(app.getHttpServer()).post(`/${route}`).send(body).expect(403);
    },
  );

  afterEach(async () => {
    await app.close();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
