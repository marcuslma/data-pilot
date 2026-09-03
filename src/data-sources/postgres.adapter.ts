import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Client } from 'pg';
import Cursor from 'pg-cursor';
import type { DataSourceAdapter } from './data-source.adapter.js';
import type {
  DataSourceCatalog,
  DataSourceFieldProfile,
  DetailedDataSourceInspection,
  NativeQuery,
  QueryResult,
  SourceDefinition,
} from './data-source.types.js';
import { hasMultipleSqlStatements } from './sql-statement.js';
import {
  profileDocumentFields,
  profileTypeFamilies,
} from './value-profiling.js';

export const POSTGRES_CLIENT_FACTORY = Symbol('POSTGRES_CLIENT_FACTORY');

export type PostgresClientFactory = (connectionUrl: string) => Client;

const postgresClientFactory: PostgresClientFactory = (connectionUrl) =>
  new Client({ connectionString: connectionUrl });

interface ColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable?: string;
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

interface UniqueColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  constraint_name: string;
}

interface CatalogMetadata {
  database: string;
  columns: ColumnRow[];
  primaryKeys: PrimaryKeyRow[];
  indexes: IndexRow[];
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
      const metadata = await this.readCatalogMetadata(client);

      return this.buildCatalog(
        metadata.database,
        metadata.columns,
        metadata.primaryKeys,
        metadata.indexes,
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

  async inspectDetailed(
    source: SourceDefinition,
  ): Promise<DetailedDataSourceInspection> {
    let client: Client | undefined;

    try {
      client = this.clientFactory(source.connectionUrl);
      await client.connect();
      const metadata = await this.readCatalogMetadata(client);
      const uniqueColumns = await client.query<UniqueColumnRow>(
        UNIQUE_COLUMNS_QUERY,
      );

      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout = '10s'");
      const fieldProfiles = await this.profileColumns(
        client,
        metadata.columns,
        metadata.primaryKeys,
        uniqueColumns.rows,
      );
      await client.query('COMMIT');

      return {
        catalog: this.buildCatalog(
          metadata.database,
          metadata.columns,
          metadata.primaryKeys,
          metadata.indexes,
        ),
        fieldProfiles,
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

  private async readCatalogMetadata(client: Client): Promise<CatalogMetadata> {
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

    return {
      database: databaseName,
      columns: columns.rows,
      primaryKeys: primaryKeys.rows,
      indexes: indexes.rows,
    };
  }

  private async profileColumns(
    client: Client,
    columns: ColumnRow[],
    primaryKeys: PrimaryKeyRow[],
    uniqueColumns: UniqueColumnRow[],
  ): Promise<DataSourceFieldProfile[]> {
    const columnsByTable = new Map<string, ColumnRow[]>();

    columns.forEach((column) => {
      if (!isProfileEligibleType(column.data_type)) {
        return;
      }

      const tableKey = tableKeyFor(column.schema_name, column.table_name);
      const tableColumns = columnsByTable.get(tableKey) ?? [];
      tableColumns.push(column);
      columnsByTable.set(tableKey, tableColumns);
    });

    const primaryKeyFields = new Set(
      primaryKeys.map((key) =>
        fieldKeyFor(key.schema_name, key.table_name, key.column_name),
      ),
    );
    const uniqueFields = new Set(
      uniqueColumns.map((key) =>
        fieldKeyFor(key.schema_name, key.table_name, key.column_name),
      ),
    );
    const profiles: DataSourceFieldProfile[] = [];

    for (const tableColumns of columnsByTable.values()) {
      const firstColumn = tableColumns[0];
      if (!firstColumn) {
        continue;
      }

      const selectList = tableColumns
        .map((column) => quoteIdentifier(column.column_name))
        .join(', ');
      const sampleQuery = `SELECT ${selectList} FROM ${quoteIdentifier(
        firstColumn.schema_name,
      )}.${quoteIdentifier(firstColumn.table_name)} LIMIT ${SAMPLE_SIZE}`;
      const sample = await client.query<Record<string, unknown>>(sampleQuery);
      const documentProfiles = profileDocumentFields(sample.rows);

      tableColumns.forEach((column) => {
        const documentProfile = documentProfiles.find(
          ({ path }) => path === column.column_name,
        );
        const valueFingerprints = documentProfile?.valueFingerprints ?? [];
        const sampledValueCount = documentProfile?.sampledValueCount ?? 0;

        profiles.push({
          namespace: column.schema_name,
          entity: column.table_name,
          path: column.column_name,
          types: [column.data_type],
          typeFamilies: profileTypeFamilies([column.data_type]),
          primaryKey: primaryKeyFields.has(
            fieldKeyFor(
              column.schema_name,
              column.table_name,
              column.column_name,
            ),
          ),
          unique: uniqueFields.has(
            fieldKeyFor(
              column.schema_name,
              column.table_name,
              column.column_name,
            ),
          ),
          nullable:
            column.is_nullable !== 'NO' || Boolean(documentProfile?.nullable),
          valueFingerprints,
          sampledValueCount,
          distinctSampleCount: valueFingerprints.length,
        });
      });
    }

    return profiles.sort(compareProfiles);
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
  SELECT table_schema AS schema_name, table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
  ORDER BY table_schema, table_name, ordinal_position
`;

const UNIQUE_COLUMNS_QUERY = `
  SELECT tc.table_schema AS schema_name, tc.table_name, kcu.column_name, tc.constraint_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
  WHERE tc.constraint_type = 'UNIQUE'
  ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position
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

const SAMPLE_SIZE = 100;

function isProfileEligibleType(dataType: string): boolean {
  return [
    'boolean',
    'smallint',
    'integer',
    'bigint',
    'decimal',
    'numeric',
    'real',
    'double precision',
    'uuid',
    'text',
    'character varying',
    'character',
    'date',
    'timestamp without time zone',
    'timestamp with time zone',
  ].includes(dataType.toLowerCase());
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function tableKeyFor(schema: string, table: string): string {
  return `${schema}\u0000${table}`;
}

function fieldKeyFor(schema: string, table: string, field: string): string {
  return `${tableKeyFor(schema, table)}\u0000${field}`;
}

function compareProfiles(
  left: DataSourceFieldProfile,
  right: DataSourceFieldProfile,
): number {
  return [left.namespace, left.entity, left.path].join('\u0000').localeCompare(
    [right.namespace, right.entity, right.path].join('\u0000'),
  );
}
