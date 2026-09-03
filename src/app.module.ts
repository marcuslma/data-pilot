import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AiQueryModule } from './ai-query/ai-query.module.js';
import {
  applicationConfigurationModule,
  bootstrapConfiguration,
} from './config/application-configuration.js';
import { DataSourcesModule } from './data-sources/data-sources.module.js';
import { getObserveConfiguration } from './observe.config.js';
import { RelationshipMappingModule } from './relationship-mapping/relationship-mapping.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();
const observeConfiguration = getObserveConfiguration(bootstrapConfiguration);
export const isObserveEnabled = observeConfiguration.enabled;

@Module({
  imports: observeConfiguration.enabled
    ? [
        applicationConfigurationModule,
        ObserveModule.forRoot(observeConfiguration.options),
        DataSourcesModule,
        AiQueryModule,
        RelationshipMappingModule,
      ]
    : [
        applicationConfigurationModule,
        DataSourcesModule,
        AiQueryModule,
        RelationshipMappingModule,
      ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
