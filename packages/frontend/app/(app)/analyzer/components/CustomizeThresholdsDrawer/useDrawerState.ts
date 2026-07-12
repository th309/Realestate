"use client";

/**
 * useDrawerState — owns the working-copy state for the Customize Thresholds
 * drawer plus validation memoization and save / reset handlers.
 *
 * Strategy-aware: validation iterates the metric keys for the active strategy
 * via the row metadata so B&H / F&F / BRRRR shapes are all handled correctly.
 *
 * Draft thresholds are typed as `UserThresholds` for back-compat with the
 * data layer, but at runtime any of the three strategy shapes flow through.
 * Internal consumers treat the object as opaque (`Record<string, ...>` via
 * casts inside validators / tabs).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GradingPresetName, Strategy } from "@propertyiq/analyzer-core";
import {
  useThresholds,
  useUpdateThresholds,
  useDeleteThresholds,
  useAnalyzerDefaults,
  useUpdateAnalyzerDefaults,
  type AnalyzerDefaults,
} from "@/lib/data";
import {
  hasAnyAssumptionError,
  validateAllThresholds,
  validateAssumptions,
  validateWeightsForStrategy,
  type ThresholdErrors,
} from "./validators";
import {
  ASSUMPTION_DEFAULTS,
  detectActivePreset,
  presetForStrategy,
  stableStringify,
  type AnyStrategyThresholds,
} from "./preset-helpers";
import {
  getAutoKillConfig,
  hasAnyAutoKillError,
  validateAutoKills,
} from "./autokill-rows";

export type ThresholdsTabId =
  | "thresholds"
  | "weights"
  | "autokill"
  | "assumptions";

export interface BannerState {
  kind: "success" | "error";
  message: string;
}

export function useDrawerState(open: boolean, strategy: Strategy) {
  const thresholdsQ = useThresholds(strategy);
  const updateThresholdsM = useUpdateThresholds(strategy);
  const deleteThresholdsM = useDeleteThresholds(strategy);
  const defaultsQ = useAnalyzerDefaults();
  const updateDefaultsM = useUpdateAnalyzerDefaults();

  const [draftThresholds, setDraftThresholds] =
    useState<AnyStrategyThresholds | null>(null);
  const [draftDefaults, setDraftDefaults] = useState<AnalyzerDefaults | null>(
    null,
  );
  const [banner, setBanner] = useState<BannerState | null>(null);

  // Seed working copies from server.
  useEffect(() => {
    if (thresholdsQ.data && draftThresholds === null) {
      setDraftThresholds(thresholdsQ.data as AnyStrategyThresholds);
    }
  }, [thresholdsQ.data, draftThresholds]);
  useEffect(() => {
    if (defaultsQ.data && draftDefaults === null) {
      setDraftDefaults(defaultsQ.data);
    }
  }, [defaultsQ.data, draftDefaults]);

  // Reset draft thresholds on strategy change so a stale rubric shape from
  // the previous strategy doesn't leak into the new one's tab.
  useEffect(() => {
    setDraftThresholds(null);
  }, [strategy]);

  // Auto-dismiss success banner after 3s.
  useEffect(() => {
    if (banner?.kind !== "success") return;
    const t = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(t);
  }, [banner]);

  // Clear banner when the drawer closes so it doesn't reappear on reopen.
  useEffect(() => {
    if (!open) setBanner(null);
  }, [open]);

  // Key-order-insensitive comparison: server round-trips (JSONB) and the PUT
  // echo reorder object keys, so plain JSON.stringify would report a freshly
  // saved draft as "dirty" and trip the discard-confirm on close.
  const isDirty = useMemo(() => {
    if (!draftThresholds || !draftDefaults) return false;
    const tDirty =
      thresholdsQ.data &&
      stableStringify(draftThresholds) !== stableStringify(thresholdsQ.data);
    const dDirty =
      defaultsQ.data &&
      stableStringify(draftDefaults) !== stableStringify(defaultsQ.data);
    return Boolean(tDirty || dDirty);
  }, [draftThresholds, draftDefaults, thresholdsQ.data, defaultsQ.data]);

  const thresholdErrors: ThresholdErrors = useMemo(() => {
    if (!draftThresholds) return {};
    return validateAllThresholds(strategy, draftThresholds);
  }, [draftThresholds, strategy]);

  const weightsCheck = useMemo(() => {
    if (!draftThresholds) return { valid: false, sum: 0 };
    return validateWeightsForStrategy(
      strategy,
      (draftThresholds as { weights?: unknown }).weights,
    );
  }, [draftThresholds, strategy]);

  const assumptionErrors = useMemo(
    () =>
      draftDefaults
        ? validateAssumptions(draftDefaults)
        : ({} as ReturnType<typeof validateAssumptions>),
    [draftDefaults],
  );

  const autoKillErrors = useMemo(
    () =>
      validateAutoKills(
        strategy,
        draftThresholds ? getAutoKillConfig(draftThresholds) : undefined,
      ),
    [draftThresholds, strategy],
  );

  const activePreset: GradingPresetName | null = useMemo(
    () => detectActivePreset(strategy, draftThresholds),
    [strategy, draftThresholds],
  );

  const canSave =
    !!draftThresholds &&
    !!draftDefaults &&
    Object.values(thresholdErrors).every((e) => e === null) &&
    weightsCheck.valid &&
    !hasAnyAssumptionError(assumptionErrors as never) &&
    !hasAnyAutoKillError(autoKillErrors) &&
    !updateThresholdsM.isPending &&
    !updateDefaultsM.isPending;

  const handleSave = useCallback(async () => {
    if (!draftThresholds || !draftDefaults) return;
    try {
      await Promise.all([
        // Cast back to the data-layer type at the boundary — runtime shape
        // matches the backend's strategy-aware validation.
        updateThresholdsM.mutateAsync(draftThresholds as never),
        updateDefaultsM.mutateAsync(draftDefaults),
      ]);
      setBanner({ kind: "success", message: "Saved" });
    } catch (e) {
      setBanner({
        kind: "error",
        message: e instanceof Error ? e.message : "Save failed",
      });
    }
  }, [draftThresholds, draftDefaults, updateThresholdsM, updateDefaultsM]);

  const handleResetAll = useCallback(async () => {
    try {
      // "Reset all" must cover BOTH persisted surfaces: delete the saved
      // thresholds row (reverts to preset defaults) AND write the canonical
      // assumption defaults (no DELETE endpoint exists for analyzer-defaults,
      // so reset = PUT the defaults).
      await Promise.all([
        deleteThresholdsM.mutateAsync(),
        updateDefaultsM.mutateAsync(ASSUMPTION_DEFAULTS),
      ]);
      // Clear working copies so next server response re-seeds them.
      setDraftThresholds(null);
      setDraftDefaults(null);
      setBanner({ kind: "success", message: "Reset to defaults" });
    } catch (e) {
      setBanner({
        kind: "error",
        message: e instanceof Error ? e.message : "Reset failed",
      });
    }
  }, [deleteThresholdsM, updateDefaultsM]);

  const applyPreset = useCallback(
    (preset: GradingPresetName) => {
      setDraftThresholds((prev) => {
        const next = presetForStrategy(strategy, preset);
        const autoKills = (prev as { autoKills?: unknown } | null)?.autoKills;
        return autoKills
          ? ({ ...(next as object), autoKills } as AnyStrategyThresholds)
          : next;
      });
    },
    [strategy],
  );

  return {
    isLoading: thresholdsQ.isLoading || defaultsQ.isLoading,
    draftThresholds,
    draftDefaults,
    setDraftThresholds,
    setDraftDefaults,
    thresholdErrors,
    weightsCheck,
    assumptionErrors,
    autoKillErrors,
    canSave,
    isDirty,
    banner,
    activePreset,
    isSaving: updateThresholdsM.isPending || updateDefaultsM.isPending,
    isResetting: deleteThresholdsM.isPending,
    handleSave,
    handleResetAll,
    applyPreset,
  };
}
