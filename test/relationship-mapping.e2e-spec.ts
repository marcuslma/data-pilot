import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { vi } from 'vitest';
import { configureApplication } from '../src/application.setup.js';
import { AppModule } from '../src/app.module.js';
import { DataSourceService } from '../src/data-sources/data-source.service.js';
import type {
  DataSourceFieldProfile,
  DetailedDataSourceInspection,
} from '../src/data-sources/data-source.types.js';
import { fingerprintValue } from '../src/data-sources/value-profiling.js';

describe('Relationship mapping (e2e)', () => {
  let app: INestApplication<App>;
  const dataSourceService = {
    validateSource: vi.fn(),
    inspectDetailed: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    dataSourceService.validateSource.mockImplementation((source: unknown) => source);
    dataSourceService.inspectDetailed.mockImplementation(
      async (source: { kind: 'postgres' | 'mongodb' }) =>
        detailedInspectionFor(source.kind),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSourceService)
      .useValue(dataSourceService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  it('returns catalogs and explainable suggestions for named sources', async () => {
    await request(app.getHttpServer())
      .post('/relationship-suggestions')
      .send(validSuggestionRequest())
      .expect(201)
      .expect(({ body }) => {
        expect(body.sources).toHaveLength(2);
        expect(body.suggestions[0]).toEqual(
          expect.objectContaining({
            operator: 'equals',
            evidence: expect.arrayContaining(['value_overlap']),
          }),
        );
        expect(JSON.stringify(body)).not.toContain('postgresql://');
        expect(JSON.stringify(body)).not.toContain('sample-secret');
      });
  });

  it('validates a corrected relationship definition', async () => {
    await request(app.getHttpServer())
      .post('/relationships/validate')
      .send({
        ...validSuggestionRequest(),
        relationships: [validRelationship()],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.relationships).toEqual([validRelationship()]);
      });
  });

  it('rejects malformed source requests at the HTTP boundary', async () => {
    await request(app.getHttpServer())
      .post('/relationship-suggestions')
      .send({ sources: [] })
      .expect(400);

    await request(app.getHttpServer())
      .post('/relationships/validate')
      .send({ sources: [], relationships: [] })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});

function validSuggestionRequest() {
  return {
    sources: [
      {
        sourceId: 'crm',
        source: {
          kind: 'postgres',
          connectionUrl: 'postgresql://user:secret@private-host/crm',
        },
      },
      {
        sourceId: 'billing',
        source: {
          kind: 'mongodb',
          connectionUrl: 'mongodb://user:secret@private-host/billing',
        },
      },
    ],
  };
}

function detailedInspectionFor(
  kind: 'postgres' | 'mongodb',
): DetailedDataSourceInspection {
  const fieldProfiles =
    kind === 'postgres'
      ? [
          profile('public', 'customers', 'id', ['uuid'], ['identifier'], true, true),
        ]
      : [
          profile(
            'billing',
            'orders',
            'customer_id',
            ['uuid'],
            ['identifier'],
            false,
            false,
          ),
        ];

  return {
    catalog: {
      kind,
      namespaces: [
        {
          name: kind === 'postgres' ? 'public' : 'billing',
          entities: [
            {
              name: kind === 'postgres' ? 'customers' : 'orders',
              fields: [
                {
                  path: fieldProfiles[0]?.path ?? 'id',
                  types: fieldProfiles[0]?.types ?? ['uuid'],
                },
              ],
              indexes: [],
            },
          ],
        },
      ],
    },
    fieldProfiles,
  };
}

function profile(
  namespace: string,
  entity: string,
  path: string,
  types: string[],
  typeFamilies: DataSourceFieldProfile['typeFamilies'],
  primaryKey: boolean,
  unique: boolean,
): DataSourceFieldProfile {
  const fingerprint = fingerprintValue('customer-1');
  const valueFingerprints = fingerprint ? [fingerprint] : [];

  return {
    namespace,
    entity,
    path,
    types,
    typeFamilies,
    primaryKey,
    unique,
    nullable: false,
    valueFingerprints,
    sampledValueCount: 1,
    distinctSampleCount: 1,
  };
}

function validRelationship() {
  return {
    left: {
      sourceId: 'crm',
      namespace: 'public',
      entity: 'customers',
      field: 'id',
    },
    right: {
      sourceId: 'billing',
      namespace: 'billing',
      entity: 'orders',
      field: 'customer_id',
    },
    operator: 'equals',
    cardinality: 'one-to-many',
    joinType: 'left',
  };
}
