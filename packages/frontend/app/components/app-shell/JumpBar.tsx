import type { ReactNode } from "react";

export type JumpItem = {
  id: string;
  label: string;
  icon: ReactNode;
  /** Tailwind background class for the icon tile, e.g. "bg-primary". */
  accent: string;
};

/**
 * In-page navigation for the long tool pages. The analyzer stacks a verdict, a
 * grading table, four improvement levers, a projection, and a waterfall in one
 * scroll; this makes that depth reachable rather than hiding it.
 */
export function JumpBar({
  items,
  activeId,
}: {
  items: JumpItem[];
  activeId: string;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5 rounded-xl border border-outline-variant bg-surface p-2 shadow-sm">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? "true" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              active
                ? "border-primary bg-primary-container text-primary"
                : "border-transparent text-on-surface-variant"
            }`}
          >
            <span
              className={`grid size-5 place-items-center rounded-md text-on-primary ${item.accent}`}
            >
              {item.icon}
            </span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
