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

export interface GateResult {
  passed: boolean;
  violations: GateViolation[];
  llm_judge_response?: unknown;
}
