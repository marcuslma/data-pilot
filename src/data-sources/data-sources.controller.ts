import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RuntimeAccessGuard } from './runtime-access.guard.js';
import { DataSourceService } from './data-source.service.js';
import { CatalogRequestDto } from './dto/catalog-request.dto.js';
import { QueryRequestDto } from './dto/query-request.dto.js';

@Controller()
@UseGuards(RuntimeAccessGuard)
export class DataSourcesController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Post('catalog')
  inspect(@Body() body: CatalogRequestDto) {
    return this.dataSourceService.inspect(body.source);
  }

  @Post('query')
  execute(@Body() body: QueryRequestDto) {
    return this.dataSourceService.execute(body.source, body.query);
  }
}
