export type DataSourceKind = 'postgres' | 'mongodb';

export interface SourceDefinition {
  kind: DataSourceKind;
  connectionUrl: string;
}

export interface CatalogField {
  path: string;
  types: string[];
}

export interface CatalogKey {
  name: string;
  type: 'primary';
  fields: string[];
}

export interface CatalogEntity {
  name: string;
  fields: CatalogField[];
  indexes: string[];
  keys?: CatalogKey[];
}

export interface DataSourceCatalog {
  kind: DataSourceKind;
  database?: string;
  namespaces: Array<{
    name: string;
    entities: CatalogEntity[];
  }>;
}

export type NativeQuery =
  | { language: 'sql'; text: string }
  | {
      language: 'mongo';
      operation: 'find' | 'aggregate';
      collection: string;
      filter?: Record<string, unknown>;
      projection?: Record<string, unknown>;
      sort?: Record<string, 1 | -1>;
      limit?: number;
      pipeline?: Record<string, unknown>[];
    };

export interface QueryResult {
  kind: DataSourceKind;
  rows: unknown[];
  returnedCount: number;
}
