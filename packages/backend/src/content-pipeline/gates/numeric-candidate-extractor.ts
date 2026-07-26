// packages/backend/src/content-pipeline/gates/numeric-candidate-extractor.ts
import {
  augmentCandidatesWithDerivedDeltas,
  augmentCandidatesWithPopulationScales,
} from './fact-verification-policies';

/**
 * Flattens every number a script could legitimately be quoting out of the MCP
 * data bundle, then augments the set with policy-derived values (deltas,
 * population scales) so derived phrasings can still match.
 */
export function extractNumericCandidates(payload: unknown): number[] {
  const out: number[] = [];
  const visit = (v: unknown) => {
    if (typeof v === 'number') out.push(v);
    else if (typeof v === 'string') {
      // ISO date-like strings contribute a year value so date claims can match.
      const isoMatch = v.match(/\b(19|20)\d{2}\b/);
      if (isoMatch) out.push(parseInt(isoMatch[0], 10));
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(payload);
  const withDerived = augmentCandidatesWithDerivedDeltas(payload, out);
  return augmentCandidatesWithPopulationScales(withDerived);
}
