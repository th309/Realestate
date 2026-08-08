/**
 * ANALYZER SAVED-DEAL PERSISTENCE
 *
 * Read/write access to `deal_analyses` — the saved-deal row behind the
 * analyzer's Save button, its autosave, and the public share link.
 *
 * Extracted out of `./analyzer` per CLAUDE.md §1.3 (300-line logic cap) and
 * re-exported from it, so consumer import paths are unchanged.
 *
 * The row has three columns with three different lifetimes, and the types
 * below are what keep them apart:
 *
 * | column            | written by                                    |
 * | ----------------- | --------------------------------------------- |
 * | `input_snapshot`  | Save, Notes-Save, Share, PDF, autosave         |
 * | `result_snapshot` | Share and PDF ONLY — the published artifact    |
 * | `market_context`  | the save that creates the row, then only an    |
 * |                   | explicit "Update market data"                  |
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface SavedAnalysis {
  id: string;
  share_token: string;
  label: string | null;
  address_full: string | null;
  address_city: string;
  address_state: string;
  address_zip: string | null;
  lat: number | null;
  lon: number | null;
  input_snapshot: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
  market_context: Record<string, unknown> | null;
  ai_verdict: Record<string, unknown> | null;
  created_at: string;
  /**
   * Load-bearing but easy to miss: `migrateDealState()` derives
   * `marketCapturedAt` — the staleness clock — from this. It reaches the
   * client only because `list()` and `getOne()` select `*`; narrow either of
   * those and every legacy deal silently dates to the epoch and shows a
   * "~20,600 days old" banner.
   *
   * OPTIONAL because it genuinely is absent on one path: `getShared()` goes
   * through the `get_shared_analysis` SECURITY DEFINER RPC, whose fixed
   * column list omits it (along with `share_token`, `address_full`, `lat`,
   * `lon`). Declaring it required would be a guarantee the share page cannot
   * keep.
   */
  updated_at?: string;
}

/**
 * What a plain **Save** may write: the deal's identity columns plus the
 * versioned `DealStateV2` working state.
 *
 * `result_snapshot` and `ai_verdict` are declared `?: never` rather than
 * simply omitted. Omitting them would leave `buildDealStatePayload()` free
 * to grow one back (excess-property checks only fire on object literals),
 * whereas `never` makes "a Save carries the published artifact" a type
 * error at the call site — which is the whole point of the split. Which
 * button may publish is a property of these types, not a convention call
 * sites are trusted to remember.
 */
export interface DealStatePayload {
  /**
   * Existing row to update, once one exists. Present once a deal has been
   * saved once — updates that row in place instead of falling back to the
   * `(owner, address)` upsert, which would create a second row the moment
   * the user edits a saved deal's address.
   */
  id?: string;
  /**
   * Projection of `DealStateV2.label`, so the column the saved-deals list
   * reads can never disagree with the name inside the state blob.
   */
  label: string | null;
  address_full: string | null;
  address_city: string;
  address_state: string;
  address_zip: string | null;
  lat: number | null;
  lon: number | null;
  /** A `DealStateV2`. See `app/analyzer/lib/deal-state-types.ts`. */
  input_snapshot: Record<string, unknown>;
  /**
   * Only sent on the save that CREATES the row (no `id`). A re-save omits
   * the key so the stored capture survives untouched — market context is a
   * point-in-time reading, refreshed only by "Update market data".
   */
  market_context?: Record<string, unknown> | null;
  result_snapshot?: never;
  ai_verdict?: never;
}

/**
 * A Save payload PLUS the frozen render artifact. Share and PDF only.
 *
 * `result_snapshot` is what the public share link and the PDF render from,
 * so writing it republishes a link that may already be in a client's hands.
 * Nothing but an explicit Share/PDF may construct this type.
 */
export type PublishedArtifactPayload = Omit<
  DealStatePayload,
  "result_snapshot" | "ai_verdict"
> & {
  result_snapshot: Record<string, unknown>;
  ai_verdict: Record<string, unknown> | null;
};

async function postSave(
  payload: DealStatePayload | PublishedArtifactPayload,
): Promise<{ id: string; share_token: string }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/save`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  return res.json();
}

/**
 * Persist a deal's state — the "Save deal" button and the Notes "Save".
 *
 * Writes the identity columns and `input_snapshot`; leaves `result_snapshot`
 * alone. `AnalysisSnapshotDto.result_snapshot` is optional on the backend
 * and the row update spreads only the keys it was sent, so an absent key is
 * a no-op rather than a NULL over the published artifact.
 *
 * Still resolves `{ id, share_token }` — every row has a token — but a Save
 * never surfaces it, so saving publishes nothing.
 */
export async function saveDealState(
  payload: DealStatePayload,
): Promise<{ id: string; share_token: string }> {
  return postSave(payload);
}

/**
 * Publish the frozen render artifact — Share and PDF only.
 *
 * Writes everything `saveDealState` does AND `result_snapshot`/`ai_verdict`,
 * which is exactly what the share page and the PDF render from.
 */
export async function publishAnalysis(
  payload: PublishedArtifactPayload,
): Promise<{ id: string; share_token: string }> {
  return postSave(payload);
}

export async function fetchSavedAnalyses(): Promise<SavedAnalysis[]> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/saved`, {
    credentials: "include",
    headers: { ...authHeaders },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSharedAnalysis(
  token: string,
): Promise<SavedAnalysis | null> {
  // Public endpoint — no auth headers needed; share token is the capability.
  const res = await fetch(`${API_URL}/api/analyzer/share/${token}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchSavedAnalysis(
  id: string,
): Promise<SavedAnalysis | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/saved/${id}`, {
    credentials: "include",
    headers: { ...authHeaders },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Autosave the working state of a saved deal.
 *
 * Writes `input_snapshot` and nothing else. Never returns a share token —
 * autosave deliberately does not publish, so a link already distributed to
 * a client keeps resolving to the version its owner chose to share.
 */
export async function patchDealState(
  id: string,
  inputSnapshot: Record<string, unknown>,
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/saved/${id}/state`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ input_snapshot: inputSnapshot }),
  });
  if (!res.ok) throw new Error(`autosave failed: ${res.status}`);
}
