import { ServiceUnavailableException } from '@nestjs/common';
import type {
  AiQueryProvider,
  PlanningSource,
  QueryPlan,
  SummaryExecution,
} from './ai-query.types.js';

const MESSAGE = 'AI query provider is not configured.';

export class UnconfiguredAiQueryProvider implements AiQueryProvider {
  async plan(_input: {
    question: string;
    sources: PlanningSource[];
  }): Promise<QueryPlan> {
    throw new ServiceUnavailableException(MESSAGE);
  }

  async summarize(_input: {
    question: string;
    executions: SummaryExecution[];
  }): Promise<string> {
    throw new ServiceUnavailableException(MESSAGE);
  }
}
