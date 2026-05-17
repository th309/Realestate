"use client";

/**
 * useDrawerState — owns the working-copy state for the Customize Thresholds
 * drawer plus validation memoization and save / reset handlers.
 *
 * Extracted from `CustomizeThresholdsDrawer.tsx` to keep that component under
 * the 400-line hard limit while preserving a single source of truth for the
 * drawer's mutable state.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Strategy, UserThresholds } from "@propertyiq/analyzer-core";
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
  validateAssumptions,
  validateMetricThreshold,
  validateWeights,
} from "./validators";

export type ThresholdsTabId = "thresholds" | "weights" | "assumptions";

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

  const [draftThresholds, setDraftThresholds] = useState<UserThresholds | null>(
    null,
  );
  const [draftDefaults, setDraftDefaults] = useState<AnalyzerDefaults | null>(
    null,
  );
  const [banner, setBanner] = useState<BannerState | null>(null);

  // Seed working copies from server.
  useEffect(() => {
    if (thresholdsQ.data && draftThresholds === null) {
      setDraftThresholds(thresholdsQ.data);
    }
  }, [thresholdsQ.data, draftThresholds]);
  useEffect(() => {
    if (defaultsQ.data && draftDefaults === null) {
      setDraftDefaults(defaultsQ.data);
    }
  }, [defaultsQ.data, draftDefaults]);

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

  const isDirty = useMemo(() => {
    if (!draftThresholds || !draftDefaults) return false;
    const tDirty =
      thresholdsQ.data &&
      JSON.stringify(draftThresholds) !== JSON.stringify(thresholdsQ.data);
    const dDirty =
      defaultsQ.data &&
      JSON.stringify(draftDefaults) !== JSON.stringify(defaultsQ.data);
    return Boolean(tDirty || dDirty);
  }, [draftThresholds, draftDefaults, thresholdsQ.data, defaultsQ.data]);

  const thresholdErrors = useMemo(() => {
    if (!draftThresholds) return {};
    return {
      cashOnCash: validateMetricThreshold(draftThresholds.cashOnCash),
      dscr: validateMetricThreshold(draftThresholds.dscr),
      cashFlowPerDoor: validateMetricThreshold(draftThresholds.cashFlowPerDoor),
      capRate: validateMetricThreshold(draftThresholds.capRate),
      breakEvenOccupancy: validateMetricThreshold(
        draftThresholds.breakEvenOccupancy,
      ),
    } as const;
  }, [draftThresholds]);

  const weightsCheck = useMemo(() => {
    if (!draftThresholds) return { valid: false, sum: 0 };
    return validateWeights(draftThresholds.weights);
  }, [draftThresholds]);

  const assumptionErrors = useMemo(
    () =>
      draftDefaults
        ? validateAssumptions(draftDefaults)
        : ({} as ReturnType<typeof validateAssumptions>),
    [draftDefaults],
  );

  const canSave =
    !!draftThresholds &&
    !!draftDefaults &&
    Object.values(thresholdErrors).every((e) => e === null) &&
    weightsCheck.valid &&
    !hasAnyAssumptionError(assumptionErrors as never) &&
    !updateThresholdsM.isPending &&
    !updateDefaultsM.isPending;

  const handleSave = useCallback(async () => {
    if (!draftThresholds || !draftDefaults) return;
    try {
      await Promise.all([
        updateThresholdsM.mutateAsync(draftThresholds),
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
      await deleteThresholdsM.mutateAsync();
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
  }, [deleteThresholdsM]);

  return {
    // server flags
    isLoading: thresholdsQ.isLoading || defaultsQ.isLoading,
    // working copies
    draftThresholds,
    draftDefaults,
    setDraftThresholds,
    setDraftDefaults,
    // validation
    thresholdErrors,
    weightsCheck,
    assumptionErrors,
    canSave,
    isDirty,
    // banner
    banner,
    // mutations status
    isSaving: updateThresholdsM.isPending || updateDefaultsM.isPending,
    isResetting: deleteThresholdsM.isPending,
    // actions
    handleSave,
    handleResetAll,
  };
}
