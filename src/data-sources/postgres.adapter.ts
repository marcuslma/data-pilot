import { BadRequestException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Client } from 'pg';
import Cursor from 'pg-cursor';
import type { DataSourceAdapter } from './data-source.adapter.js';
import type {
  DataSourceCatalog,
  NativeQuery,
  QueryResult,
  SourceDefinition,
} from './data-source.types.js';
import { hasMultipleSqlStatements } from './sql-statement.js';

export const POSTGRES_CLIENT_FACTORY = Symbol('POSTGRES_CLIENT_FACTORY');

export type PostgresClientFactory = (connectionUrl: string) => Client;

const postgresClientFactory: PostgresClientFactory = (connectionUrl) =>
  new Client({ connectionString: connectionUrl });

interface ColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
}

interface DatabaseRow {
  database_name: string;
}

interface PrimaryKeyRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  constraint_name: string;
}

interface IndexRow {
  schema_name: string;
  table_name: string;
  index_name: string;
}

@Injectable()
export class PostgresAdapter implements DataSourceAdapter {
  readonly kind = 'postgres' as const;

  constructor(
    @Inject(POSTGRES_CLIENT_FACTORY)
    private readonly clientFactory: PostgresClientFactory = postgresClientFactory,
  ) {}

  async inspect(source: SourceDefinition): Promise<DataSourceCatalog> {
    let client: Client | undefined;

    try {
      client = this.clientFactory(source.connectionUrl);
      await client.connect();
      const database = await client.query<DatabaseRow>(
        'SELECT current_database() AS database_name',
      );
      const columns = await client.query<ColumnRow>(COLUMNS_QUERY);
      const primaryKeys = await client.query<PrimaryKeyRow>(PRIMARY_KEYS_QUERY);
      const indexes = await client.query<IndexRow>(INDEXES_QUERY);
      const databaseName = database.rows[0]?.database_name;

      if (!databaseName) {
        throw new Error('PostgreSQL did not return the connected database.');
      }

      return this.buildCatalog(
        databaseName,
        columns.rows,
        primaryKeys.rows,
        indexes.rows,
      );
    } catch {
      throw new UnprocessableEntityException(
        'Unable to access the PostgreSQL source.',
      );
    } finally {
      if (client) {
        await this.endClient(client);
      }
    }
  }

  async execute(
    source: SourceDefinition,
    query: NativeQuery,
  ): Promise<QueryResult> {
    if (query.language !== 'sql') {
      throw new BadRequestException('PostgreSQL sources require SQL queries.');
    }

    if (hasMultipleSqlStatements(query.text)) {
      throw new BadRequestException('Invalid SQL statement.');
    }

    let client: Client | undefined;

    try {
      client = this.clientFactory(source.connectionUrl);
      await client.connect();
      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout = '10s'");

      const cursor = new Cursor(query.text);
      client.query(cursor);

      const rows = (await this.readCursor(cursor)).slice(0, 1_000);
      await client.query('COMMIT');

      return {
        kind: 'postgres',
        rows,
        returnedCount: rows.length,
      };
    } catch {
      throw new UnprocessableEntityException(
        'Unable to access the PostgreSQL source.',
      );
    } finally {
      if (client) {
        await this.endClient(client);
      }
    }
  }

  private async readCursor(cursor: Cursor): Promise<unknown[]> {
    try {
      return await cursor.read(1_000);
    } finally {
      await cursor.close();
    }
  }

  private async endClient(client: Client): Promise<void> {
    try {
      await client.end();
    } catch {
      // Ending an already failed connection must not expose a driver error.
    }
  }

  private buildCatalog(
    database: string,
    columns: ColumnRow[],
    primaryKeys: PrimaryKeyRow[],
    indexes: IndexRow[],
  ): DataSourceCatalog {
    const namespaces = new Map<
      string,
      Map<
        string,
        {
          name: string;
          fields: Array<{ path: string; types: string[] }>;
          indexes: string[];
          keys: Array<{
            name: string;
            type: 'primary';
            fields: string[];
          }>;
        }
      >
    >();

    for (const column of columns) {
      const entities = namespaces.get(column.schema_name) ?? new Map();
      const entity = entities.get(column.table_name) ?? {
        name: column.table_name,
        fields: [],
        indexes: [],
        keys: [],
      };

      entity.fields.push({ path: column.column_name, types: [column.data_type] });
      entities.set(column.table_name, entity);
      namespaces.set(column.schema_name, entities);
    }

    for (const primaryKey of primaryKeys) {
      const entity = namespaces
        .get(primaryKey.schema_name)
        ?.get(primaryKey.table_name);

      if (entity) {
        const key = entity.keys.find(
          ({ name }) => name === primaryKey.constraint_name,
        ) ?? {
          name: primaryKey.constraint_name,
          type: 'primary' as const,
          fields: [],
        };

        key.fields.push(primaryKey.column_name);
        if (!entity.keys.includes(key)) {
          entity.keys.push(key);
        }
      }
    }

    for (const index of indexes) {
      const entity = namespaces
        .get(index.schema_name)
        ?.get(index.table_name);

      if (entity) {
        entity.indexes.push(index.index_name);
      }
    }

    return {
      kind: 'postgres',
      database,
      namespaces: [...namespaces].map(([name, entities]) => ({
        name,
        entities: [...entities.values()],
      })),
    };
  }
}

const COLUMNS_QUERY = `
  SELECT table_schema AS schema_name, table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
  ORDER BY table_schema, table_name, ordinal_position
`;

const PRIMARY_KEYS_QUERY = `
  SELECT tc.table_schema AS schema_name, tc.table_name, kcu.column_name, tc.constraint_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
  WHERE tc.constraint_type = 'PRIMARY KEY'
  ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position
`;

const INDEXES_QUERY = `
  SELECT schemaname AS schema_name, tablename AS table_name, indexname AS index_name
  FROM pg_indexes
  WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
  ORDER BY schemaname, tablename, indexname
`;
