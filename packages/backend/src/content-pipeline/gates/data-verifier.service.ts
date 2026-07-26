// packages/backend/src/content-pipeline/gates/data-verifier.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GateResult, GateViolation } from './gate.types';
import type { DataVerifierVerifyOptions } from './fact-verification-policies';
import { waiveUnmatchedLongFormGeneralKnowledge } from './fact-verification-policies';
import { extractNumericClaims } from './claim-extraction';
import { extractNumericCandidates } from './numeric-candidate-extractor';
import { toleranceForClaim } from './claim-tolerance';
import { findMatchingCandidate } from './claim-candidate-matcher';
import { isHallucinatedRanking } from './ranking-claim-verifier';
import { verifyConfidenceConsistency } from './confidence-consistency-verifier';

/**
 * Gate A. Every numeric claim a script makes must trace back to a value in the
 * run's MCP data bundle, within a category-appropriate tolerance.
 */
@Injectable()
export class DataVerifierService {
  private readonly logger = new Logger(DataVerifierService.name);

  async verify(
    scriptText: string,
    mcpPayload: unknown,
    options?: DataVerifierVerifyOptions,
  ): Promise<GateResult> {
    const claims = (await extractNumericClaims(scriptText, this.logger)) ?? [];
    const violations: GateViolation[] = [];
    const candidates = extractNumericCandidates(mcpPayload);
    this.logger.log(
      `[V2] verify: ${claims.length} claims vs ${candidates.length} candidates sample=${JSON.stringify(candidates.slice(0, 10))}`,
    );
    for (const claim of claims) {
      const tolerance = toleranceForClaim(claim);
      this.logger.log(
        `[V2]   claim val=${claim.value} cat=${claim.category} tol=${tolerance}`,
      );
      const hit = findMatchingCandidate(claim, candidates, tolerance);
      if (hit === undefined) {
        violations.push({
          claim,
          actual_in_script: claim.value,
          reason: 'unmatched',
        });
      } else if (
        claim.category === 'ranking' &&
        isHallucinatedRanking(claim, mcpPayload)
      ) {
        // Value coincidentally matched, but the subject's real rank differs.
        violations.push({
          claim,
          actual_in_script: claim.value,
          reason: 'out_of_tolerance',
        });
      }
    }

    const confidenceViolations = verifyConfidenceConsistency(
      scriptText,
      mcpPayload,
    );

    const waived: GateViolation[] = [];
    const kept: GateViolation[] = [];
    for (const v of violations) {
      if (waiveUnmatchedLongFormGeneralKnowledge(v)) waived.push(v);
      else kept.push(v);
    }
    if (waived.length > 0) {
      this.logger.log(
        `[V2] verify: waived ${waived.length} off-bundle context claim(s) (${options?.contentFormat ?? 'any'}); ${kept.length} remaining`,
      );
    }
    const passed = kept.length === 0 && confidenceViolations.length === 0;
    return {
      passed,
      violations: kept,
      confidenceViolations:
        confidenceViolations.length > 0 ? confidenceViolations : undefined,
      waivedViolations: waived.length > 0 ? waived : undefined,
    };
  }
}
