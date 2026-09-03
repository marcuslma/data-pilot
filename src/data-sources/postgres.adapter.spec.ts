import type { Client } from 'pg';
import { UnprocessableEntityException } from '@nestjs/common';
import { vi } from 'vitest';
import type { PostgresClientFactory } from './postgres.adapter.js';
import { PostgresAdapter } from './postgres.adapter.js';

const cursorState = vi.hoisted(() => ({
  instances: [] as Array<{
    text: string;
    read: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }>,
  rows: [] as unknown[],
}));

vi.mock('pg-cursor', () => ({
  default: class FakeCursor {
    readonly text: string;
    readonly read = vi.fn(async () => cursorState.rows);
    readonly close = vi.fn(async () => undefined);

    constructor(text: string) {
      this.text = text;
      cursorState.instances.push(this);
    }
  },
}));

interface FakeClient {
  connect: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function createFakeClient(queryImplementation?: (query: unknown) => unknown): FakeClient {
  return {
    connect: vi.fn(async () => undefined),
    query: vi.fn(async (query: unknown) => queryImplementation?.(query)),
    end: vi.fn(async () => undefined),
    release: vi.fn(),
  };
}

function asClient(client: FakeClient): Client {
  return client as unknown as Client;
}

describe('PostgresAdapter', () => {
  beforeEach(() => {
    cursorState.instances.length = 0;
    cursorState.rows = [];
  });

  it('executes a single SQL statement in a read-only transaction and caps rows', async () => {
    cursorState.rows = Array.from({ length: 1_001 }, (_, index) => ({ index }));
    const client = createFakeClient();
    const factory = vi.fn(() => asClient(client)) as PostgresClientFactory;
    const adapter = new PostgresAdapter(factory);

    const result = await adapter.execute(
      { kind: 'postgres', connectionUrl: 'postgres://example' },
      { language: 'sql', text: 'SELECT * FROM orders' },
    );

    expect(result).toEqual({
      kind: 'postgres',
      rows: Array.from({ length: 1_000 }, (_, index) => ({ index })),
      returnedCount: 1_000,
    });
    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.query.mock.calls.slice(0, 2).map(([query]) => query)).toEqual([
      'BEGIN READ ONLY',
      "SET LOCAL statement_timeout = '10s'",
    ]);
    expect(cursorState.instances).toHaveLength(1);
    expect(cursorState.instances[0].text).toBe('SELECT * FROM orders');
    expect(cursorState.instances[0].read).toHaveBeenCalledWith(1_000);
    expect(cursorState.instances[0].close).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.end).toHaveBeenCalledOnce();
    expect(client.release).not.toHaveBeenCalled();
  });

  it('rejects multiple SQL statements before opening a client', async () => {
    const factory = vi.fn() as unknown as PostgresClientFactory;
    const adapter = new PostgresAdapter(factory);

    await expect(
      adapter.execute(
        { kind: 'postgres', connectionUrl: 'postgres://example' },
        { language: 'sql', text: 'SELECT 1; SELECT 2' },
      ),
    ).rejects.toThrow('Invalid SQL statement.');

    expect(factory).not.toHaveBeenCalled();
  });

