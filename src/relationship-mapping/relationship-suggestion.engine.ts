import type {
  DataSourceFieldProfile,
} from '../data-sources/data-source.types.js';
import type {
  NamedDataSourceInspection,
  RelationshipCardinality,
  RelationshipEvidence,
  RelationshipSuggestion,
} from './relationship-mapping.types.js';

const MAX_SUGGESTIONS = 100;
const MIN_CONFIDENCE = 0.45;
const TYPE_SCORE = 0.2;
const NAME_SCORE = 0.3;
const KEY_SCORE = 0.2;
const VALUE_SCORE = 0.3;

interface ProfileWithSource {
  sourceId: string;
  profile: DataSourceFieldProfile;
}

export class RelationshipSuggestionEngine {
  suggest(inspections: NamedDataSourceInspection[]): RelationshipSuggestion[] {
    const fields = inspections.flatMap(({ sourceId, inspection }) =>
      inspection.fieldProfiles.map((profile) => ({ sourceId, profile })),
    );
    const suggestions: RelationshipSuggestion[] = [];

    for (let leftIndex = 0; leftIndex < fields.length; leftIndex += 1) {
      const left = fields[leftIndex];
      if (!left) {
        continue;
      }

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < fields.length;
        rightIndex += 1
      ) {
        const right = fields[rightIndex];
        if (!right || left.sourceId === right.sourceId) {
          continue;
        }

        const suggestion = this.createSuggestion(left, right);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions
      .sort(compareSuggestions)
      .slice(0, MAX_SUGGESTIONS);
  }

  private createSuggestion(
    left: ProfileWithSource,
    right: ProfileWithSource,
  ): RelationshipSuggestion | undefined {
    if (!hasCompatibleTypes(left.profile, right.profile)) {
      return undefined;
    }

    const nameSimilarity = nameSimilarityFor(left.profile, right.profile);
    const keyMatch = hasKeySignal(left.profile, right.profile);
    const valueOverlap = jaccardSimilarity(
      left.profile.valueFingerprints,
      right.profile.valueFingerprints,
    );
    const hasMeaningfulSignal = nameSimilarity > 0 || keyMatch || valueOverlap > 0;

    if (!hasMeaningfulSignal) {
      return undefined;
    }

    const confidence =
      TYPE_SCORE +
      nameSimilarity * NAME_SCORE +
      (keyMatch ? KEY_SCORE : 0) +
      valueOverlap * VALUE_SCORE;

    if (confidence < MIN_CONFIDENCE) {
      return undefined;
    }

    const evidence: RelationshipEvidence[] = ['compatible_types'];
    if (nameSimilarity > 0) {
      evidence.push('name_match');
    }
    if (keyMatch) {
      evidence.push('key_match');
    }
    if (valueOverlap > 0) {
      evidence.push('value_overlap');
    }

    return {
      left: endpointFor(left),
      right: endpointFor(right),
      operator: 'equals',
      cardinality: cardinalityFor(left.profile, right.profile),
      joinType: 'inner',
      confidence: roundConfidence(confidence),
      evidence,
    };
  }
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

function nameSimilarityFor(
  left: DataSourceFieldProfile,
  right: DataSourceFieldProfile,
): number {
  const leftTokens = new Set(nameTokens(left));
  const rightTokens = new Set(nameTokens(right));
  const unionSize = new Set([...leftTokens, ...rightTokens]).size;

  if (unionSize === 0) {
    return 0;
  }

  const intersectionSize = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;

  return intersectionSize / unionSize;
}

function nameTokens(profile: DataSourceFieldProfile): string[] {
  return `${profile.entity}.${profile.path}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 0 && token !== 'id' && token !== 'key')
    .map((token) => singularize(token));
}

function singularize(token: string): string {
  if (token.length > 3 && token.endsWith('s')) {
    return token.slice(0, -1);
  }

  return token;
}

function hasKeySignal(
  left: DataSourceFieldProfile,
  right: DataSourceFieldProfile,
): boolean {
  return left.primaryKey || left.unique || right.primaryKey || right.unique;
}

function jaccardSimilarity(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  const intersectionSize = [...leftSet].filter((value) =>
    rightSet.has(value),
  ).length;
  const unionSize = new Set([...leftSet, ...rightSet]).size;

  return intersectionSize / unionSize;
}

function cardinalityFor(
  left: DataSourceFieldProfile,
  right: DataSourceFieldProfile,
): RelationshipCardinality {
  const leftUnique = left.primaryKey || left.unique;
  const rightUnique = right.primaryKey || right.unique;

  if (leftUnique && rightUnique) {
    return 'one-to-one';
  }
  if (leftUnique) {
    return 'one-to-many';
  }
  if (rightUnique) {
    return 'many-to-one';
  }

  return 'many-to-many';
}

function endpointFor(field: ProfileWithSource) {
  return {
    sourceId: field.sourceId,
    namespace: field.profile.namespace,
    entity: field.profile.entity,
    field: field.profile.path,
  };
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function compareSuggestions(
  left: RelationshipSuggestion,
  right: RelationshipSuggestion,
): number {
  return (
    right.confidence - left.confidence ||
    endpointKey(left).localeCompare(endpointKey(right))
  );
}

function endpointKey(suggestion: RelationshipSuggestion): string {
  return [
    suggestion.left,
    suggestion.right,
  ]
    .map(({ sourceId, namespace, entity, field }) =>
      [sourceId, namespace, entity, field].join('\u0000'),
    )
    .join('\u0001');
}
