import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSourceService } from '../data-sources/data-source.service.js';
import type {
  DetailedDataSourceInspection,
} from '../data-sources/data-source.types.js';
import type {
  RelationshipSuggestionsRequest,
  RelationshipValidationRequest,
} from './relationship-mapping.schemas.js';
import type {
  NamedDataSourceInspection,
  RelationshipSuggestionsResponse,
  RelationshipValidationResponse,
} from './relationship-mapping.types.js';
import { RelationshipSuggestionEngine } from './relationship-suggestion.engine.js';
import { RelationshipValidator } from './relationship-validator.js';

const MAX_SOURCES = 10;

@Injectable()
export class RelationshipMappingService {
  constructor(
    private readonly dataSourceService: DataSourceService,
    private readonly suggestionEngine: RelationshipSuggestionEngine,
    private readonly relationshipValidator: RelationshipValidator,
  ) {}

  async suggest(
    request: RelationshipSuggestionsRequest,
  ): Promise<RelationshipSuggestionsResponse> {
    const inspections = await this.inspectSources(request.sources);

    return {
      sources: inspections.map(({ sourceId, inspection }) => ({
        sourceId,
        kind: inspection.catalog.kind,
        catalog: inspection.catalog,
      })),
      suggestions: this.suggestionEngine.suggest(inspections),
    };
  }

  async validate(
    request: RelationshipValidationRequest,
  ): Promise<RelationshipValidationResponse> {
    const inspections = await this.inspectSources(request.sources);

    return {
      relationships: this.relationshipValidator.validate(
        request.relationships,
        inspections,
      ),
    };
  }

  private async inspectSources(
    sources: RelationshipSuggestionsRequest['sources'],
  ): Promise<NamedDataSourceInspection[]> {
    if (sources.length > MAX_SOURCES) {
      throw new BadRequestException('Too many data sources.');
    }

    const sourceIds = new Set<string>();
    sources.forEach(({ sourceId }) => {
      if (sourceIds.has(sourceId)) {
        throw new BadRequestException('Duplicate source ID.');
      }
      sourceIds.add(sourceId);
    });

    sources.forEach(({ source }) => {
      this.dataSourceService.validateSource(source);
    });

    return Promise.all(
      sources.map(async ({ sourceId, source }) => ({
        sourceId,
        inspection: await this.inspectSource(source),
      })),
    );
  }

  private async inspectSource(
    source: RelationshipSuggestionsRequest['sources'][number]['source'],
  ): Promise<DetailedDataSourceInspection> {
    return this.dataSourceService.inspectDetailed(source);
  }
}
