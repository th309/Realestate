// packages/backend/src/content-pipeline/gates/ranking-claim-verifier.ts
import type { NumericClaim } from './gate.types';

function extractRankedEntries(
  obj: unknown,
): Array<{ rank: number; name: string }> {
  const out: Array<{ rank: number; name: string }> = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (
          item &&
          typeof item === 'object' &&
          typeof item.rank === 'number' &&
          typeof item.name === 'string'
        ) {
          out.push({
            rank: item.rank,
            name: item.name,
          });
        } else {
          visit(item);
        }
      }
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(visit);
    }
  };
  visit(obj);
  return out;
}

/**
 * A ranking claim naming a specific subject must match that subject's rank in
 * the bundle — a coincidental numeric match elsewhere in the payload is still
 * a hallucination.
 */
export function isHallucinatedRanking(
  claim: NumericClaim,
  mcpPayload: unknown,
): boolean {
  const subject = (claim.subject ?? '').trim();
  if (!subject || subject === 'unknown') return false;
  const entries = extractRankedEntries(mcpPayload);
  if (entries.length === 0) return false;
  const subjectLc = subject.toLowerCase();
  const match = entries.find((e) => e.name.toLowerCase().includes(subjectLc));
  if (!match) return true;
  return match.rank !== claim.value;
}
