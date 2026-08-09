"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { MetricCategoryItem } from "./sidebar-components";
import type {
  GeoLevel,
  ForecastHorizon,
  RentIndexType,
  RenterDemandType,
  MetricCategory,
} from "../types";

interface MetricPickerPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  metricCategories: MetricCategory[];
  expandedCategories: string[];
  selectedMetric: string;
  geoLevel: GeoLevel;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  onToggleCategory: (id: string) => void;
  onSelectMetric: (id: string) => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
}

const POPOVER_WIDTH = 320;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The metric catalogue as an anchored dropdown instead of something only
 * the sidebar can show. It reuses the exact MetricCategoryItem rows and
 * expand state the sidebar uses, so the two never drift into separate
 * catalogues — this is a second entry point onto the same data, not a
 * second implementation of it. Portaled to <body> so the map shell's
 * `overflow-hidden` chrome can't clip it.
 */
export function MetricPickerPopover({
  open,
  onClose,
  anchorRef,
  metricCategories,
  expandedCategories,
  selectedMetric,
  geoLevel,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  onToggleCategory,
  onSelectMetric,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
}: MetricPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Viewport-relative — matched to `position: fixed` below, so no scroll
  // offset is added (unlike an `absolute` popover in a scrolling document).
  // Recomputed on resize too, so an in-flight orientation change or a
  // narrowed window doesn't leave the popover clipped against a stale
  // `innerWidth`.
  useLayoutEffect(() => {
    if (!open) return;

    function reposition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: Math.max(
          8,
          Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8),
        ),
      });
    }

    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open, anchorRef]);

  // Capture what had focus and move focus into the popover — exactly once
  // per open, kept in its own effect keyed only on `open`. The popover's
  // anchor button re-renders on every category toggle (expandedCategories
  // is lifted state shared with the sidebar), which used to give `onClose`
  // a new identity each time and re-fire this alongside the keydown effect
  // below, snapping focus back to the first item mid-browse.
  useEffect(() => {
    if (!open) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    const first =
      popoverRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
    return () => {
      previousActive.current?.focus?.();
    };
  }, [open]);

  // Escape-to-close, Tab trap, and click-outside-to-close. The Tab trap
  // queries focusable elements live on each keypress rather than off a
  // snapshot taken on open — categories expand/collapse while the popover
  // is open, changing which rows are tabbable, so a captured NodeList would
  // go stale mid-session.
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusables =
          popoverRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !popoverRef.current?.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, anchorRef, onClose]);

  const handleSelectMetric = (id: string) => {
    onSelectMetric(id);
    onClose();
  };

  if (!open || !position || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="listbox"
      aria-label="Choose a metric"
      style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
      className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-high p-2 shadow-lg animate-[metric-picker-in_150ms_cubic-bezier(0.2,0,0,1)]"
    >
      {metricCategories.map((category) => (
        <MetricCategoryItem
          key={category.id}
          category={category}
          isExpanded={expandedCategories.includes(category.id)}
          selectedMetric={selectedMetric}
          geoLevel={geoLevel}
          forecastHorizon={forecastHorizon}
          rentIndexType={rentIndexType}
          renterDemandType={renterDemandType}
          onToggle={() => onToggleCategory(category.id)}
          onSelectMetric={handleSelectMetric}
          onGeoLevelChange={() => {}}
          onForecastHorizonChange={onForecastHorizonChange}
          onRentIndexTypeChange={onRentIndexTypeChange}
          onRenterDemandTypeChange={onRenterDemandTypeChange}
        />
      ))}
      <style jsx global>{`
        @keyframes metric-picker-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
