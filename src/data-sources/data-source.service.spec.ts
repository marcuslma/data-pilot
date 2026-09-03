import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { vi } from 'vitest';
import { DataSourceRegistry } from './data-source.registry.js';
import { DataSourceService } from './data-source.service.js';

describe('DataSourceService native-query validation', () => {
  const registry = { get: vi.fn() } as unknown as DataSourceRegistry;
  const service = new DataSourceService(registry);

  beforeEach(() => {
    vi.mocked(registry.get).mockReset();
  });

  it('returns a valid PostgreSQL query without selecting an adapter', () => {
    const query = { language: 'sql', text: 'SELECT 1' } as const;

    expect(service.validateNativeQuery('postgres', query)).toEqual(query);
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('rejects a SQL query for MongoDB before selecting an adapter', () => {
    expect(() =>
      service.validateNativeQuery('mongodb', {
        language: 'sql',
        text: 'SELECT 1',
      }),
    ).toThrow(new BadRequestException('Invalid native query.'));
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('rejects unsafe native queries before selecting an adapter', () => {
    expect(() =>
      service.validateNativeQuery('postgres', {
        language: 'sql',
        text: 'SELECT 1; SELECT 2',
      }),
    ).toThrow(new BadRequestException('Invalid SQL statement.'));
    expect(() =>
      service.validateNativeQuery('mongodb', {
        language: 'mongo',
        operation: 'aggregate',
        collection: 'orders',
        pipeline: [{ $match: { $where: 'unsafe' } }],
      }),
    ).toThrow(
      new BadRequestException('MongoDB query contains an unsupported operator.'),
    );
    expect(registry.get).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5])(
    'rejects a MongoDB query with an invalid limit of %s',
    (limit) => {
      expect(() =>
        service.validateNativeQuery('mongodb', {
          language: 'mongo',
          operation: 'find',
          collection: 'orders',
          limit,
        }),
      ).toThrow(new BadRequestException('Invalid native query.'));
      expect(registry.get).not.toHaveBeenCalled();
    },
  );

  it('rejects a source whose protocol does not match its kind', () => {
    expect(() =>
      service.validateSource({
        kind: 'postgres',
        connectionUrl: 'mongodb://localhost/test',
      }),
    ).toThrow(
      new BadRequestException('Connection URL does not match the source kind.'),
    );
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('delegates detailed inspection only after source validation', async () => {
    const detailed = {
      catalog: { kind: 'postgres' as const, namespaces: [] },
      fieldProfiles: [],
    };
    const adapter = {
      inspectDetailed: vi.fn(async () => detailed),
    };
    vi.mocked(registry.get).mockReturnValue(adapter as never);

    await expect(
      service.inspectDetailed({
        kind: 'postgres',
        connectionUrl: 'postgresql://localhost/test',
      }),
    ).resolves.toEqual(detailed);

    expect(registry.get).toHaveBeenCalledWith('postgres');
    expect(adapter.inspectDetailed).toHaveBeenCalledWith({
      kind: 'postgres',
      connectionUrl: 'postgresql://localhost/test',
    });
  });

  it('hides detailed adapter access errors', async () => {
    const adapter = {
      inspectDetailed: vi.fn(async () => {
        throw new UnprocessableEntityException('private secret');
      }),
    };
    vi.mocked(registry.get).mockReturnValue(adapter as never);

    await expect(
      service.inspectDetailed({
        kind: 'postgres',
        connectionUrl: 'postgresql://localhost/test',
      }),
    ).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the PostgreSQL source.'),
    );
  });
});
