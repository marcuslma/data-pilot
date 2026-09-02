import type {
  DataSourceCatalog,
  DataSourceKind,
  NativeQuery,
  QueryResult,
} from '../data-sources/data-source.types.js';
import type { OpenAiConfiguration } from './openai-configuration.js';

export const AI_QUERY_PROVIDER = Symbol('AI_QUERY_PROVIDER');
export const ASK_CONFIGURATION = Symbol('ASK_CONFIGURATION');

export interface PlannedQuery {
  sourceId: string;
  nativeQueryJson: string;
}

export interface QueryPlan {
  queries: PlannedQuery[];
  unavailableReason: string;
}

export interface PlanningSource {
  sourceId: string;
  kind: DataSourceKind;
  catalog: DataSourceCatalog;
}

export interface SummaryExecution {
  sourceId: string;
  kind: DataSourceKind;
  rows: unknown[];
  returnedCount: number;
  truncatedForSummary: boolean;
}

export interface AiQueryProvider {
  plan(input: { question: string; sources: PlanningSource[] }): Promise<QueryPlan>;
  summarize(input: {
    question: string;
    executions: SummaryExecution[];
  }): Promise<string>;
}

export interface AskConfiguration {
  maxSources: number;
  maxSummaryRowsPerExecution: number;
  maxSummaryContentChars: number;
  openAi: OpenAiConfiguration;
}

export type AskSourceOutcome =
  | {
      sourceId: string;
      kind: DataSourceKind;
      stage: 'catalog';
      status: 'failed';
      error: string;
    }
  | {
      sourceId: string;
      kind: DataSourceKind;
      stage: 'execute';
      status: 'failed';
      query: NativeQuery;
      error: string;
    }
  | {
      sourceId: string;
      kind: DataSourceKind;
      stage: 'execute';
      status: 'succeeded';
      query: NativeQuery;
      result: QueryResult;
      truncatedForSummary: boolean;
    };

export interface AskResponse {
  answer: string;
  executions: AskSourceOutcome[];
}
