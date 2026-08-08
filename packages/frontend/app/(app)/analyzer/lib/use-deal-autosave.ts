"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { patchDealState } from "@/lib/data";
import type { DealStateV2 } from "./deal-state-types";

export const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Stop retrying after this many consecutive failures. A dead endpoint must
 *  not be hammered once per edit for the rest of the session. */
export const MAX_CONSECUTIVE_FAILURES = 3;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Autosave the working state of an already-saved deal.
 *
 * Three rules, each of which is a bug if broken:
 *   1. Never fires on the first render. Hydrating a saved deal sets state,
 *      which would otherwise trigger a write on every page open.
 *   2. Never fires without a `dealId`. A brand-new analysis needs one
 *      explicit save to materialize a row, or every slider fiddle spawns one.
 *   3. Writes state ONLY, via patchDealState. It must never reach the save
 *      path that pre-awaits AI narratives — that would fire an LLM batch
 *      call every couple of seconds.
 */
export function useDealAutosave({
  dealId,
  state,
  enabled,
}: {
  dealId: string | null;
  state: DealStateV2;
  enabled: boolean;
}): { status: SaveStatus; retry: () => void } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const failuresRef = useRef(0);
  const isFirstRenderRef = useRef(true);
  const stateRef = useRef(state);
  // Keep the ref current without writing to it during render — the
  // react-hooks/refs rule forbids mutating a ref while rendering.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const flush = useCallback(async () => {
    if (!dealId) return;
    setStatus("saving");
    try {
      await patchDealState(
        dealId,
        stateRef.current as unknown as Record<string, unknown>,
      );
      failuresRef.current = 0;
      setStatus("saved");
    } catch {
      failuresRef.current += 1;
      setStatus("error");
    }
  }, [dealId]);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!enabled || !dealId) return;
    if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;

    const t = setTimeout(() => {
      void flush();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state, enabled, dealId, flush]);

  const retry = useCallback(() => {
    failuresRef.current = 0;
    void flush();
  }, [flush]);

  return { status, retry };
}
