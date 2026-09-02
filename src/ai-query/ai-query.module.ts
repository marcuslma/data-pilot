import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { DataSourcesModule } from '../data-sources/data-sources.module.js';
import {
  AI_QUERY_PROVIDER,
  ASK_CONFIGURATION,
  type AskConfiguration,
} from './ai-query.types.js';
import { AskController } from './ask.controller.js';
import { createAskConfiguration } from './ask-configuration.js';
import { AskService } from './ask.service.js';
import { OpenAiQueryProvider } from './openai-query.provider.js';
import { UnconfiguredAiQueryProvider } from './unconfigured-ai-query.provider.js';

@Module({
  imports: [DataSourcesModule],
  controllers: [AskController],
  providers: [
    AskService,
    {
      provide: ASK_CONFIGURATION,
      useFactory: () => createAskConfiguration(process.env),
    },
    {
      provide: AI_QUERY_PROVIDER,
      useFactory: (configuration: AskConfiguration) => {
        if (!configuration.openAi) {
          return new UnconfiguredAiQueryProvider();
        }

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
