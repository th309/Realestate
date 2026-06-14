"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { TimeRangeSelector } from "./TimeRangeSelector";
import type { TimeRangeKey } from "./TimeRangeSelector";

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  timeRangeKey?: TimeRangeKey;
  onTimeRangeChange?: (key: TimeRangeKey) => void;
  children: React.ReactNode;
}

export function DetailPanel({
  isOpen,
  onClose,
  title,
  timeRangeKey,
  onTimeRangeChange,
  children,
}: DetailPanelProps) {
  // Track whether we're mounted in the browser so createPortal is safe to use
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent body scroll when the panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const panelContent = (
    <>
      {/* M3 Scrim overlay — covers admin area below the 64px global header */}
      <div
        data-testid="detail-panel-scrim"
        className={`fixed top-16 inset-x-0 bottom-0 bg-on-surface/40 z-40 transition-opacity duration-400 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out panel — starts below the 64px global header (h-16) */}
      <aside
        data-testid="detail-panel"
        className={`
          fixed top-16 bottom-0 right-0 z-50 w-full sm:w-[480px]
          flex flex-col
          bg-surface-container-low border-l border-outline-variant
          transform transition-transform duration-400 ease-[cubic-bezier(0.2,0,0,1)]
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        aria-label={title}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-surface-container-low border-b border-outline-variant px-5 py-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-on-surface truncate flex-1">
            {title}
          </h2>

          <div className="flex items-center gap-2 flex-shrink-0">
            {timeRangeKey !== undefined && onTimeRangeChange !== undefined && (
              <TimeRangeSelector
                value={timeRangeKey}
                onChange={onTimeRangeChange}
              />
            )}

            <button
              onClick={onClose}
              aria-label="Close panel"
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
      </aside>
    </>
  );

  // Use a portal so the panel renders directly under document.body,
  // escaping the layout's overflow-auto stacking context.
  if (!isMounted) return null;
  return createPortal(panelContent, document.body);
}
