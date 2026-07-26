// packages/backend/src/content-pipeline/post-images/post-image-format.ts
//
// Real-data value formatters for post-image templates. Each returns null for a
// non-finite input so a stat card never renders an invented / NaN number.

export function formatScore(n: number | null | undefined): string | null {
  return n != null && Number.isFinite(n) ? String(Math.round(n)) : null;
}

export function formatCurrencyCompact(
  n: number | null | undefined,
): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function formatPercent(
  n: number | null | undefined,
  signed = true,
): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function formatDelta(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n === 0) return null;
  const sign = n > 0 ? '+' : '−'; // real minus sign
  return `${sign}${Math.abs(Math.round(n))}`;
}
