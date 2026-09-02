import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Source } from '../data-sources/data-source.schemas.js';
import { DataSourceService } from '../data-sources/data-source.service.js';
import type {
  DataSourceCatalog,
  DataSourceKind,
  NativeQuery,
  QueryResult,
} from '../data-sources/data-source.types.js';
import {
  AI_QUERY_PROVIDER,
  ASK_CONFIGURATION,
  type AiQueryProvider,
  type AskConfiguration,
  type AskResponse,
  type AskSourceOutcome,
  type PlannedQuery,
  type QueryPlan,
  type SummaryExecution,
} from './ai-query.types.js';
import type { AskRequest } from './ask.schemas.js';

const INVALID_PLAN = 'AI provider returned an invalid query plan.';

interface SourceEntry {
  sourceId: string;
  source: Source;
}

interface CataloguedSource extends SourceEntry {
  catalog: DataSourceCatalog;
}

interface ValidatedExecution extends CataloguedSource {
  query: NativeQuery;
}

@Injectable()
export class AskService {
  constructor(
    private readonly dataSourceService: DataSourceService,
    @Inject(AI_QUERY_PROVIDER)
    private readonly provider: AiQueryProvider,
    @Inject(ASK_CONFIGURATION)
    private readonly configuration: AskConfiguration,
  ) {}

  async ask(request: AskRequest): Promise<AskResponse> {
    if (request.sources.length > this.configuration.maxSources) {
      throw new BadRequestException('Too many data sources.');
    }

    request.sources.forEach((source) =>
      this.dataSourceService.validateSource(source),
    );
    const sources = request.sources.map((source, index) => ({
      sourceId: `source_${index + 1}`,
      source,
    }));
    const cataloguedSources = await this.inspectSources(sources);

    if (cataloguedSources.sources.length === 0) {
      throw new UnprocessableEntityException(
        'Unable to access any data source.',
      );
    }

    const plan = await this.provider.plan({
      question: request.question,
      sources: cataloguedSources.sources.map(({ sourceId, source, catalog }) => ({
        sourceId,
        kind: source.kind,
        catalog,
      })),
    });
    const validatedExecutions = this.validatePlan(plan, cataloguedSources.sources);

    if (validatedExecutions.length === 0) {
      return {
        answer: plan.unavailableReason,
        executions: this.toOrderedOutcomes(sources, cataloguedSources.failures),
      };
    }

    const executionOutcomes = await this.executeQueries(validatedExecutions);
    const successfulExecutions = executionOutcomes.successful;

    if (successfulExecutions.length === 0) {
      throw new UnprocessableEntityException(
        'Unable to execute any planned query.',
      );
    }

    const summaryExecutions = this.createSummaryExecutions(successfulExecutions);
    const answer = await this.provider.summarize({
      question: request.question,
      executions: summaryExecutions.executions,
    });

    return {
      answer,
      executions: this.toOrderedOutcomes(sources, {
        ...cataloguedSources.failures,
        ...executionOutcomes.failures,
        ...summaryExecutions.successes,
      }),
    };
  }

  private async inspectSources(sources: SourceEntry[]): Promise<{
    sources: CataloguedSource[];
    failures: Record<string, AskSourceOutcome>;
  }> {
    const inspections = await Promise.allSettled(
      sources.map(async (entry) => ({
        ...entry,
        catalog: await this.dataSourceService.inspect(entry.source),
      })),
    );
    const cataloguedSources: CataloguedSource[] = [];
    const failures: Record<string, AskSourceOutcome> = {};

    inspections.forEach((inspection, index) => {
      const source = sources[index];

      if (inspection.status === 'fulfilled') {
        cataloguedSources.push(inspection.value);
        return;
      }

      failures[source.sourceId] = {
        sourceId: source.sourceId,
        kind: source.source.kind,
        stage: 'catalog',
        status: 'failed',
        error: sourceAccessMessage(source.source.kind),
      };
    });

    return { sources: cataloguedSources, failures };
  }

  private validatePlan(
    plan: QueryPlan,
    sources: CataloguedSource[],
  ): ValidatedExecution[] {
    if (!isQueryPlan(plan)) {
      throw invalidPlanException();
    }

    if (plan.queries.length === 0) {
      if (plan.unavailableReason.trim() === '') {
        throw invalidPlanException();
      }

      return [];
    }

    if (
      plan.unavailableReason.trim() !== '' ||
      plan.queries.length > sources.length
    ) {
      throw invalidPlanException();
    }

    const sourcesById = new Map(
      sources.map((source) => [source.sourceId, source]),
    );
    const plannedSourceIds = new Set<string>();

    return plan.queries.map((planned) => {
      const source = sourcesById.get(planned.sourceId);

      if (!source || plannedSourceIds.has(planned.sourceId)) {
        throw invalidPlanException();
      }

      plannedSourceIds.add(planned.sourceId);

      return {
        ...source,
        query: this.parsePlannedQuery(source.source.kind, planned),
      };
    });
  }

