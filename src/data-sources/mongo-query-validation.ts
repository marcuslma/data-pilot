import { BadRequestException } from '@nestjs/common';
import type { CatalogField } from './data-source.types.js';

const UNSUPPORTED_OPERATORS = new Set([
  '$out',
  '$merge',
  '$function',
  '$accumulator',
  '$where',
]);

export function assertSafeMongoQuery(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertSafeMongoQuery(item);
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (UNSUPPORTED_OPERATORS.has(key)) {
      throw new BadRequestException(
        'MongoDB query contains an unsupported operator.',
      );
    }
    assertSafeMongoQuery(nestedValue);
  }
}

export function inferDocumentFields(
  documents: Record<string, unknown>[],
): CatalogField[] {
  const fieldTypes = new Map<string, Set<string>>();

  for (const document of documents) {
    inspectObject(document, '', fieldTypes);
  }

  return [...fieldTypes.entries()]
    .map(([path, types]) => ({ path, types: [...types].sort() }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function inspectObject(
  value: Record<string, unknown>,
  prefix: string,
  fieldTypes: Map<string, Set<string>>,
): void {
  for (const [key, nestedValue] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    recordType(fieldTypes, path, typeName(nestedValue));

    if (isPlainObject(nestedValue)) {
      inspectObject(nestedValue, path, fieldTypes);
    } else if (Array.isArray(nestedValue)) {
      inspectArrayMembers(nestedValue, path, fieldTypes);
    }
  }
}

function inspectArrayMembers(
  values: unknown[],
  prefix: string,
  fieldTypes: Map<string, Set<string>>,
): void {
  for (const value of values) {
    if (isPlainObject(value)) {
      inspectObject(value, prefix, fieldTypes);
    } else if (Array.isArray(value)) {
      inspectArrayMembers(value, prefix, fieldTypes);
    }
  }
}

function recordType(
  fieldTypes: Map<string, Set<string>>,
  path: string,
  type: string,
): void {
  const types = fieldTypes.get(path) ?? new Set<string>();
  types.add(type);
  fieldTypes.set(path, types);
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
