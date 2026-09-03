import { Module } from '@nestjs/common';
import { DataSourcesModule } from '../data-sources/data-sources.module.js';
import { RelationshipMappingController } from './relationship-mapping.controller.js';
import { RelationshipMappingService } from './relationship-mapping.service.js';
import { RelationshipSuggestionEngine } from './relationship-suggestion.engine.js';
import { RelationshipValidator } from './relationship-validator.js';

@Module({
  imports: [DataSourcesModule],
  controllers: [RelationshipMappingController],
  providers: [
    RelationshipMappingService,
    RelationshipSuggestionEngine,
    RelationshipValidator,
  ],
})
export class RelationshipMappingModule {}
