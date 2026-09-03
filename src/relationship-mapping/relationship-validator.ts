import { BadRequestException } from '@nestjs/common';
import type {
  DataSourceFieldProfile,
} from '../data-sources/data-source.types.js';
import type {
  NamedDataSourceInspection,
  RelationshipDefinition,
  RelationshipEndpoint,
} from './relationship-mapping.types.js';

const CARDINALITIES = new Set([
  'one-to-one',
  'one-to-many',
  'many-to-one',
  'many-to-many',
]);
const JOIN_TYPES = new Set(['inner', 'left']);

export class RelationshipValidator {
  validate(
    relationships: RelationshipDefinition[],
    inspections: NamedDataSourceInspection[],
  ): RelationshipDefinition[] {
    const profiles = this.indexProfiles(inspections);
    const relationshipKeys = new Set<string>();

    return relationships.map((relationship) => {
      const normalized = normalizeRelationship(relationship);

      if (!isValidDefinition(normalized)) {
        throw new BadRequestException('Invalid relationship definition.');
      }

      const leftProfile = profiles.get(endpointKey(normalized.left));
      const rightProfile = profiles.get(endpointKey(normalized.right));

      if (!leftProfile || !rightProfile) {
        throw new BadRequestException('Relationship endpoint does not exist.');
      }

      if (!hasCompatibleTypes(leftProfile, rightProfile)) {
        throw new BadRequestException(
          'Relationship fields have incompatible types.',
        );
      }

      const key = relationshipKey(normalized);
      if (relationshipKeys.has(key)) {
        throw new BadRequestException('Duplicate relationship.');
      }

      relationshipKeys.add(key);
      return normalized;
    });
  }

  private indexProfiles(
    inspections: NamedDataSourceInspection[],
  ): Map<string, DataSourceFieldProfile> {
    const profiles = new Map<string, DataSourceFieldProfile>();

    inspections.forEach(({ sourceId, inspection }) => {
      inspection.fieldProfiles.forEach((profile) => {
        profiles.set(
          endpointKey({
            sourceId,
            namespace: profile.namespace,
            entity: profile.entity,
            field: profile.path,
          }),
          profile,
        );
      });
    });

    return profiles;
  }
}

function normalizeRelationship(
  relationship: RelationshipDefinition,
): RelationshipDefinition {
  return {
    ...relationship,
    left: normalizeEndpoint(relationship.left),
    right: normalizeEndpoint(relationship.right),
  };
}

function normalizeEndpoint(endpoint: RelationshipEndpoint): RelationshipEndpoint {
  return {
    sourceId: endpoint.sourceId.trim(),
    namespace: endpoint.namespace.trim(),
    entity: endpoint.entity.trim(),
    field: endpoint.field.trim(),
  };
}

function isValidDefinition(relationship: RelationshipDefinition): boolean {
  return (
    relationship.operator === 'equals' &&
    CARDINALITIES.has(relationship.cardinality) &&
    JOIN_TYPES.has(relationship.joinType) &&
    isValidEndpoint(relationship.left) &&
    isValidEndpoint(relationship.right) &&
    relationship.left.sourceId !== relationship.right.sourceId
  );
}

function isValidEndpoint(endpoint: RelationshipEndpoint): boolean {
  return Boolean(
    endpoint.sourceId &&
      endpoint.namespace &&
      endpoint.entity &&
      endpoint.field,
  );
}

function hasCompatibleTypes(
  left: DataSourceFieldProfile,
  right: DataSourceFieldProfile,
): boolean {
  const rightFamilies = new Set(
    right.typeFamilies.filter((family) => family !== 'unknown'),
  );

  return left.typeFamilies.some(
    (family) => family !== 'unknown' && rightFamilies.has(family),
  );
}

function relationshipKey(relationship: RelationshipDefinition): string {
  return [
    endpointKey(relationship.left),
    endpointKey(relationship.right),
  ].sort().join('\u0001');
}

function endpointKey(endpoint: RelationshipEndpoint): string {
  return [
    endpoint.sourceId,
    endpoint.namespace,
    endpoint.entity,
    endpoint.field,
  ].join('\u0000');
}
