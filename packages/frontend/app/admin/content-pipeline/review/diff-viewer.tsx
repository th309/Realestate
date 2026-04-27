function violationReasonLabel(reason: string): string {
  switch (reason) {
    case "unmatched":
      return "no matching number in the data bundle (within tolerance)";
    case "out_of_tolerance":
      return "matched a number but context disagrees (e.g. wrong rank for the named subject)";
    case "missing":
      return "expected value missing from comparison";
    default:
      return reason;
  }
}

function confidenceReasonLabel(
  reason: string,
  expectedLetter: string | null | undefined,
): string {
  switch (reason) {
    case "confidence_mismatch":
      return expectedLetter
        ? `script names a different data-confidence letter than the bundle (${expectedLetter})`
        : "script states a confidence letter but the bundle has no letter to compare";
    case "confidence_stated_without_bundle":
      return "script mentions a confidence letter but the score bundle has no confidence field";
    default:
      return reason;
  }
}

export function DiffViewer({
  violations,
  confidenceViolations,
  waivedViolations,
}: {
  violations: Array<{
    claim: { quote: string; value: number; category: string };
    reason: string;
  }>;
  confidenceViolations?: Array<{
    quote: string;
    statedLetter: string;
    expectedLetter?: string | null;
    reason: string;
  }>;
  /** Claims logged but waived by verification policy (audit trail; any format). */
  waivedViolations?: Array<{
    claim: { quote: string; value: number; category: string };
    reason: string;
  }>;
}) {
  const hasNumeric = violations && violations.length > 0;
  const hasConfidence =
    confidenceViolations && confidenceViolations.length > 0;
  const hasWaived = waivedViolations && waivedViolations.length > 0;
  if (!hasNumeric && !hasConfidence && !hasWaived) return null;
  return (
    <div className="rounded-xl border border-warning bg-warning/5 p-4 mb-4 space-y-4">
      {hasNumeric ? (
        <div>
          <h4 className="font-semibold text-warning mb-2">
            Fact-check flagged these numeric claims:
          </h4>
          <ul className="space-y-3 text-sm list-none pl-0">
            {violations.map((v, i) => (
              <li key={i} className="border-l-2 border-warning pl-3">
                <p className="text-on-surface">
                  &quot;<strong>{v.claim.quote}</strong>&quot;
                </p>
                <p className="text-on-surface-variant mt-1">
                  Category: {v.claim.category}, value stated:{" "}
                  <span className="font-mono">{v.claim.value}</span>
                </p>
                <p className="text-on-surface mt-1">
                  Why: {violationReasonLabel(v.reason)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasConfidence ? (
        <div>
          <h4 className="font-semibold text-warning mb-2">
            Data-confidence wording:
          </h4>
          <ul className="space-y-3 text-sm list-none pl-0">
            {confidenceViolations!.map((c, i) => (
              <li key={i} className="border-l-2 border-warning pl-3">
                <p className="text-on-surface">
                  &quot;<strong>{c.quote}</strong>&quot;
                </p>
                <p className="text-on-surface-variant mt-1">
                  Script letter:{" "}
                  <span className="font-mono">{c.statedLetter}</span>
                  {c.expectedLetter != null && c.expectedLetter !== "" ? (
                    <>
                      {" "}
                      · Bundle letter:{" "}
                      <span className="font-mono">{c.expectedLetter}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-on-surface mt-1">
                  Why: {confidenceReasonLabel(c.reason, c.expectedLetter)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasWaived ? (
        <div className="text-sm text-on-surface-variant">
          <p className="font-medium text-on-surface mb-1">
            Waived by verification policy (audit only)
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {waivedViolations!.map((v, i) => (
              <li key={i}>
                &quot;{v.claim.quote}&quot; ({v.claim.category})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
