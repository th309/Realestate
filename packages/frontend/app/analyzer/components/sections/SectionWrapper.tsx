"use client";
import { useState, ReactNode } from "react";
import { piq } from "../primitives/piqTokens";

interface SectionWrapperProps {
  id: string;
  title: string;
  defaultOpen?: boolean;
  onRefresh?: () => void;
  aiAnnotation?: ReactNode;
  children: ReactNode;
}

function LightbulbIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 1 5 11.95V16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2.05A7 7 0 0 1 12 2z" />
    </svg>
  );
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
              className="flex gap-2 items-start"
              style={{
                fontSize: "13px",
                color: piq.textMuted,
                padding: "12px",
                borderRadius: 8,
                background: "rgba(57, 73, 171, 0.04)",
                lineHeight: 1.5,
              }}
            >
              <span
                aria-hidden
                style={{ flexShrink: 0, color: piq.indigo, marginTop: 1 }}
              >
                <LightbulbIcon />
              </span>
              <div className="flex-1">{aiAnnotation}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
