import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DATA_SOURCE_ADAPTERS,
  type DataSourceAdapter,
} from './data-source.adapter.js';
import type { DataSourceKind } from './data-source.types.js';

@Injectable()
export class DataSourceRegistry {
  constructor(
    @Inject(DATA_SOURCE_ADAPTERS)
    private readonly adapters: DataSourceAdapter[],
  ) {}

  get(kind: DataSourceKind): DataSourceAdapter {
    const adapter = this.adapters.find((candidate) => candidate.kind === kind);

    if (!adapter) {
      throw new BadRequestException('Unsupported data source kind.');
    }

    return adapter;
  }
}
