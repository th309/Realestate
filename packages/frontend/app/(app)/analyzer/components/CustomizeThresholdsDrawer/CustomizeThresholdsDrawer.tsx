"use client";

/**
 * CustomizeThresholdsDrawer — right-side slide-in for editing per-user
 * grading thresholds, metric weights, and analyzer assumption defaults.
 *
 * Strategy-aware: rubric rows (B&H / F&F / BRRRR) come from the active
 * strategy, and the top-of-drawer preset selector (Conservative / Balanced /
 * Aggressive) applies the matching strategy-specific preset.
 *
 * Composition:
 *   - useDrawerState   — owns draft state, validation, save/reset, applyPreset
 *   - PresetSelector   — segmented control above the tabs
 *   - ThresholdsTab    — A/B/C/D edits per metric for the active strategy
 *   - WeightsTab       — weight inputs + sum indicator
 *   - AssumptionsTab   — analyzer form defaults
 *   - DrawerFooter     — banner, confirm strip, Reset/Cancel/Save buttons
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { GradingPresetName, Strategy } from "@propertyiq/analyzer-core";
import { ThresholdsTab } from "./ThresholdsTab";
import { WeightsTab } from "./WeightsTab";
import { AutoKillTab } from "./AutoKillTab";
import { AssumptionsTab } from "./AssumptionsTab";
import { DrawerFooter } from "./DrawerFooter";
import { PresetSelector, PresetConfirmModal } from "./PresetSelector";
import {
  presetForStrategy,
  rowsForStrategy,
  type AnyStrategyThresholds,
} from "./preset-helpers";
import { useDrawerState, type ThresholdsTabId } from "./useDrawerState";

interface CustomizeThresholdsDrawerProps {
  open: boolean;
  onClose: () => void;
  strategy: Strategy;
  /** Tab to show when the drawer opens (deep-link from banner / input panel). */
  initialTab?: ThresholdsTabId;
}

const TABS: Array<{ id: ThresholdsTabId; label: string }> = [
  { id: "thresholds", label: "Thresholds" },
  { id: "weights", label: "Weights" },
  { id: "autokill", label: "Auto-Kill" },
  { id: "assumptions", label: "Assumptions" },
];

export function CustomizeThresholdsDrawer({
  open,
  onClose,
  strategy,
  initialTab,
}: CustomizeThresholdsDrawerProps) {
  const state = useDrawerState(open, strategy);
  const rows = useMemo(() => rowsForStrategy(strategy), [strategy]);
  const previewPreset = useMemo(
    () => presetForStrategy(strategy, "balanced"),
    [strategy],
  );

  const [tab, setTab] = useState<ThresholdsTabId>(initialTab ?? "thresholds");

  // Re-sync the tab each time the drawer opens (open may deep-link a tab).
  useEffect(() => {
    if (open) setTab(initialTab ?? "thresholds");
  }, [open, initialTab]);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [presetToConfirm, setPresetToConfirm] =
    useState<GradingPresetName | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<Element | null>(null);

  // Focus mgmt: save trigger element, focus close on open, restore on close.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeBtnRef.current?.focus());
    return () => {
      document.body.style.overflow = "";
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  const handleCancel = useCallback(() => {
    if (state.isDirty && !confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setConfirmCancel(false);
    onClose();
  }, [state.isDirty, confirmCancel, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleCancel]);

  const handlePresetClick = useCallback(
    (preset: GradingPresetName) => {
      // No-op if already on this preset.
      if (state.activePreset === preset) return;
      // If user has custom edits (no preset match), require confirm.
      if (state.draftThresholds && state.activePreset == null) {
        setPresetToConfirm(preset);
        return;
      }
      state.applyPreset(preset);
    },
    [state],
  );

  const confirmPresetSwitch = useCallback(() => {
    if (presetToConfirm) state.applyPreset(presetToConfirm);
    setPresetToConfirm(null);
  }, [presetToConfirm, state]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      data-testid="customize-thresholds-drawer"
    >
      <div
        className="absolute inset-0 bg-on-surface/40"
        aria-hidden="true"
        onClick={handleCancel}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-thresholds-title"
        className="absolute top-0 right-0 bottom-0 w-full md:w-[480px] bg-surface-container-high flex flex-col shadow-lg"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b-[1.75px] border-outline-variant">
          <h2
            id="customize-thresholds-title"
            className="text-lg font-medium text-on-surface"
          >
            Customize Grading Thresholds
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleCancel}
            aria-label="Close drawer"
            className="p-2 rounded-full hover:bg-surface-container"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <PresetSelector
          activePreset={state.activePreset}
          isCustom={state.draftThresholds != null && state.activePreset == null}
          onSelect={handlePresetClick}
        />

        <nav
          role="tablist"
          aria-label="Customize sections"
          className="flex border-b-[1.75px] border-outline-variant px-5"
        >
          {TABS.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${id}`}
                onClick={() => setTab(id)}
                className={
                  "px-3 py-3 text-sm font-medium transition-colors " +
                  (active
                    ? "text-[var(--md-primary)] border-b-2 border-[var(--md-primary)] -mb-[1.75px]"
                    : "text-on-surface-variant hover:text-on-surface")
                }
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div
          id={`tabpanel-${tab}`}
          role="tabpanel"
          className="flex-1 overflow-y-auto px-5 py-5"
        >
          {state.isLoading ? (
            <div className="text-sm text-on-surface-variant">Loading…</div>
          ) : !state.draftThresholds || !state.draftDefaults ? (
            <div className="text-sm text-[var(--md-error)]">
              Couldn&apos;t load your settings. Please try again.
            </div>
          ) : tab === "thresholds" ? (
            <ThresholdsTab
              rows={rows}
              thresholds={state.draftThresholds}
              preset={previewPreset}
              onChange={state.setDraftThresholds}
              errors={state.thresholdErrors}
            />
          ) : tab === "weights" ? (
            <WeightsTab
              rows={rows}
              weights={
                ((state.draftThresholds as { weights?: unknown })
                  .weights as Record<string, number>) ?? {}
              }
              onChange={(w) =>
                state.setDraftThresholds({
                  ...(state.draftThresholds as object),
                  weights: w,
                } as AnyStrategyThresholds)
              }
              sum={state.weightsCheck.sum}
              isValid={state.weightsCheck.valid}
            />
          ) : tab === "autokill" ? (
            <AutoKillTab
              strategy={strategy}
              thresholds={state.draftThresholds}
              onChange={state.setDraftThresholds}
              errors={state.autoKillErrors}
            />
          ) : (
            <AssumptionsTab
              defaults={state.draftDefaults}
              onChange={state.setDraftDefaults}
              errors={state.assumptionErrors}
            />
          )}
        </div>

        <DrawerFooter
          banner={state.banner}
          confirmCancel={confirmCancel}
          onKeepEditing={() => setConfirmCancel(false)}
          onDiscard={() => {
            setConfirmCancel(false);
            onClose();
          }}
          onResetAll={state.handleResetAll}
          onCancel={handleCancel}
          onSave={state.handleSave}
          isSaving={state.isSaving}
          isResetting={state.isResetting}
          canSave={state.canSave}
        />

        {presetToConfirm && (
          <PresetConfirmModal
            target={presetToConfirm}
            onConfirm={confirmPresetSwitch}
            onCancel={() => setPresetToConfirm(null)}
          />
        )}
      </aside>
    </div>
  );
}
