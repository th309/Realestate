"use client";

/**
 * CustomizeThresholdsDrawer — right-side slide-in for editing per-user
 * grading thresholds, metric weights, and analyzer assumption defaults.
 *
 * Composition:
 *   - useDrawerState   — owns draft state, validation, save/reset handlers
 *   - ThresholdsTab    — A/B/C/D edits per metric
 *   - WeightsTab       — weight inputs + sum indicator
 *   - AssumptionsTab   — analyzer form defaults
 *   - DrawerFooter     — banner, confirm strip, Reset/Cancel/Save buttons
 *
 * Integration owner (RecommendationCard) wires the trigger chip and passes
 * `open` + `onClose`. This component is presentational w.r.t. those props.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Strategy } from "@propertyiq/analyzer-core";
import { ThresholdsTab } from "./ThresholdsTab";
import { WeightsTab } from "./WeightsTab";
import { AssumptionsTab } from "./AssumptionsTab";
import { DrawerFooter } from "./DrawerFooter";
import { presetForStrategy } from "./preset-helpers";
import { useDrawerState, type ThresholdsTabId } from "./useDrawerState";

interface CustomizeThresholdsDrawerProps {
  open: boolean;
  onClose: () => void;
  strategy: Strategy;
}

const TABS: Array<{ id: ThresholdsTabId; label: string }> = [
  { id: "thresholds", label: "Thresholds" },
  { id: "weights", label: "Weights" },
  { id: "assumptions", label: "Assumptions" },
];

export function CustomizeThresholdsDrawer({
  open,
  onClose,
  strategy,
}: CustomizeThresholdsDrawerProps) {
  const preset = useMemo(() => presetForStrategy(strategy), [strategy]);
  const state = useDrawerState(open, strategy);

  const [tab, setTab] = useState<ThresholdsTabId>("thresholds");
  const [confirmCancel, setConfirmCancel] = useState(false);

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
              thresholds={state.draftThresholds}
              preset={preset}
              onChange={state.setDraftThresholds}
              errors={state.thresholdErrors}
            />
          ) : tab === "weights" ? (
            <WeightsTab
              weights={state.draftThresholds.weights}
              onChange={(w) =>
                state.setDraftThresholds({
                  ...state.draftThresholds!,
                  weights: w,
                })
              }
              sum={state.weightsCheck.sum}
              isValid={state.weightsCheck.valid}
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
      </aside>
    </div>
  );
}
