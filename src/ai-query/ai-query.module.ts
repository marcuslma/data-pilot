import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ApplicationConfigService } from '../config/application-configuration.js';
import { DataSourcesModule } from '../data-sources/data-sources.module.js';
import {
  AI_QUERY_PROVIDER,
  ASK_CONFIGURATION,
  type AskConfiguration,
} from './ai-query.types.js';
import { AskController } from './ask.controller.js';
import { AskService } from './ask.service.js';
import { OpenAiQueryProvider } from './openai-query.provider.js';

@Module({
  imports: [DataSourcesModule],
  controllers: [AskController],
  providers: [
    AskService,
    {
      provide: ASK_CONFIGURATION,
      useFactory: (
        configuration: ApplicationConfigService,
      ): AskConfiguration => ({
        maxSources: configuration.getOrThrow('MAX_ASK_SOURCES', {
          infer: true,
        }),
        maxSummaryRowsPerExecution: configuration.getOrThrow(
          'MAX_ASK_SUMMARY_ROWS_PER_EXECUTION',
          { infer: true },
        ),
        maxSummaryContentChars: configuration.getOrThrow(
          'MAX_ASK_SUMMARY_CONTENT_CHARS',
          { infer: true },
        ),
        openAi: {
          apiKey: configuration.getOrThrow('OPENAI_API_KEY', { infer: true }),
          model: configuration.getOrThrow('OPENAI_MODEL', { infer: true }),
          reasoningEffort: configuration.getOrThrow(
            'OPENAI_REASONING_EFFORT',
            { infer: true },
          ),
        },
      }),
      inject: [ConfigService],
    },
    {
      provide: AI_QUERY_PROVIDER,
      useFactory: (configuration: AskConfiguration) => {
        return new OpenAiQueryProvider(
          new OpenAI({ apiKey: configuration.openAi.apiKey }),
          configuration.openAi.model,
          configuration.openAi.reasoningEffort,
        );
      },
      inject: [ASK_CONFIGURATION],
    },
  ],
})
export class AiQueryModule {}
