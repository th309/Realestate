"use client";

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
        "group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(57,73,171,0.12)]",
        priority
          ? "border-primary bg-gradient-to-b from-white to-primary-container/30"
          : "border-outline-variant bg-white hover:border-primary/60",
      ].join(" ")}
      aria-label={`Continue tour as ${title}`}
    >
      {priority && (
        <span className="absolute right-3 top-3 rounded-md bg-[#00C853] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          For you
        </span>
      )}
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container text-2xl">
        {icon}
      </span>
      <span className="text-base font-semibold text-on-surface">{title}</span>
      <span className="text-xs text-on-surface-variant">{tag}</span>
      <ul className="space-y-1 text-xs text-on-surface-variant">
        {bullets.map((b) => (
          <li
            key={b}
            className="pl-4 before:absolute before:ml-[-12px] before:text-primary before:content-['→']"
          >
            {b}
          </li>
        ))}
      </ul>
      <span className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-on-primary group-hover:bg-primary-dark">
        Continue as {title.split(" ")[1] ?? persona} →
      </span>
    </button>
  );
}
