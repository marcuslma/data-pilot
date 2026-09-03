import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { vi } from 'vitest';
import type { DataSourceService } from '../data-sources/data-source.service.js';
import type { DetailedDataSourceInspection } from '../data-sources/data-source.types.js';
import type {
  RelationshipSuggestion,
  RelationshipDefinition,
} from './relationship-mapping.types.js';
import { RelationshipMappingService } from './relationship-mapping.service.js';
import type { RelationshipSuggestionEngine } from './relationship-suggestion.engine.js';
import type { RelationshipValidator } from './relationship-validator.js';

const dataSource = {
  validateSource: vi.fn(),
  inspectDetailed: vi.fn(),
};
const engine = {
  suggest: vi.fn(),
};
const validator = {
  validate: vi.fn(),
};

describe('RelationshipMappingService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dataSource.validateSource.mockImplementation((source: unknown) => source);
    dataSource.inspectDetailed.mockResolvedValue(emptyInspection());
    engine.suggest.mockReturnValue([]);
    validator.validate.mockImplementation(
      (relationships: RelationshipDefinition[]) => relationships,
    );
  });

  it('validates all sources before inspecting any source', async () => {
    dataSource.validateSource.mockImplementation(() => {
      throw new BadRequestException('Connection URL does not match the source kind.');
    });

    await expect(createService().suggest(validSuggestionRequest())).rejects.toThrow(
      'Connection URL does not match the source kind.',
    );
    expect(dataSource.inspectDetailed).not.toHaveBeenCalled();
  });

  it('rejects duplicate source IDs without inspecting sources', async () => {
    const request = validSuggestionRequest();
    request.sources[1].sourceId = request.sources[0].sourceId;

    await expect(createService().suggest(request)).rejects.toThrow(
      new BadRequestException('Duplicate source ID.'),
    );
    expect(dataSource.inspectDetailed).not.toHaveBeenCalled();
  });

  it('rejects a request above the ten-source limit', async () => {
    const request = validSuggestionRequest();
    request.sources.push(
      ...Array.from({ length: 9 }, (_, index) => ({
        sourceId: `source-${index + 3}`,
        source: {
          kind: 'postgres' as const,
          connectionUrl: `postgresql://localhost/source-${index + 3}`,
        },
      })),
    );

    await expect(createService().suggest(request)).rejects.toThrow(
      new BadRequestException('Too many data sources.'),
    );
    expect(dataSource.validateSource).not.toHaveBeenCalled();
    expect(dataSource.inspectDetailed).not.toHaveBeenCalled();
  });

  it('preserves source order and delegates suggestions from detailed inspections', async () => {
    const crmInspection = inspection('postgres');
    const billingInspection = inspection('mongodb');
    dataSource.inspectDetailed
      .mockResolvedValueOnce(crmInspection)
      .mockResolvedValueOnce(billingInspection);
    const suggestion = {} as RelationshipSuggestion;
    engine.suggest.mockReturnValue([suggestion]);

    const response = await createService().suggest(validSuggestionRequest());

    expect(response).toEqual({
      sources: [
        {
          sourceId: 'crm',
          kind: 'postgres',
          catalog: crmInspection.catalog,
        },
        {
          sourceId: 'billing',
          kind: 'mongodb',
          catalog: billingInspection.catalog,
        },
      ],
      suggestions: [suggestion],
    });
    expect(engine.suggest).toHaveBeenCalledWith([
      { sourceId: 'crm', inspection: crmInspection },
      { sourceId: 'billing', inspection: billingInspection },
    ]);
  });

  it('delegates corrected relationships to the validator', async () => {
    const relationships = [validRelationship()];
    validator.validate.mockReturnValue(relationships);

    await expect(
      createService().validate({
        ...validSuggestionRequest(),
        relationships,
      }),
    ).resolves.toEqual({ relationships });
    expect(validator.validate).toHaveBeenCalledWith(
      relationships,
      expect.arrayContaining([
        expect.objectContaining({ sourceId: 'crm' }),
        expect.objectContaining({ sourceId: 'billing' }),
      ]),
    );
  });

  it('does not replace a safe source-access error with a secret', async () => {
    dataSource.inspectDetailed.mockRejectedValue(
      new UnprocessableEntityException('Unable to access the PostgreSQL source.'),
    );

    await expect(createService().suggest(validSuggestionRequest())).rejects.toThrow(
      new UnprocessableEntityException('Unable to access the PostgreSQL source.'),
    );
  });
});

function createService(): RelationshipMappingService {
  return new RelationshipMappingService(
    dataSource as unknown as DataSourceService,
    engine as unknown as RelationshipSuggestionEngine,
    validator as unknown as RelationshipValidator,
  );
}

function validSuggestionRequest() {
  return {
    sources: [
      {
        sourceId: 'crm',
        source: {
          kind: 'postgres' as const,
          connectionUrl: 'postgresql://localhost/crm',
        },
      },
      {
        sourceId: 'billing',
        source: {
          kind: 'mongodb' as const,
          connectionUrl: 'mongodb://localhost/billing',
        },
      },
    ],
  };
}

function inspection(kind: 'postgres' | 'mongodb'): DetailedDataSourceInspection {
  return {
    catalog: { kind, namespaces: [] },
    fieldProfiles: [],
  };
}

function emptyInspection(): DetailedDataSourceInspection {
  return inspection('postgres');
}

function validRelationship(): RelationshipDefinition {
  return {
    left: {
      sourceId: 'crm',
      namespace: 'public',
      entity: 'customers',
      field: 'id',
    },
    right: {
      sourceId: 'billing',
      namespace: 'billing',
      entity: 'orders',
      field: 'customer_id',
    },
    operator: 'equals',
    cardinality: 'one-to-many',
    joinType: 'left',
  };
}
