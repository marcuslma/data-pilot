import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BSON,
  MongoClient,
  type Collection,
  type Document,
  type FindOptions,
} from 'mongodb';
import type { DataSourceAdapter } from './data-source.adapter.js';
import type {
  DataSourceCatalog,
  DataSourceFieldProfile,
  DetailedDataSourceInspection,
  NativeQuery,
  QueryResult,
  SourceDefinition,
} from './data-source.types.js';
import {
  assertSafeMongoQuery,
  inferDocumentFields,
} from './mongo-query-validation.js';
import {
  profileDocumentFields,
  toDataSourceFieldProfile,
} from './value-profiling.js';

type MongoQuery = Extract<NativeQuery, { language: 'mongo' }>;

export const MONGODB_CLIENT_FACTORY = Symbol('MONGODB_CLIENT_FACTORY');

export type MongoDbClientFactory = (connectionUrl: string) => MongoClient;

const mongoDbClientFactory: MongoDbClientFactory = (connectionUrl) =>
  new MongoClient(connectionUrl);

const MAX_DOCUMENTS = 1_000;
const MAX_TIME_MS = 10_000;
const SAMPLE_SIZE = 100;

interface InspectedCollection {
  name: string;
  indexes: string[];
  fieldProfiles: DataSourceFieldProfile[];
  fields: ReturnType<typeof inferDocumentFields>;
}

@Injectable()
export class MongoDbAdapter implements DataSourceAdapter {
  readonly kind = 'mongodb' as const;

  constructor(
    @Inject(MONGODB_CLIENT_FACTORY)
    private readonly clientFactory: MongoDbClientFactory = mongoDbClientFactory,
  ) {}

  async inspect(source: SourceDefinition): Promise<DataSourceCatalog> {
    const detailed = await this.inspectDetailed(source);
    return detailed.catalog;
  }

  async inspectDetailed(
    source: SourceDefinition,
  ): Promise<DetailedDataSourceInspection> {
    let client: MongoClient | undefined;

    try {
      client = this.clientFactory(source.connectionUrl);
      await client.connect();
      const database = client.db();
      const collections = await database.listCollections().toArray();
      const inspectedCollections = await Promise.all(
        collections.map(({ name }) =>
          this.inspectCollection(database, name),
        ),
      );
      const entities = inspectedCollections
        .map(({ name, fields, indexes }) => ({ name, fields, indexes }))
        .sort((left, right) => left.name.localeCompare(right.name));

      return {
        catalog: {
          kind: 'mongodb',
          namespaces: [
            {
              name: database.databaseName,
              entities,
            },
          ],
        },
        fieldProfiles: inspectedCollections
          .flatMap(({ fieldProfiles }) => fieldProfiles)
          .sort(compareProfiles),
      };
    } catch {
      throw new UnprocessableEntityException(
        'Unable to access the MongoDB source.',
      );
    } finally {
      if (client) {
        await this.closeClient(client);
      }
    }
  }

  private async inspectCollection(
    database: ReturnType<MongoClient['db']>,
    name: string,
  ): Promise<InspectedCollection> {
    const collection = database.collection<Record<string, unknown>>(name);
    const [indexes, documents] = await Promise.all([
      collection.listIndexes().toArray(),
      collection
        .aggregate<Record<string, unknown>>(
          [{ $sample: { size: SAMPLE_SIZE } }],
          { maxTimeMS: MAX_TIME_MS },
        )
        .toArray(),
    ]);
    const uniquePaths = new Set(
      indexes
        .filter((index) => index.unique === true && index.key)
        .flatMap((index) => Object.keys(index.key ?? {})),
    );
    const fieldProfiles = profileDocumentFields(documents).map((profile) =>
      toDataSourceFieldProfile(
        profile,
        { namespace: database.databaseName, entity: name },
        {
          primaryKey: profile.path === '_id',
          unique: profile.path === '_id' || uniquePaths.has(profile.path),
        },
      ),
    );

    return {
      name,
      fields: inferDocumentFields(documents),
      indexes: indexes
        .map((index) => index.name)
        .filter((indexName): indexName is string => typeof indexName === 'string')
        .sort(),
      fieldProfiles,
    };
  }

  async execute(
    source: SourceDefinition,
    query: NativeQuery,
  ): Promise<QueryResult> {
    if (query.language !== 'mongo') {
      throw new BadRequestException('MongoDB sources require MongoDB queries.');
    }

    this.assertSafeQuery(query);
    let client: MongoClient | undefined;

    try {
      client = this.clientFactory(source.connectionUrl);
      await client.connect();
      const collection = client
        .db()
        .collection<Record<string, unknown>>(query.collection);
      const documents =
        query.operation === 'find'
          ? await this.executeFind(collection, query)
          : await this.executeAggregate(collection, query);
      const rows = documents
        .slice(0, MAX_DOCUMENTS)
        .map((document) => BSON.EJSON.serialize(document));

      return {
        kind: 'mongodb',
        rows,
        returnedCount: rows.length,
      };
    } catch {
      throw new UnprocessableEntityException(
        'Unable to access the MongoDB source.',
      );
    } finally {
      if (client) {
        await this.closeClient(client);
      }
    }
  }

  private assertSafeQuery(query: MongoQuery): void {
    assertSafeMongoQuery(query.filter);
    assertSafeMongoQuery(query.projection);
    assertSafeMongoQuery(query.sort);
    assertSafeMongoQuery(query.pipeline);
  }

  private async executeFind(
    collection: Collection<Record<string, unknown>>,
    query: MongoQuery,
  ): Promise<Record<string, unknown>[]> {
    const options: FindOptions = {
      projection: query.projection,
      sort: query.sort,
      maxTimeMS: MAX_TIME_MS,
    };
    return collection
      .find(query.filter ?? {}, options)
      .limit(Math.min(query.limit ?? MAX_DOCUMENTS, MAX_DOCUMENTS))
      .toArray();
  }

  private async executeAggregate(
    collection: Collection<Record<string, unknown>>,
    query: MongoQuery,
  ): Promise<Record<string, unknown>[]> {
    return collection
      .aggregate(
        [...((query.pipeline ?? []) as Document[]), { $limit: MAX_DOCUMENTS }],
        {
          maxTimeMS: MAX_TIME_MS,
        },
      )
      .toArray();
  }

  private async closeClient(client: MongoClient): Promise<void> {
    try {
      await client.close();
    } catch {
      // Closing a failed MongoDB client must not expose driver details.
    }
  }
}

function compareProfiles(
  left: DataSourceFieldProfile,
  right: DataSourceFieldProfile,
): number {
  return [left.namespace, left.entity, left.path].join('\u0000').localeCompare(
    [right.namespace, right.entity, right.path].join('\u0000'),
  );
}
