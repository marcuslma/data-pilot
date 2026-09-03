import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RuntimeAccessGuard } from '../data-sources/runtime-access.guard.js';
import {
  relationshipSuggestionsRequestSchema,
  relationshipValidationRequestSchema,
  type RelationshipSuggestionsRequest,
  type RelationshipValidationRequest,
} from './relationship-mapping.schemas.js';
import { RelationshipMappingService } from './relationship-mapping.service.js';

@Controller()
@UseGuards(RuntimeAccessGuard)
export class RelationshipMappingController {
  constructor(
    private readonly relationshipMappingService: RelationshipMappingService,
  ) {}

  @Post('relationship-suggestions')
  suggest(
    @Body({ schema: relationshipSuggestionsRequestSchema })
    body: RelationshipSuggestionsRequest,
  ) {
    return this.relationshipMappingService.suggest(body);
  }

  @Post('relationships/validate')
  validate(
    @Body({ schema: relationshipValidationRequestSchema })
    body: RelationshipValidationRequest,
  ) {
    return this.relationshipMappingService.validate(body);
  }
}
