import {
  fingerprintValue,
  profileDocumentFields,
} from './value-profiling.js';

describe('value profiling', () => {
  it('fingerprints equivalent scalar representations without returning the raw value', () => {
    const fingerprint = fingerprintValue(' Customer-42 ');

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintValue('customer-42')).toBe(fingerprint);
    expect(JSON.stringify(fingerprint)).not.toContain('customer-42');
  });

  it('omits objects, arrays, nulls, and oversized values from fingerprints', () => {
    expect(fingerprintValue({ id: 1 })).toBeUndefined();
    expect(fingerprintValue([1, 2])).toBeUndefined();
    expect(fingerprintValue(null)).toBeUndefined();
    expect(fingerprintValue(Number.NaN)).toBeUndefined();
    expect(fingerprintValue('x'.repeat(1_025))).toBeUndefined();
  });

  it('profiles nested document fields with bounded distinct fingerprints', () => {
    const profiles = profileDocumentFields([
      { customer: { id: 'C-1' }, total: 10 },
      { customer: { id: 'C-2' }, total: 12 },
      { customer: { id: 'C-1' }, total: null },
    ]);

    expect(profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'customer.id',
          sampledValueCount: 3,
          distinctSampleCount: 2,
        }),
        expect.objectContaining({
          path: 'total',
          sampledValueCount: 2,
          distinctSampleCount: 2,
        }),
      ]),
    );
    expect(JSON.stringify(profiles)).not.toContain('C-1');
  });

  it('caps field fingerprints at one hundred unique values', () => {
    const profiles = profileDocumentFields(
      Array.from({ length: 150 }, (_, index) => ({ id: `C-${index}` })),
    );

    expect(profiles[0]?.valueFingerprints).toHaveLength(100);
    expect(profiles[0]?.sampledValueCount).toBe(150);
    expect(profiles[0]?.distinctSampleCount).toBe(100);
  });
});
