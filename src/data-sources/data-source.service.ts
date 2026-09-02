import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSourceRegistry } from './data-source.registry.js';
import { assertSafeMongoQuery } from './mongo-query-validation.js';
import { hasMultipleSqlStatements } from './sql-statement.js';
import type {
  DataSourceCatalog,
  DataSourceKind,
  NativeQuery,
  QueryResult,
  SourceDefinition,
} from './data-source.types.js';
import type { Source } from './data-source.schemas.js';

const CONNECTION_PROTOCOLS: Record<DataSourceKind, string[]> = {
  postgres: ['postgres:', 'postgresql:'],
  mongodb: ['mongodb:', 'mongodb+srv:'],
};

const INVALID_NATIVE_QUERY = 'Invalid native query.';

@Injectable()
export class DataSourceService {
  constructor(private readonly registry: DataSourceRegistry) {}

  async inspect(source: Source): Promise<DataSourceCatalog> {
    const definition = this.validateSource(source);

    try {
      return await this.registry.get(definition.kind).inspect(definition);
    } catch (error) {
      this.rethrowAccessError(error, definition.kind);
    }
  }

  async execute(source: Source, query: object): Promise<QueryResult> {
    const definition = this.validateSource(source);
    const nativeQuery = this.validateNativeQuery(definition.kind, query);

    try {
      return await this.registry
        .get(definition.kind)
        .execute(definition, nativeQuery);
    } catch (error) {
      this.rethrowAccessError(error, definition.kind);
    }
  }

  validateNativeQuery(kind: DataSourceKind, query: object): NativeQuery {
    const nativeQuery = this.parseQuery(kind, query);

    if (nativeQuery.language === 'sql') {
      if (hasMultipleSqlStatements(nativeQuery.text)) {
        throw new BadRequestException('Invalid SQL statement.');
      }
    } else {
      assertSafeMongoQuery(nativeQuery.filter);
      assertSafeMongoQuery(nativeQuery.projection);
      assertSafeMongoQuery(nativeQuery.sort);
      assertSafeMongoQuery(nativeQuery.pipeline);
    }

    return nativeQuery;
  }

  validateSource(source: Source): SourceDefinition {
    return this.parseSource(source);
  }

  private rethrowAccessError(
    error: unknown,
    kind: DataSourceKind,
  ): never {
    if (error instanceof UnprocessableEntityException) {
      const sourceName = kind === 'postgres' ? 'PostgreSQL' : 'MongoDB';
      throw new UnprocessableEntityException(
        `Unable to access the ${sourceName} source.`,
      );
    }

    throw error;
  }

  private parseSource(source: Source): SourceDefinition {
    let protocol: string;

    try {
      protocol = new URL(source.connectionUrl).protocol;
    } catch {
      throw new BadRequestException(
        'Connection URL does not match the source kind.',
      );
    }

    if (!CONNECTION_PROTOCOLS[source.kind].includes(protocol)) {
      throw new BadRequestException(
        'Connection URL does not match the source kind.',
      );
    }

    return { kind: source.kind, connectionUrl: source.connectionUrl };
  }

  private parseQuery(kind: DataSourceKind, query: object): NativeQuery {
    if (!isPlainObject(query)) {
      throw new BadRequestException(INVALID_NATIVE_QUERY);
    }

    if (kind === 'postgres' && isSqlQuery(query)) {
      return query;
    }

    if (kind === 'mongodb' && isMongoQuery(query)) {
      return query;
    }

    throw new BadRequestException(INVALID_NATIVE_QUERY);
  }
}

function isSqlQuery(query: Record<string, unknown>): query is Extract<
  NativeQuery,
  { language: 'sql' }
> {
  return (
    hasOnlyKeys(query, ['language', 'text']) &&
    query.language === 'sql' &&
    typeof query.text === 'string' &&
    query.text.trim().length > 0
  );
}

function isMongoQuery(query: Record<string, unknown>): query is Extract<
  NativeQuery,
  { language: 'mongo' }
> {
  if (
    !hasOnlyKeys(query, [
      'language',
      'operation',
      'collection',
      'filter',
      'projection',
      'sort',
      'limit',
      'pipeline',
    ]) ||
    query.language !== 'mongo' ||
    (query.operation !== 'find' && query.operation !== 'aggregate') ||
    typeof query.collection !== 'string' ||
    query.collection.trim().length === 0
  ) {
    return false;
  }

  return (
    isOptionalPlainObject(query.filter) &&
    isOptionalPlainObject(query.projection) &&
    isOptionalSort(query.sort) &&
    (query.limit === undefined ||
      (typeof query.limit === 'number' &&
        Number.isInteger(query.limit) &&
        query.limit > 0)) &&
    isOptionalPipeline(query.pipeline)
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isOptionalPlainObject(value: unknown): boolean {
  return value === undefined || isPlainObject(value);
}

function isOptionalSort(value: unknown): boolean {
  return (
    value === undefined ||
    (isPlainObject(value) &&
      Object.values(value).every((direction) => direction === 1 || direction === -1))
  );
}

function isOptionalPipeline(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isPlainObject));
}
