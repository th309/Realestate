export function DiffViewer({
  violations,
}: {
  violations: Array<{
    claim: { quote: string; value: number; category: string };
    reason: string;
  }>;
}) {
  if (!violations || violations.length === 0) return null;
  return (
    <div className="rounded-xl border border-warning bg-warning/5 p-4 mb-4">
      <h4 className="font-semibold text-warning mb-2">
        Fact-check flagged these claims:
      </h4>
      <ul className="space-y-2 text-sm">
        {violations.map((v, i) => (
          <li key={i}>
            &quot;<strong>{v.claim.quote}</strong>&quot; ({v.claim.category},
            value {v.claim.value}): {v.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
