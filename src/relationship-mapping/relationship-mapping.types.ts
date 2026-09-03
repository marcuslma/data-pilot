import type {
  DataSourceCatalog,
  DataSourceKind,
  DetailedDataSourceInspection,
} from '../data-sources/data-source.types.js';
import type { Source } from '../data-sources/data-source.schemas.js';

export type RelationshipCardinality =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

export type RelationshipJoinType = 'inner' | 'left';

export interface NamedSourceRequest {
  sourceId: string;
  source: Source;
}

export interface RelationshipEndpoint {
  sourceId: string;
  namespace: string;
  entity: string;
  field: string;
}

export interface RelationshipDefinition {
  left: RelationshipEndpoint;
  right: RelationshipEndpoint;
  operator: 'equals';
  cardinality: RelationshipCardinality;
  joinType: RelationshipJoinType;
}

export type RelationshipEvidence =
  | 'compatible_types'
  | 'name_match'
  | 'key_match'
  | 'value_overlap';

export interface RelationshipSuggestion extends RelationshipDefinition {
  confidence: number;
  evidence: RelationshipEvidence[];
}

export interface RelationshipCatalogSource {
  sourceId: string;
  kind: DataSourceKind;
  catalog: DataSourceCatalog;
}

export interface RelationshipSuggestionsResponse {
  sources: RelationshipCatalogSource[];
  suggestions: RelationshipSuggestion[];
}

export interface RelationshipValidationResponse {
  relationships: RelationshipDefinition[];
}

export interface NamedDataSourceInspection {
  sourceId: string;
  inspection: DetailedDataSourceInspection;
}