  it('normalizes inspected PostgreSQL metadata by schema and table', async () => {
    const client = createFakeClient(() => undefined);
    client.query
      .mockResolvedValueOnce({ rows: [{ database_name: 'analytics' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            schema_name: 'public',
            table_name: 'orders',
            column_name: 'id',
            data_type: 'uuid',
          },
          {
            schema_name: 'public',
            table_name: 'orders',
            column_name: 'total',
            data_type: 'numeric',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            schema_name: 'public',
            table_name: 'orders',
            column_name: 'tenant_id',
            constraint_name: 'orders_pkey',
          },
          {
            schema_name: 'public',
            table_name: 'orders',
            column_name: 'id',
            constraint_name: 'orders_pkey',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            schema_name: 'public',
            table_name: 'orders',
            index_name: 'orders_customer_id_idx',
          },
        ],
      });
    const adapter = new PostgresAdapter(
      vi.fn(() => asClient(client)) as PostgresClientFactory,
    );

    await expect(
      adapter.inspect({ kind: 'postgres', connectionUrl: 'postgres://example' }),
    ).resolves.toEqual({
      kind: 'postgres',
      database: 'analytics',
      namespaces: [
        {
          name: 'public',
          entities: [
            {
              name: 'orders',
              fields: [
                { path: 'id', types: ['uuid'] },
                { path: 'total', types: ['numeric'] },
              ],
              indexes: ['orders_customer_id_idx'],
              keys: [
                {
                  name: 'orders_pkey',
                  type: 'primary',
                  fields: ['tenant_id', 'id'],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(client.query.mock.calls.some(([query]) => String(query).includes('current_database()'))).toBe(true);
    expect(client.query.mock.calls.some(([query]) => String(query).includes('information_schema.columns'))).toBe(true);
    expect(client.query.mock.calls.some(([query]) => String(query).includes('information_schema.table_constraints'))).toBe(true);
    expect(client.query.mock.calls.some(([query]) => String(query).includes('pg_indexes'))).toBe(true);
    expect(client.end).toHaveBeenCalledOnce();
    expect(client.release).not.toHaveBeenCalled();
  });

  it('profiles eligible scalar columns during detailed inspection without returning sampled values', async () => {
    const client = createFakeClient((query) => {
      if (typeof query !== 'string') {
        return undefined;
      }

      if (query.includes('current_database()')) {
        return { rows: [{ database_name: 'analytics' }] };
      }

      if (query.includes('information_schema.columns')) {
        return {
          rows: [
            {
              schema_name: 'public',
              table_name: 'customers',
              column_name: 'id',
              data_type: 'uuid',
              is_nullable: 'NO',
            },
            {
              schema_name: 'public',
              table_name: 'customers',
              column_name: 'email',
              data_type: 'text',
              is_nullable: 'YES',
            },
          ],
        };
      }

      if (query.includes('constraint_type = \'PRIMARY KEY\'')) {
        return {
          rows: [
            {
              schema_name: 'public',
              table_name: 'customers',
              column_name: 'id',
              constraint_name: 'customers_pkey',
            },
          ],
        };
      }

      if (query.includes('constraint_type = \'UNIQUE\'')) {
        return {
          rows: [
            {
              schema_name: 'public',
              table_name: 'customers',
              column_name: 'email',
              constraint_name: 'customers_email_key',
            },
          ],
        };
      }

      if (query.includes('FROM "public"."customers"')) {
        return { rows: [{ id: 'customer-1', email: 'secret@example.com' }] };
      }

      return { rows: [] };
    });
    const adapter = new PostgresAdapter(
      vi.fn(() => asClient(client)) as PostgresClientFactory,
    );

    const result = await adapter.inspectDetailed({
      kind: 'postgres',
      connectionUrl: 'postgres://example',
    });

    expect(result.catalog).toEqual(
      expect.objectContaining({ kind: 'postgres', database: 'analytics' }),
    );
    expect(result.fieldProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          namespace: 'public',
          entity: 'customers',
          path: 'id',
          primaryKey: true,
          valueFingerprints: expect.any(Array),
        }),
        expect.objectContaining({
          namespace: 'public',
          entity: 'customers',
          path: 'email',
          unique: true,
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('secret@example.com');
    expect(
      client.query.mock.calls.some(
        ([query]) =>
          typeof query === 'string' &&
          query.includes('FROM "public"."customers"') &&
          query.includes('LIMIT 100'),
      ),
    ).toBe(true);
    expect(client.query).toHaveBeenCalledWith('BEGIN READ ONLY');
    expect(client.query).toHaveBeenCalledWith(
      "SET LOCAL statement_timeout = '10s'",
    );
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.end).toHaveBeenCalledOnce();
  });

  it('does not sample a PostgreSQL table without eligible scalar columns', async () => {
    const client = createFakeClient((query) => {
      if (typeof query !== 'string') {
        return undefined;
      }

      if (query.includes('current_database()')) {
        return { rows: [{ database_name: 'analytics' }] };
      }

      if (query.includes('information_schema.columns')) {
        return {
          rows: [
            {
              schema_name: 'public',
              table_name: 'events',
              column_name: 'payload',
              data_type: 'jsonb',
              is_nullable: 'YES',
            },
          ],
        };
      }

      return { rows: [] };
    });
    const adapter = new PostgresAdapter(
      vi.fn(() => asClient(client)) as PostgresClientFactory,
    );

    const result = await adapter.inspectDetailed({
      kind: 'postgres',
      connectionUrl: 'postgres://example',
    });

    expect(result.catalog.namespaces[0]?.entities[0]?.name).toBe('events');
    expect(
      client.query.mock.calls.some(
        ([query]) =>
          typeof query === 'string' && query.includes('FROM "public"."events"'),
      ),
    ).toBe(false);
  });

  it('hides PostgreSQL driver failures and ends the client', async () => {
    const client = createFakeClient();
    client.query.mockRejectedValueOnce(new Error('database credentials leaked'));
    const adapter = new PostgresAdapter(
      vi.fn(() => asClient(client)) as PostgresClientFactory,
    );

    await expect(
      adapter.inspect({ kind: 'postgres', connectionUrl: 'postgres://example' }),
    ).rejects.toThrow('Unable to access the PostgreSQL source.');

    expect(client.end).toHaveBeenCalledOnce();
  });

  it('hides a synchronous client-factory failure during inspection', async () => {
    const connectionUrl = 'postgresql://admin:catalog-secret@private-host/analytics';
    const adapter = new PostgresAdapter((() => {
      throw new Error(`invalid connection URL: ${connectionUrl}`);
    }) as PostgresClientFactory);

    const operation = adapter.inspect({ kind: 'postgres', connectionUrl });

    await expect(operation).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the PostgreSQL source.'),
    );
    await expect(operation).rejects.not.toThrow(connectionUrl);
  });

  it('hides a synchronous client-factory failure during execution', async () => {
    const connectionUrl = 'postgresql://admin:query-secret@private-host/analytics';
    const adapter = new PostgresAdapter((() => {
      throw new Error(`invalid connection URL: ${connectionUrl}`);
    }) as PostgresClientFactory);

    const operation = adapter.execute(
      { kind: 'postgres', connectionUrl },
      { language: 'sql', text: 'SELECT 1' },
    );

    await expect(operation).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the PostgreSQL source.'),
    );
    await expect(operation).rejects.not.toThrow(connectionUrl);
  });
});
