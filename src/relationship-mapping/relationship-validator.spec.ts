import { BadRequestException } from '@nestjs/common';
import { fingerprintValue } from '../data-sources/value-profiling.js';
import type {
  DataSourceFieldProfile,
  DetailedDataSourceInspection,
} from '../data-sources/data-source.types.js';
import type {
  NamedDataSourceInspection,
  RelationshipDefinition,
} from './relationship-mapping.types.js';
import { RelationshipValidator } from './relationship-validator.js';

describe('RelationshipValidator', () => {
  it('returns a normalized valid relationship', () => {
    const relationship = validRelationship();

    expect(
      new RelationshipValidator().validate([relationship], inspections()),
    ).toEqual([relationship]);
  });

  it('rejects unknown endpoints and incompatible type families', () => {
    const relationship = validRelationship();

    expect(() =>
      new RelationshipValidator().validate(
        [
          {
            ...relationship,
            right: { ...relationship.right, field: 'missing' },
          },
        ],
        inspections(),
      ),
    ).toThrow(new BadRequestException('Relationship endpoint does not exist.'));

    expect(() =>
      new RelationshipValidator().validate(
        [
          {
            ...relationship,
            right: { ...relationship.right, field: 'created_at' },
          },
        ],
        inspections(),
      ),
    ).toThrow(
      new BadRequestException('Relationship fields have incompatible types.'),
    );
  });

  it('rejects duplicate relationships regardless of endpoint order', () => {
    const relationship = validRelationship();

    expect(() =>
      new RelationshipValidator().validate(
        [
          relationship,
          {
            ...relationship,
            left: relationship.right,
            right: relationship.left,
          },
        ],
        inspections(),
      ),
    ).toThrow(new BadRequestException('Duplicate relationship.'));
  });

  it('rejects invalid definitions when called without the HTTP schema', () => {
    const relationship = validRelationship() as RelationshipDefinition & {
      operator: string;
    };
    relationship.operator = 'contains';

    expect(() =>
      new RelationshipValidator().validate([relationship], inspections()),
    ).toThrow(new BadRequestException('Invalid relationship definition.'));
  });
});

function inspections(): NamedDataSourceInspection[] {
  return [
    {
      sourceId: 'crm',
      inspection: inspection([
        field('public', 'customers', 'id', ['uuid'], ['identifier'], true, true, [
          'customer-1',
        ]),
        field('public', 'customers', 'email', ['text'], ['text'], false, true, []),
      ]),
    },
    {
      sourceId: 'billing',
      inspection: inspection([
        field(
          'billing',
          'orders',
          'customer_id',
          ['uuid'],
          ['identifier'],
          false,
          false,
          ['customer-1'],
        ),
        field(
          'billing',
          'orders',
          'created_at',
          ['timestamp without time zone'],
          ['date'],
          false,
          false,
          [],
        ),
      ]),
    },
  ];
}

function inspection(
  fieldProfiles: DataSourceFieldProfile[],
): DetailedDataSourceInspection {
  return {
    catalog: { kind: 'postgres', namespaces: [] },
    fieldProfiles,
  };
}

function field(
  namespace: string,
  entity: string,
  path: string,
  types: string[],
  typeFamilies: DataSourceFieldProfile['typeFamilies'],
  primaryKey: boolean,
  unique: boolean,
  values: string[],
): DataSourceFieldProfile {
  const valueFingerprints = values
    .map((value) => fingerprintValue(value))
    .filter((value): value is string => value !== undefined);

  return {
    namespace,
    entity,
    path,
    types,
    typeFamilies,
    primaryKey,
    unique,
    nullable: false,
    valueFingerprints,
    sampledValueCount: values.length,
    distinctSampleCount: new Set(valueFingerprints).size,
  };
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
