import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RuntimeAccessGuard } from './runtime-access.guard.js';
import { DataSourceService } from './data-source.service.js';
import {
  catalogRequestSchema,
  type CatalogRequest,
  queryRequestSchema,
  type QueryRequest,
} from './data-source.schemas.js';

@Controller()
@UseGuards(RuntimeAccessGuard)
export class DataSourcesController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Post('catalog')
  inspect(@Body({ schema: catalogRequestSchema }) body: CatalogRequest) {
    return this.dataSourceService.inspect(body.source);
  }

  @Post('query')
  execute(@Body({ schema: queryRequestSchema }) body: QueryRequest) {
    return this.dataSourceService.execute(body.source, body.query);
  }
}
