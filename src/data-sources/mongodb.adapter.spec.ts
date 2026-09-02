import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { MongoClient } from 'mongodb';
import { vi } from 'vitest';
import type { MongoDbClientFactory } from './mongodb.adapter.js';
import { MongoDbAdapter } from './mongodb.adapter.js';

interface FakeCursor {
  toArray: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maxTimeMS: ReturnType<typeof vi.fn>;
}

interface FakeCollection {
  aggregate: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  listIndexes: ReturnType<typeof vi.fn>;
}

interface FakeDb {
  databaseName: string;
  collection: ReturnType<typeof vi.fn>;
  listCollections: ReturnType<typeof vi.fn>;
}

interface FakeClient {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  db: ReturnType<typeof vi.fn>;
}

function createCursor(rows: Record<string, unknown>[] = []): FakeCursor {
  const cursor: FakeCursor = {
    toArray: vi.fn(async () => rows),
    limit: vi.fn(),
    maxTimeMS: vi.fn(),
  };
  cursor.limit.mockReturnValue(cursor);
  cursor.maxTimeMS.mockReturnValue(cursor);
  return cursor;
}

function createFakeClient(): {
  client: FakeClient;
  db: FakeDb;
  collection: FakeCollection;
  sampleCursor: FakeCursor;
  findCursor: FakeCursor;
  aggregateCursor: FakeCursor;
} {
  const sampleCursor = createCursor();
  const findCursor = createCursor();
  const aggregateCursor = createCursor();
  const collection: FakeCollection = {
    aggregate: vi.fn((pipeline: unknown[]) =>
      Array.isArray(pipeline) &&
      pipeline.some((stage) => '$sample' in (stage as object))
        ? sampleCursor
        : aggregateCursor,
    ),
    find: vi.fn(() => findCursor),
    listIndexes: vi.fn(() => ({
      toArray: vi.fn(async () => [{ name: 'orders_customer_idx' }]),
    })),
  };
  const db: FakeDb = {
    databaseName: 'analytics',
    collection: vi.fn(() => collection),
    listCollections: vi.fn(() => ({
      toArray: vi.fn(async () => [{ name: 'orders' }]),
    })),
  };
  const client: FakeClient = {
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    db: vi.fn(() => db),
  };

  return { client, db, collection, sampleCursor, findCursor, aggregateCursor };
}

function asMongoClient(client: FakeClient): MongoClient {
  return client as unknown as MongoClient;
}

