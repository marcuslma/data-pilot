import { fingerprintValue } from '../data-sources/value-profiling.js';
import type {
  DataSourceFieldProfile,
  DetailedDataSourceInspection,
} from '../data-sources/data-source.types.js';
import { RelationshipSuggestionEngine } from './relationship-suggestion.engine.js';

describe('RelationshipSuggestionEngine', () => {
  it('suggests a customer key to order foreign key with evidence and cardinality', () => {
    const suggestions = new RelationshipSuggestionEngine().suggest([
      inspection(
        'crm',
        field(
          'public',
          'customers',
          'id',
          ['uuid'],
          ['identifier'],
          true,
          true,
          ['customer-1', 'customer-2'],
        ),
      ),
      inspection(
        'billing',
        field(
          'billing',
          'orders',
          'customer_id',
          ['uuid'],
          ['identifier'],
          false,
          false,
          ['customer-1', 'customer-2', 'customer-3'],
        ),
      ),
    ]);

    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        cardinality: 'one-to-many',
        operator: 'equals',
        evidence: expect.arrayContaining([
          'compatible_types',
          'key_match',
          'value_overlap',
        ]),
      }),
    );
    expect(suggestions[0]?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('does not suggest incompatible fields or a bare id from type alone', () => {
    expect(
      new RelationshipSuggestionEngine().suggest([
        inspection(
          'one',
          field('public', 'users', 'id', ['integer'], ['number'], false, false, []),
        ),
        inspection(
          'two',
          field('public', 'events', 'id', ['text'], ['text'], false, false, []),
        ),
      ]),
    ).toEqual([]);

    expect(
      new RelationshipSuggestionEngine().suggest([
        inspection(
          'one',
          field('public', 'users', 'id', ['integer'], ['number'], false, false, []),
        ),
        inspection(
          'two',
          field('public', 'events', 'id', ['integer'], ['number'], false, false, []),
        ),
      ]),
    ).toEqual([]);
  });

  it('deduplicates and deterministically caps suggestions at one hundred', () => {
    const inspections = Array.from({ length: 15 }, (_, sourceIndex) =>
      inspection(
        `source-${sourceIndex}`,
        field(
          'public',
          'customers',
          'customer_id',
          ['uuid'],
          ['identifier'],
          false,
          false,
          ['customer-1'],
        ),
      ),
    );
    const engine = new RelationshipSuggestionEngine();
    const suggestions = engine.suggest(inspections);

    expect(suggestions).toHaveLength(100);
    expect(suggestions).toEqual(engine.suggest(inspections));
    expect(
      new Set(
        suggestions.map(({ left, right }) =>
          [
            left.sourceId,
            left.namespace,
            left.entity,
            left.field,
            right.sourceId,
            right.namespace,
            right.entity,
            right.field,
          ].join(':')),
      ),
    ).toHaveLength(100);
  });
});

function inspection(
  sourceId: string,
  ...fieldProfiles: DataSourceFieldProfile[]
): { sourceId: string; inspection: DetailedDataSourceInspection } {
  return {
    sourceId,
    inspection: {
      catalog: { kind: 'postgres', namespaces: [] },
      fieldProfiles,
    },
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
