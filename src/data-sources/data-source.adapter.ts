import type {
  DataSourceCatalog,
  DataSourceKind,
  DetailedDataSourceInspection,
  NativeQuery,
  QueryResult,
  SourceDefinition,
} from './data-source.types.js';

export const DATA_SOURCE_ADAPTERS = Symbol('DATA_SOURCE_ADAPTERS');

export interface DataSourceAdapter {
  readonly kind: DataSourceKind;
  inspect(source: SourceDefinition): Promise<DataSourceCatalog>;
  inspectDetailed(
    source: SourceDefinition,
  ): Promise<DetailedDataSourceInspection>;
  execute(source: SourceDefinition, query: NativeQuery): Promise<QueryResult>;
}
