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
 * Deterministic stand-in for `JSON.stringify` used to fingerprint `state`
 * (see rule 1 below): recursively sorts object keys before stringifying so
 * the fingerprint is stable no matter what property order the caller
 * assembled `state` with. `buildDealState` (`./build-deal-state.ts`) is
 * currently the only call site, and it happens to spread fields in a fixed
 * order — this function is what makes that an implementation detail rather
 * than a load-bearing contract. Arrays keep their existing order, since
 * order is semantically meaningful there.
 *
 * It must agree with `JSON.stringify` on what is REPRESENTABLE, because the
 * fingerprint's only job is to predict whether a write would change stored
 * content — and the content that reaches Postgres goes through
 * `JSON.stringify`. A key that JSON drops must not participate here, or two
 * states that persist identically will compare as different.
 */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    // JSON.stringify renders an undefined element as null, not as a hole.
    return `[${value
      .map((v) => (v === undefined ? "null" : canonicalStringify(v)))
      .join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Undefined-valued keys are OMITTED, exactly as JSON.stringify omits
    // them. This is load-bearing, not tidiness. The restored deal state
    // comes back from Postgres through JSON, which already dropped these
    // keys; the rebuilt state still carries them, because the input-sync
    // effect assigns `capexReserveAnnualPerUnit: isCommercial ? x :
    // undefined` and likewise `financing.amortizationYears`. Keeping them
    // made two semantically identical states serialize differently, so
    // every OPEN of a saved deal armed the debounce and issued a PATCH
    // that wrote byte-identical content.
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Autosave the working state of an already-saved deal.
 *
 * Four rules, each of which is a bug if broken:
 *   1. Never fires on hydration, or on a re-render that didn't actually
 *      change the state's content. Gated by a content fingerprint
 *      (`canonicalStringify`, a key-order-independent `JSON.stringify`; see
 *      its doc comment and `buildDealState` in `./build-deal-state.ts`), not
 *      by render count or object identity — so StrictMode's double-invoked
 *      mount effect and a caller that rebuilds `state` every render (e.g.
 *      streaming AI text, count-up animations) both produce a fingerprint
 *      equal to the last-saved one, and neither can trigger a spurious
 *      write or starve a real one.
 *   2. Never fires without a `dealId`. A brand-new analysis needs one
 *      explicit save to materialize a row, or every slider fiddle spawns one.
 *   3. Writes state ONLY, via patchDealState. It must never reach the save
 *      path that pre-awaits AI narratives — that would fire an LLM batch
 *      call every couple of seconds.
 *   4. A stale write can never win. The "last saved" baseline only advances
 *      after a *successful* response for the request that is still the
 *      newest one issued (a monotonic sequence number discards a superseded
 *      response), and a response is only allowed to change `status` if the
 *      hook is still looking at the `dealId` that request was sent for.
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
  const stateRef = useRef(state);
  const dealIdRef = useRef(dealId);
  const requestSeqRef = useRef(0);
  /** Fingerprint of the state currently believed to be persisted. `null`
   *  until the debounce effect's first run establishes the hydration
   *  baseline — see rule 1. */
  const lastSavedFingerprintRef = useRef<string | null>(null);

  // Keep these current without writing to them during render.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    dealIdRef.current = dealId;
    // Each deal gets its own failure budget. Without this, failures racked
    // up against a deal the user has since navigated away from would count
    // toward a freshly-opened deal's MAX_CONSECUTIVE_FAILURES — the
    // dealIdRef guard elsewhere only protects status *display*, not this
    // counter.
    failuresRef.current = 0;
  }, [dealId]);

  const flush = useCallback(
    async (fingerprint: string) => {
      if (!dealId) return;
      if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;
      const seq = ++requestSeqRef.current;
      setStatus("saving");
      try {
        await patchDealState(
          dealId,
          stateRef.current as unknown as Record<string, unknown>,
        );
        if (seq !== requestSeqRef.current) return; // superseded — don't win
        lastSavedFingerprintRef.current = fingerprint;
        failuresRef.current = 0;
        if (dealId === dealIdRef.current) setStatus("saved");
      } catch {
        if (seq !== requestSeqRef.current) return;
        failuresRef.current += 1;
        if (dealId === dealIdRef.current) setStatus("error");
      }
    },
    [dealId],
  );

  useEffect(() => {
    const fingerprint = canonicalStringify(state);
    if (lastSavedFingerprintRef.current === null) {
      // First run establishes the baseline — hydration, not an edit. Immune
      // to StrictMode's double-invoke: the second run sees a non-null
      // baseline that already matches this same fingerprint and falls
      // through to the no-op branch below.
      lastSavedFingerprintRef.current = fingerprint;
      return;
    }
    if (fingerprint === lastSavedFingerprintRef.current) return;

    if (!enabled || !dealId) return;
    if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;

    const t = setTimeout(() => {
      void flush(fingerprint);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state, enabled, dealId, flush]);

  const retry = useCallback(() => {
    failuresRef.current = 0;
    void flush(canonicalStringify(stateRef.current));
  }, [flush]);

  return { status, retry };
}
