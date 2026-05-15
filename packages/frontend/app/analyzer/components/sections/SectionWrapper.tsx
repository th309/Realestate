"use client";
import { useState, ReactNode } from "react";

interface SectionWrapperProps {
  id: string;
  title: string;
  defaultOpen?: boolean;
  onRefresh?: () => void;
  aiAnnotation?: ReactNode;
  children: ReactNode;
}

export function SectionWrapper({
  id,
  title,
  defaultOpen = true,
  onRefresh,
  aiAnnotation,
  children,
}: SectionWrapperProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      data-section={id}
      className="rounded-xl bg-surface border border-outline-variant overflow-hidden"
    >
      <header
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-container-low"
        onClick={() => setOpen((o) => !o)}
      >
        <h3 className="text-sm font-semibold text-on-surface">
          <span
            data-section-chevron
            aria-hidden
            className="inline-block w-3 mr-2"
          >
            {open ? "▾" : "▸"}
          </span>
          {title}
        </h3>
        {onRefresh && (
          <button
            data-section-refresh
            aria-label="Refresh insight"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className="text-on-surface-variant hover:text-primary text-base px-2"
          >
            ↻
          </button>
        )}
      </header>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {children}
          {aiAnnotation && (
            <div
              data-section-ai
              className="text-sm text-on-surface italic border-l-2 border-primary pl-3"
            >
              {aiAnnotation}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
