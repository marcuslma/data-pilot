import { createHash } from 'node:crypto';
import type {
  DataSourceFieldProfile,
  ProfileTypeFamily,
} from './data-source.types.js';

const MAX_FINGERPRINTS = 100;
const MAX_VALUE_LENGTH = 1_024;

export interface DocumentFieldProfile {
  path: string;
  types: string[];
  nullable: boolean;
  valueFingerprints: string[];
  sampledValueCount: number;
  distinctSampleCount: number;
}

interface MutableDocumentFieldProfile {
  types: Set<string>;
  presentDocumentIndexes: Set<number>;
  hasNull: boolean;
  valueFingerprints: Set<string>;
  sampledValueCount: number;
}

export function fingerprintValue(value: unknown): string | undefined {
  const normalized = normalizeValue(value);

  if (normalized === undefined) {
    return undefined;
  }

  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function profileTypeFamilies(types: string[]): ProfileTypeFamily[] {
  const families = new Set<ProfileTypeFamily>();

  types.forEach((type) => {
    const normalized = type.toLowerCase();

    if (
      [
        'smallint',
        'integer',
        'bigint',
        'decimal',
        'numeric',
        'real',
        'double precision',
        'number',
        'int',
        'int32',
        'int64',
        'double',
      ].includes(normalized)
    ) {
      families.add('number');
    } else if (
      [
        'text',
        'character varying',
        'varchar',
        'character',
        'char',
        'string',
      ].includes(normalized)
    ) {
      families.add('text');
    } else if (normalized === 'boolean' || normalized === 'bool') {
      families.add('boolean');
    } else if (
      normalized === 'date' ||
      normalized.includes('timestamp') ||
      normalized === 'datetime'
    ) {
      families.add('date');
    } else if (
      normalized === 'uuid' ||
      normalized === 'objectid' ||
      normalized === 'objectidstring'
    ) {
      families.add('identifier');
    }
  });

  if (families.size === 0) {
    families.add('unknown');
  }

  return [...families].sort();
}

export function profileDocumentFields(
  documents: Record<string, unknown>[],
): DocumentFieldProfile[] {
  const profiles = new Map<string, MutableDocumentFieldProfile>();

  documents.forEach((document, documentIndex) => {
    inspectObject(document, '', documentIndex, profiles);
  });

  return [...profiles.entries()]
    .map(([path, profile]) => ({
      path,
      types: [...profile.types].sort(),
      nullable:
        profile.hasNull || profile.presentDocumentIndexes.size < documents.length,
      valueFingerprints: [...profile.valueFingerprints],
      sampledValueCount: profile.sampledValueCount,
      distinctSampleCount: profile.valueFingerprints.size,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function toDataSourceFieldProfile(
  profile: DocumentFieldProfile,
  location: { namespace: string; entity: string },
  options: { primaryKey?: boolean; unique?: boolean } = {},
): DataSourceFieldProfile {
  return {
    namespace: location.namespace,
    entity: location.entity,
    path: profile.path,
    types: profile.types,
    typeFamilies: profileTypeFamilies(profile.types),
    primaryKey: options.primaryKey ?? false,
    unique: options.unique ?? false,
    nullable: profile.nullable,
    valueFingerprints: profile.valueFingerprints,
    sampledValueCount: profile.sampledValueCount,
    distinctSampleCount: profile.distinctSampleCount,
  };
}

function inspectObject(
  value: Record<string, unknown>,
  prefix: string,
  documentIndex: number,
  profiles: Map<string, MutableDocumentFieldProfile>,
): void {
  for (const [key, nestedValue] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const profile = profiles.get(path) ?? {
      types: new Set<string>(),
      presentDocumentIndexes: new Set<number>(),
      hasNull: false,
      valueFingerprints: new Set<string>(),
      sampledValueCount: 0,
    };

    profile.types.add(typeName(nestedValue));
    profile.presentDocumentIndexes.add(documentIndex);

    if (nestedValue === null) {
      profile.hasNull = true;
    }

    const fingerprint = fingerprintValue(nestedValue);
    if (fingerprint !== undefined) {
      profile.sampledValueCount += 1;
      if (profile.valueFingerprints.size < MAX_FINGERPRINTS) {
        profile.valueFingerprints.add(fingerprint);
      }
    }

    profiles.set(path, profile);

    if (isPlainObject(nestedValue)) {
      inspectObject(nestedValue, path, documentIndex, profiles);
    } else if (Array.isArray(nestedValue)) {
      inspectArrayMembers(nestedValue, path, documentIndex, profiles);
    }
  }
}

function inspectArrayMembers(
  values: unknown[],
  prefix: string,
  documentIndex: number,
  profiles: Map<string, MutableDocumentFieldProfile>,
): void {
  values.forEach((value) => {
    if (isPlainObject(value)) {
      inspectObject(value, prefix, documentIndex, profiles);
    } else if (Array.isArray(value)) {
      inspectArrayMembers(value, prefix, documentIndex, profiles);
    }
  });
}

function normalizeValue(value: unknown): string | undefined {
  let normalized: string;

  if (typeof value === 'string') {
    normalized = value.trim().toLowerCase();
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    normalized = String(value);
  } else if (typeof value === 'boolean' || typeof value === 'bigint') {
    normalized = String(value);
  } else if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }
    normalized = value.toISOString();
  } else if (value !== null && typeof value === 'object' && isIdentifierObject(value)) {
    normalized = value.toString().trim().toLowerCase();
  } else {
    return undefined;
  }

  if (normalized.length === 0 || normalized.length > MAX_VALUE_LENGTH) {
    return undefined;
  }

  return normalized;
}

function isIdentifierObject(value: object): boolean {
  const constructorName = value.constructor?.name.toLowerCase();

  return (
    constructorName === 'objectid' ||
    constructorName === 'uuid' ||
    typeof (value as { toHexString?: unknown }).toHexString === 'function'
  );
}

function typeName(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (isPlainObject(value)) {
    return 'object';
  }
  if (value instanceof Date) {
    return 'date';
  }
  if (typeof value === 'object') {
    return value.constructor.name.toLowerCase();
  }
  return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
