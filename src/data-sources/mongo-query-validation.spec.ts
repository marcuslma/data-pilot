import { BadRequestException } from '@nestjs/common';
import {
  assertSafeMongoQuery,
  inferDocumentFields,
} from './mongo-query-validation.js';

describe('assertSafeMongoQuery', () => {
  it('accepts ordinary nested filters and pipelines', () => {
    expect(() =>
      assertSafeMongoQuery({
        customer: { address: { city: 'Sao Paulo' } },
        $and: [{ total: { $gte: 10 } }],
      }),
    ).not.toThrow();
    expect(() =>
      assertSafeMongoQuery([
        { $match: { customer: { address: { city: 'Sao Paulo' } } } },
      ]),
    ).not.toThrow();
  });

  it.each(['$out', '$merge', '$function', '$accumulator', '$where'])(
    'rejects %s when nested inside an array',
    (operator) => {
      expect(() =>
        assertSafeMongoQuery({ $and: [{ nested: { [operator]: 'unsafe' } }] }),
      ).toThrow(
        new BadRequestException(
          'MongoDB query contains an unsupported operator.',
        ),
      );
    },
  );
});

describe('inferDocumentFields', () => {
  it('infers sorted nested paths and types without retaining values', () => {
    expect(
      inferDocumentFields([
        {
          customer: {
            address: { city: 'Sao Paulo' },
            active: true,
          },
          tags: [{ name: 'priority' }],
        },
        {
          customer: {
            address: { city: 42 },
          },
          tags: [{ name: 'standard' }],
        },
      ]),
    ).toEqual([
      { path: 'customer', types: ['object'] },
      { path: 'customer.active', types: ['boolean'] },
      { path: 'customer.address', types: ['object'] },
      { path: 'customer.address.city', types: ['number', 'string'] },
      { path: 'tags', types: ['array'] },
      { path: 'tags.name', types: ['string'] },
    ]);
  });
});
