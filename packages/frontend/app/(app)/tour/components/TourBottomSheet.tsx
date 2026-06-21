"use client";

import { useEffect, useState } from "react";
import { BreathingSpotlight } from "../primitives/BreathingSpotlight";

interface Props {
  title: string;
  body: string;
  progress: number;
  onContinue: () => void;
  onDismiss: () => void;
  targetSelector: string;
}

export function TourBottomSheet({
  title,
  body,
  progress,
  onContinue,
  onDismiss,
  targetSelector,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Slide the sheet up after mount. Scrolling the target into view is owned
    // solely by BreathingSpotlight (scrollBlock="center" below) so there is one
    // deterministic scroll per step instead of two competing scrollIntoView
    // calls fighting each other.
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, [targetSelector]);

  return (
    <>
      {/* Real cutout highlight on mobile (was a full-screen blur). */}
      <BreathingSpotlight
        targetSelector={targetSelector}
        visible
        onClick={onContinue}
        scrollBlock="center"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-bs-title"
        className={[
          "fixed inset-x-0 bottom-0 z-[9999] rounded-t-3xl bg-surface-container-high p-5 pb-7 shadow-[0_-12px_32px_rgba(0,0,0,0.18)]",
          "transition-transform duration-300 ease-out",
          show ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div
          className="mx-auto mb-4 h-1 w-12 rounded-full bg-outline-variant"
          aria-hidden="true"
        />
        <h3
          id="tour-bs-title"
          className="text-base font-semibold text-on-surface"
        >
          {title}
        </h3>
        <p className="mt-1.5 text-sm text-on-surface-variant">{body}</p>

        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-outline-variant/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-tertiary transition-all duration-400"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-on-surface-variant/70"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary"
          >
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
