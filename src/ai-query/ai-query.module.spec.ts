import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  applicationConfigurationModule,
  type ApplicationConfigService,
} from '../config/application-configuration.js';
import { ASK_CONFIGURATION, type AskConfiguration } from './ai-query.types.js';
import { AiQueryModule } from './ai-query.module.js';

describe('AiQueryModule', () => {
  it('builds the query configuration from ConfigService', async () => {
    const module = await Test.createTestingModule({
      imports: [applicationConfigurationModule, AiQueryModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configurationFor({
        MAX_ASK_SOURCES: 4,
        MAX_ASK_SUMMARY_ROWS_PER_EXECUTION: 25,
        MAX_ASK_SUMMARY_CONTENT_CHARS: 1200,
        OPENAI_API_KEY: 'configured-key',
        OPENAI_MODEL: 'gpt-5.6-luna',
        OPENAI_REASONING_EFFORT: 'high',
      }))
      .compile();

    expect(module.get<AskConfiguration>(ASK_CONFIGURATION)).toEqual({
      maxSources: 4,
      maxSummaryRowsPerExecution: 25,
      maxSummaryContentChars: 1200,
      openAi: {
        apiKey: 'configured-key',
        model: 'gpt-5.6-luna',
        reasoningEffort: 'high',
      },
    });

    await module.close();
  });
});

function configurationFor(
  values: Record<string, string | number>,
): ApplicationConfigService {
  return {
    getOrThrow: (name: string) => values[name],
  } as unknown as ApplicationConfigService;
}
