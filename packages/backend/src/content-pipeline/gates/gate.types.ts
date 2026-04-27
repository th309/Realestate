// packages/backend/src/content-pipeline/gates/gate.types.ts
export interface NumericClaim {
  quote: string;
  value: number;
  category:
    | 'price'
    | 'percentage'
    | 'score'
    | 'ranking'
    | 'count'
    | 'date'
    | 'duration';
  subject: string;
}

export interface GateViolation {
  claim: NumericClaim;
  expected_from_data?: number;
  actual_in_script: number;
  reason: 'unmatched' | 'out_of_tolerance' | 'missing';
}

/** Script stated a data-confidence letter (A–F) that must match bundle.score.confidence. */
export interface ConfidenceLetterViolation {
  quote: string;
  statedLetter: string;
  expectedLetter: string | null;
  reason: 'confidence_mismatch' | 'confidence_stated_without_bundle';
}

export interface GateResult {
  passed: boolean;
  violations: GateViolation[];
  /**
   * Data-quality confidence letters (A–F) mentioned in prose vs bundle.score.confidence.
   */
  confidenceViolations?: ConfidenceLetterViolation[];
  /**
   * Claims that failed strict MCP-only matching but were allowed by an
   * explicit policy (e.g. long-form national metro rank). Logged for audit.
   */
  waivedViolations?: GateViolation[];
  llm_judge_response?: unknown;
  // Passed, but the gate wants a human to eyeball the run before it goes
  // public — e.g. Gate B judge gave exactly the minimum score, or a
  // future Gate A near-miss tolerance tripped. Pipeline uses this to
  // force approval_mode=review for this one run even if the format's
  // default is auto or draft.
  warned?: boolean;
}
