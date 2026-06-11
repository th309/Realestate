/**
 * AI SHADOW MODE FETCHERS
 *
 * React Query hooks + mutations for the `/admin/ai-models/shadow` page.
 * Backed by `AiShadowController` at `/api/admin/ai-shadow/*`. All endpoints
 * are admin-only on the backend; this module assumes the caller is an
 * authenticated admin (the page guards it).
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types — match snake_case rows returned by the backend / Supabase.
// ---------------------------------------------------------------------------

export interface ShadowPair {
  id: string;
  request_id: string;
  purpose: string;
  primary_provider: string;
  primary_model: string;
  primary_output: string;
  primary_duration_ms: number | null;
  primary_cost_usd: number | null;
  primary_tokens_in: number | null;
  primary_tokens_out: number | null;
  shadow_provider: string;
  shadow_model: string;
  shadow_output: string | null;
  shadow_duration_ms: number | null;
  shadow_cost_usd: number | null;
  shadow_tokens_in: number | null;
  shadow_tokens_out: number | null;
  shadow_error: string | null;
  preferred: "primary" | "shadow" | "tie" | null;
  reviewer_note: string | null;
  input_preview: string | null;
  created_at: string;
}

export interface ShadowConfig {
  enabled: boolean;
  daily_usd_ceiling: number;
  updated_at?: string;
}

export interface PurposeTally {
  purpose: string;
  primary: number;
  shadow: number;
  tie: number;
  unreviewed: number;
  avgPrimaryCost: number;
  avgShadowCost: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHADOW_BASE = "/api/admin/ai-shadow";
const STALE_TIME_MS = 30_000;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch shadow pairs, optionally filtered by purpose and/or unreviewed-only.
 */
export function useShadowPairs(opts: {
  purpose?: string;
  unreviewedOnly: boolean;
  limit?: number;
}) {
  return useQuery<ShadowPair[]>({
    queryKey: ["shadow-pairs", opts],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (opts.purpose) params.set("purpose", opts.purpose);
      if (opts.unreviewedOnly) params.set("unreviewed_only", "true");
      if (opts.limit != null) params.set("limit", String(opts.limit));
      const qs = params.toString();
      const res = await fetchAPIRaw(
        `${SHADOW_BASE}/pairs${qs ? `?${qs}` : ""}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch shadow pairs: ${res.status}`);
      }
      const json = await res.json();
      return (json.pairs ?? []) as ShadowPair[];
    },
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Fetch the current shadow-mode kill switch + daily USD ceiling.
 */
export function useShadowConfig() {
  return useQuery<ShadowConfig>({
    queryKey: ["shadow-config"],
    queryFn: async () => {
      const res = await fetchAPIRaw(`${SHADOW_BASE}/config`);
      if (!res.ok) {
        throw new Error(`Failed to fetch shadow config: ${res.status}`);
      }
      return (await res.json()) as ShadowConfig;
    },
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Fetch reviewer-preference tallies (primary / shadow / tie / unreviewed)
 * per purpose, with average per-call cost for each side.
 */
export function useShadowTally(purpose?: string) {
  return useQuery<PurposeTally[]>({
    queryKey: ["shadow-tally", purpose],
    queryFn: async () => {
      const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : "";
      const res = await fetchAPIRaw(`${SHADOW_BASE}/tally${qs}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch shadow tally: ${res.status}`);
      }
      const json = await res.json();
      return (json.tallies ?? []) as PurposeTally[];
    },
    staleTime: STALE_TIME_MS,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Record a reviewer's preference + optional note on a shadow pair.
 */
export function useRatePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      preferred: "primary" | "shadow" | "tie";
      reviewer_note?: string;
    }) => {
      const res = await fetchAPIRaw(`${SHADOW_BASE}/pairs/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferred: input.preferred,
          reviewer_note: input.reviewer_note,
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to rate pair: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shadow-pairs"] });
      qc.invalidateQueries({ queryKey: ["shadow-tally"] });
    },
  });
}

/**
 * Update the shadow-mode kill switch and/or daily USD ceiling.
 */
export function useUpdateShadowConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ShadowConfig>) => {
      const res = await fetchAPIRaw(`${SHADOW_BASE}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new Error(`Failed to update shadow config: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shadow-config"] });
    },
  });
}