  private parsePlannedQuery(
    kind: DataSourceKind,
    planned: PlannedQuery,
  ): NativeQuery {
    try {
      const parsed: unknown = JSON.parse(planned.nativeQueryJson);

      if (!isPlainObject(parsed)) {
        throw invalidPlanException();
      }

      return this.dataSourceService.validateNativeQuery(kind, parsed);
    } catch {
      throw invalidPlanException();
    }
  }

  private async executeQueries(executions: ValidatedExecution[]): Promise<{
    successful: Array<ValidatedExecution & { result: QueryResult }>;
    failures: Record<string, AskSourceOutcome>;
  }> {
    const results = await Promise.allSettled(
      executions.map(async (execution) => ({
        ...execution,
        result: await this.dataSourceService.execute(
          execution.source,
          execution.query,
        ),
      })),
    );
    const successful: Array<ValidatedExecution & { result: QueryResult }> = [];
    const failures: Record<string, AskSourceOutcome> = {};

    results.forEach((result, index) => {
      const execution = executions[index];

      if (result.status === 'fulfilled') {
        successful.push(result.value);
        return;
      }

      failures[execution.sourceId] = {
        sourceId: execution.sourceId,
        kind: execution.source.kind,
        stage: 'execute',
        status: 'failed',
        query: execution.query,
        error: sourceAccessMessage(execution.source.kind),
      };
    });

    return { successful, failures };
  }

  private createSummaryExecutions(
    executions: Array<ValidatedExecution & { result: QueryResult }>,
  ): {
    executions: SummaryExecution[];
    successes: Record<string, AskSourceOutcome>;
  } {
    let remainingCharacters = this.configuration.maxSummaryContentChars;
    const summaryExecutions: SummaryExecution[] = [];
    const successes: Record<string, AskSourceOutcome> = {};

    for (const execution of executions) {
      const boundedRows = boundRows(
        execution.result.rows,
        this.configuration.maxSummaryRowsPerExecution,
        remainingCharacters,
      );
      remainingCharacters -= boundedRows.serializedCharacters;

      summaryExecutions.push({
        sourceId: execution.sourceId,
        kind: execution.source.kind,
        rows: boundedRows.rows,
        returnedCount: execution.result.returnedCount,
        truncatedForSummary: boundedRows.truncated,
      });
      successes[execution.sourceId] = {
        sourceId: execution.sourceId,
        kind: execution.source.kind,
        stage: 'execute',
        status: 'succeeded',
        query: execution.query,
        result: execution.result,
        truncatedForSummary: boundedRows.truncated,
      };
    }

    return { executions: summaryExecutions, successes };
  }

  private toOrderedOutcomes(
    sources: SourceEntry[],
    outcomes: Record<string, AskSourceOutcome>,
  ): AskSourceOutcome[] {
    return sources.flatMap((source) => {
      const outcome = outcomes[source.sourceId];
      return outcome ? [outcome] : [];
    });
  }
}

function isQueryPlan(value: unknown): value is QueryPlan {
  return (
    isPlainObject(value) &&
    hasOnlyKeys(value, ['queries', 'unavailableReason']) &&
    Array.isArray(value.queries) &&
    value.queries.every(isPlannedQuery) &&
    typeof value.unavailableReason === 'string'
  );
}

function isPlannedQuery(value: unknown): value is PlannedQuery {
  return (
    isPlainObject(value) &&
    hasOnlyKeys(value, ['sourceId', 'nativeQueryJson']) &&
    typeof value.sourceId === 'string' &&
    typeof value.nativeQueryJson === 'string'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function invalidPlanException(): BadGatewayException {
  return new BadGatewayException(INVALID_PLAN);
}

function sourceAccessMessage(kind: DataSourceKind): string {
  return kind === 'postgres'
    ? 'Unable to access the PostgreSQL source.'
    : 'Unable to access the MongoDB source.';
}

function boundRows(
  rows: unknown[],
  maxRows: number,
  remainingCharacters: number,
): {
  rows: unknown[];
  serializedCharacters: number;
  truncated: boolean;
} {
  const boundedRows: unknown[] = [];
  let serializedCharacters = 0;
  let truncated = rows.length > maxRows;

  for (const row of rows.slice(0, maxRows)) {
    const length = serializedLength(row);

    if (length > remainingCharacters - serializedCharacters) {
      truncated = true;
      break;
    }

    boundedRows.push(row);
    serializedCharacters += length;
  }

  return { rows: boundedRows, serializedCharacters, truncated };
}

function serializedLength(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? Number.POSITIVE_INFINITY : serialized.length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
