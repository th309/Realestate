/**
 * Drafting a video's on-screen copy.
 *
 * The endpoint is deliberately forgiving: a model failure comes back as 200
 * with empty fields and a reason, never an error status, because an
 * operator must always be able to write their own copy and continue.
 */

export interface CopySuggestContext {
  productName?: string;
  featureNames?: string[];
  marketName?: string;
  notes?: string;
}

export interface CopySuggestResult {
  /** Arrays for fields that declare variants; strings otherwise. */
  fields: Record<string, string | string[]>;
  cost_usd: number;
  /** True when nothing was generated — every field comes back empty. */
  degraded?: boolean;
  reason?: string;
}

export async function suggestCopy(input: {
  formatKey: string;
  itemCount?: number;
  context?: CopySuggestContext;
}): Promise<CopySuggestResult> {
  const res = await fetch("/api/admin/content-pipeline/copy-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    // The endpoint degrades rather than erroring, so a non-2xx here is a
    // genuine transport or auth problem — say so instead of silently
    // handing back blanks the operator would mistake for a bad draft.
    throw new Error(`Could not reach the copy service (${res.status})`);
  }

  return (await res.json()) as CopySuggestResult;
}
