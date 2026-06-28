"use client";

import { ChevronRight } from "lucide-react";
import type { Persona } from "@/lib/data";

interface Props {
  persona: Persona;
  icon: string;
  title: string;
  tag: string;
  bullets: string[];
  priority?: boolean;
  onSelect: (p: Persona) => void;
}

export function PersonaCard({
  persona,
  icon,
  title,
  tag,
  bullets,
  priority,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(persona)}
      className={[
        // Mobile: compact horizontal row so all three options fit one screen
        // without scrolling. Desktop (md+): rich vertical card with bullets + CTA.
        "group relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all",
        "md:flex-col md:items-start md:gap-3 md:p-5",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(57,73,171,0.12)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        priority
          ? "border-primary bg-gradient-to-b from-surface-container to-primary-container/30"
          : "border-outline-variant bg-surface-container hover:border-primary/60",
      ].join(" ")}
      aria-label={`Continue tour as ${title}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-2xl md:h-11 md:w-11">
        {icon}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
        <span className="text-[17px] font-semibold leading-tight text-on-surface md:text-base">
          {title}
        </span>
        <span className="text-[13px] font-medium leading-snug text-on-surface-variant md:text-xs md:font-normal">
          {tag}
        </span>
      </span>

      {/* Mobile-only affordance signalling these are tap-to-select */}
      <ChevronRight
        className="h-5 w-5 shrink-0 text-primary md:hidden"
        aria-hidden="true"
      />

      <ul className="hidden space-y-1 text-xs text-on-surface-variant md:block">
        {bullets.map((b) => (
          <li
            key={b}
            className="relative pl-4 before:absolute before:ml-[-12px] before:text-primary before:content-['→']"
          >
            {b}
          </li>
        ))}
      </ul>
      <span className="mt-2 hidden w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-on-primary group-hover:bg-primary-dark md:inline-flex">
        Continue as {title.replace(/^I'm an? /i, "")} →
      </span>
    </button>
  );
}