describe('MongoDbAdapter', () => {
  it('inspects inferred metadata without returning sampled values', async () => {
    const fake = createFakeClient();
    fake.sampleCursor.toArray.mockResolvedValue([
      {
        customer: { address: { city: 'Sao Paulo' } },
        total: 18,
      },
      {
        customer: { address: { city: 42 } },
        total: '18.00',
      },
    ]);
    const adapter = new MongoDbAdapter(
      vi.fn(() => asMongoClient(fake.client)) as MongoDbClientFactory,
    );

    await expect(
      adapter.inspect({ kind: 'mongodb', connectionUrl: 'mongodb://example' }),
    ).resolves.toEqual({
      kind: 'mongodb',
      namespaces: [
        {
          name: 'analytics',
          entities: [
            {
              name: 'orders',
              fields: [
                { path: 'customer', types: ['object'] },
                { path: 'customer.address', types: ['object'] },
                { path: 'customer.address.city', types: ['number', 'string'] },
                { path: 'total', types: ['number', 'string'] },
              ],
              indexes: ['orders_customer_idx'],
            },
          ],
        },
      ],
    });

    expect(fake.collection.aggregate).toHaveBeenCalledWith(
      [{ $sample: { size: 100 } }],
      { maxTimeMS: 10_000 },
    );
    expect(fake.client.close).toHaveBeenCalledOnce();
  });

  it('caps find reads at one thousand documents', async () => {
    const fake = createFakeClient();
    fake.findCursor.toArray.mockResolvedValue([{ _id: 1, total: 18 }]);
    const adapter = new MongoDbAdapter(
      vi.fn(() => asMongoClient(fake.client)) as MongoDbClientFactory,
    );

    await expect(
      adapter.execute(
        { kind: 'mongodb', connectionUrl: 'mongodb://example' },
        {
          language: 'mongo',
          operation: 'find',
          collection: 'orders',
          filter: { total: { $gte: 10 } },
          projection: { total: 1 },
          sort: { total: -1 },
          limit: 2_000,
        },
      ),
    ).resolves.toEqual({
      kind: 'mongodb',
      rows: [{ _id: 1, total: 18 }],
      returnedCount: 1,
    });

    expect(fake.collection.find).toHaveBeenCalledWith(
      { total: { $gte: 10 } },
      { projection: { total: 1 }, sort: { total: -1 }, maxTimeMS: 10_000 },
    );
    expect(fake.findCursor.limit).toHaveBeenCalledWith(1_000);
    expect(fake.client.close).toHaveBeenCalledOnce();
  });

  it('validates aggregate pipelines before appending the hard limit', async () => {
    const fake = createFakeClient();
    fake.aggregateCursor.toArray.mockResolvedValue([{ total: 18 }]);
    const factory = vi.fn(() =>
      asMongoClient(fake.client),
    ) as MongoDbClientFactory;
    const adapter = new MongoDbAdapter(factory);

    await expect(
      adapter.execute(
        { kind: 'mongodb', connectionUrl: 'mongodb://example' },
        {
          language: 'mongo',
          operation: 'aggregate',
          collection: 'orders',
          pipeline: [{ $match: { total: { $gte: 10 } } }],
        },
      ),
    ).resolves.toEqual({
      kind: 'mongodb',
      rows: [{ total: 18 }],
      returnedCount: 1,
    });
    expect(fake.collection.aggregate).toHaveBeenCalledWith(
      [{ $match: { total: { $gte: 10 } } }, { $limit: 1_000 }],
      { maxTimeMS: 10_000 },
    );

    await expect(
      adapter.execute(
        { kind: 'mongodb', connectionUrl: 'mongodb://example' },
        {
          language: 'mongo',
          operation: 'aggregate',
          collection: 'orders',
          pipeline: [{ $match: { values: [{ $where: 'unsafe' }] } }],
        },
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'MongoDB query contains an unsupported operator.',
      ),
    );
    expect(factory).toHaveBeenCalledOnce();
  });

  it('rejects non-Mongo queries before opening a client', async () => {
    const factory = vi.fn() as unknown as MongoDbClientFactory;
    const adapter = new MongoDbAdapter(factory);

    await expect(
      adapter.execute(
        { kind: 'mongodb', connectionUrl: 'mongodb://example' },
        { language: 'sql', text: 'SELECT * FROM orders' },
      ),
    ).rejects.toThrow('MongoDB sources require MongoDB queries.');
    expect(factory).not.toHaveBeenCalled();
  });

  it('hides a synchronous client-factory failure during inspection', async () => {
    const adapter = new MongoDbAdapter((() => {
      throw new Error('mongodb://private-host:27017 is invalid');
    }) as MongoDbClientFactory);

    await expect(
      adapter.inspect({ kind: 'mongodb', connectionUrl: 'mongodb://example' }),
    ).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the MongoDB source.'),
    );
  });

  it('hides a synchronous client-factory failure during execution', async () => {
    const adapter = new MongoDbAdapter((() => {
      throw new Error('mongodb://private-host:27017 is invalid');
    }) as MongoDbClientFactory);

    await expect(
      adapter.execute(
        { kind: 'mongodb', connectionUrl: 'mongodb://example' },
        { language: 'mongo', operation: 'find', collection: 'orders' },
      ),
    ).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the MongoDB source.'),
    );
  });

  it('hides driver failures and closes the client after failure', async () => {
    const fake = createFakeClient();
    fake.client.connect.mockRejectedValue(
      new Error('mongodb://private-host:27017 failed'),
    );
    const adapter = new MongoDbAdapter(
      vi.fn(() => asMongoClient(fake.client)) as MongoDbClientFactory,
    );

    await expect(
      adapter.inspect({ kind: 'mongodb', connectionUrl: 'mongodb://example' }),
    ).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the MongoDB source.'),
    );
    expect(fake.client.close).toHaveBeenCalledOnce();
  });

  it('hides execution driver failures and closes the client', async () => {
    const fake = createFakeClient();
    fake.client.connect.mockRejectedValue(
      new Error('mongodb://private-host:27017 failed'),
    );
    const adapter = new MongoDbAdapter(
      vi.fn(() => asMongoClient(fake.client)) as MongoDbClientFactory,
    );

    await expect(
      adapter.execute(
        { kind: 'mongodb', connectionUrl: 'mongodb://example' },
        { language: 'mongo', operation: 'find', collection: 'orders' },
      ),
    ).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the MongoDB source.'),
    );
    expect(fake.client.close).toHaveBeenCalledOnce();
  });
});
