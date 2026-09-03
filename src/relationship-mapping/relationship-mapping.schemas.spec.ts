import {
  relationshipSuggestionsRequestSchema,
  relationshipValidationRequestSchema,
} from './relationship-mapping.schemas.js';

describe('relationship mapping request schemas', () => {
  it('accepts two uniquely named supported sources', () => {
    expect(
      relationshipSuggestionsRequestSchema.parse({
        sources: [
          {
            sourceId: 'crm',
            source: {
              kind: 'postgres',
              connectionUrl: 'postgresql://localhost/crm',
            },
          },
          {
            sourceId: 'billing',
            source: {
              kind: 'mongodb',
              connectionUrl: 'mongodb://localhost/billing',
            },
          },
        ],
      }),
    ).toEqual({
      sources: [
        {
          sourceId: 'crm',
          source: {
            kind: 'postgres',
            connectionUrl: 'postgresql://localhost/crm',
          },
        },
        {
          sourceId: 'billing',
          source: {
            kind: 'mongodb',
            connectionUrl: 'mongodb://localhost/billing',
          },
        },
      ],
    });
  });

  it('rejects duplicate or malformed source IDs', () => {
    expect(() =>
      relationshipSuggestionsRequestSchema.parse({
        sources: [
          {
            sourceId: 'crm',
            source: {
              kind: 'postgres',
              connectionUrl: 'postgresql://localhost/crm',
            },
          },
          {
            sourceId: 'crm',
            source: {
              kind: 'postgres',
              connectionUrl: 'postgresql://localhost/other',
            },
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      relationshipSuggestionsRequestSchema.parse({
        sources: [
          {
            sourceId: 'not valid',
            source: {
              kind: 'postgres',
              connectionUrl: 'postgresql://localhost/crm',
            },
          },
          {
            sourceId: 'billing',
            source: {
              kind: 'mongodb',
              connectionUrl: 'mongodb://localhost/billing',
            },
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts corrected relationship definitions with an empty list', () => {
    expect(
      relationshipValidationRequestSchema.parse({
        sources: [
          {
            sourceId: 'crm',
            source: {
              kind: 'postgres',
              connectionUrl: 'postgresql://localhost/crm',
            },
          },
          {
            sourceId: 'billing',
            source: {
              kind: 'mongodb',
              connectionUrl: 'mongodb://localhost/billing',
            },
          },
        ],
        relationships: [],
      }).relationships,
    ).toEqual([]);
  });

  it('rejects unknown operators and unexpected relationship properties', () => {
    expect(() =>
      relationshipValidationRequestSchema.parse({
        sources: [
          {
            sourceId: 'crm',
            source: {
              kind: 'postgres',
              connectionUrl: 'postgresql://localhost/crm',
            },
          },
          {
            sourceId: 'billing',
            source: {
              kind: 'mongodb',
              connectionUrl: 'mongodb://localhost/billing',
            },
          },
        ],
        relationships: [
          {
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
            operator: 'contains',
            cardinality: 'one-to-many',
            joinType: 'left',
            extra: true,
          },
        ],
      }),
    ).toThrow();
  });
});
