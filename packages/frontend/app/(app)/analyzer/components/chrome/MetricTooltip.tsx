"use client";
import { useEffect, useRef, useState, ReactNode } from "react";
import { GLOSSARY, GlossaryKey } from "../../lib/glossary";

interface MetricTooltipProps {
  metric: GlossaryKey;
  children?: ReactNode; // optional override label; defaults to glossary entry name
}

export function MetricTooltip({ metric, children }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const entry = GLOSSARY[metric];
  const label = children ?? entry?.name ?? metric;

  // Tap opens/closes the tooltip (iOS Safari does not focus plain elements
  // on tap, only real form controls — see MetricHelpButton for the same fix).
  const toggleOpen = () => setOpen((visible) => !visible);

  // Escape + outside click/tap close the tooltip once open.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleOutsideClick(e: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  return (
    <button
      ref={triggerRef}
      type="button"
      data-metric-tooltip
      data-metric={metric}
      className="relative inline-block appearance-none bg-transparent border-0 p-0 m-0 font-inherit text-inherit cursor-pointer underline decoration-dotted decoration-on-surface-variant underline-offset-4"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={toggleOpen}
      aria-expanded={open}
    >
      {label}
      {open && entry && (
        <span
          role="tooltip"
          data-tooltip-body
          // The button trigger's own onClick toggle would otherwise also
          // fire for taps landing inside this tooltip body (a DOM child of
          // the button), self-closing it before the user can read it.
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 top-full mt-1 w-72 rounded-xl bg-surface-container-high text-on-surface text-xs p-3 shadow-lg border border-outline-variant text-left normal-case"
        >
          <span className="block font-semibold text-sm mb-1">{entry.name}</span>
          <span className="block font-mono text-[10px] text-on-surface-variant mb-2">
            {entry.formula}
          </span>
          <span className="block mb-1">{entry.plain}</span>
          <span className="block italic text-on-surface-variant">
            {entry.whyMatters}
          </span>
        </span>
      )}
    </button>
  );
}
