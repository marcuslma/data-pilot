import { BadRequestException } from '@nestjs/common';
import { DataSourceAdapter } from './data-source.adapter.js';
import { DataSourceKind } from './data-source.types.js';
import { DataSourceRegistry } from './data-source.registry.js';

describe('DataSourceRegistry', () => {
  const postgresAdapter: DataSourceAdapter = {
    kind: 'postgres',
    inspect: async () => ({ kind: 'postgres', namespaces: [] }),
    execute: async () => ({ kind: 'postgres', rows: [], returnedCount: 0 }),
  };
  const mongodbAdapter: DataSourceAdapter = {
    kind: 'mongodb',
    inspect: async () => ({ kind: 'mongodb', namespaces: [] }),
    execute: async () => ({ kind: 'mongodb', rows: [], returnedCount: 0 }),
  };

  it('returns the adapter for the requested source kind', () => {
    const registry = new DataSourceRegistry([postgresAdapter, mongodbAdapter]);

    expect(registry.get('postgres')).toBe(postgresAdapter);
  });

  it('rejects an unsupported source kind without exposing details', () => {
    const registry = new DataSourceRegistry([postgresAdapter, mongodbAdapter]);

    expect(() => registry.get('unknown' as DataSourceKind)).toThrow(
      new BadRequestException('Unsupported data source kind.'),
    );
  });
});
