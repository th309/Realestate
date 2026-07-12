"use client";
import { ReactNode, useEffect } from "react";
import { lockBodyScroll } from "@/lib/scroll-lock";

interface MobileInputSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Mobile-only slide-up sheet that hosts the InputPanel (address + property
 * details). Opened from the empty-state CTA or the "Edit inputs" bar — there is
 * no floating action button. Hidden on md+ where the sticky sidebar handles
 * inputs.
 */
export function MobileInputSheet({
  open,
  onClose,
  children,
}: MobileInputSheetProps) {
  // Lock background scroll while the sheet is open so it reads as a modal layer.
  // Ref-counted so it coordinates with the nav drawer / other overlays.
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden">
      <div
        className="fixed inset-0 z-30 bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        data-edit-inputs-panel
        role="dialog"
        aria-modal="true"
        aria-label="Property details"
        className="fixed inset-x-0 bottom-0 top-16 z-40 flex max-h-dvh flex-col rounded-t-[28px] border-t border-outline-variant bg-surface shadow-2xl"
      >
        <div className="flex flex-col items-stretch border-b border-outline-variant px-4 pb-3 pt-2">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-outline-variant" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-on-surface">
              Property details
            </h2>
            <button
              type="button"
              aria-label="Close inputs"
              onClick={onClose}
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>
        {/*
          Single scroll container. The InputPanel <aside> (data-input-panel-sticky)
          renders as a plain card; strip its chrome here so it reads as sheet
          content. Bottom padding = 3rem cushion + safe-area inset so the last
          control (Advanced assumptions) clears the home indicator and any fixed
          bottom overlay (e.g. the dev toolbar) instead of sitting flush at the
          screen edge where it is unreachable.
        */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] [&_[data-input-panel-sticky]]:rounded-none [&_[data-input-panel-sticky]]:border-0 [&_[data-input-panel-sticky]]:bg-transparent [&_[data-input-panel-sticky]]:p-0">
          {children}
        </div>
      </div>
    </div>
  );
}
