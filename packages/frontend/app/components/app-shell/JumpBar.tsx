import type { ReactNode } from "react";

export type JumpItem = {
  id: string;
  label: string;
  icon: ReactNode;
  /** Tailwind background class for the icon tile, e.g. "bg-primary". */
  accent: string;
};

/**
 * How the bar handles more items than fit on one line.
 *
 * `wrap` grows to a second row — fine for a bar that scrolls away with the
 * page. `scroll` holds one row and pans sideways, which keeps the bar a fixed
 * height; a sticky bar needs that, or it eats a third of a phone viewport on
 * the widths where it wraps.
 */
const LAYOUT = {
  wrap: "flex-wrap",
  // `shrink-0` and `whitespace-nowrap` are what make this a scroller rather
  // than a squeezer. A flex item defaults to `min-width: auto`, so without
  // them each link shrinks to its longest word and "Cash Flow" breaks over two
  // lines — the row overflows *and* the labels wrap, which is the worst of
  // both and makes the bar taller on exactly the screens that can least
  // afford it.
  scroll:
    "flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>a]:shrink-0 [&>a]:whitespace-nowrap",
} as const;

/**
 * In-page navigation for the long tool pages. The analyzer stacks a verdict, a
 * grading table, four improvement levers, a projection, and a waterfall in one
 * scroll; this makes that depth reachable rather than hiding it.
 */
export function JumpBar({
  items,
  activeId,
  layout = "wrap",
}: {
  items: JumpItem[];
  activeId: string;
  layout?: keyof typeof LAYOUT;
}) {
  return (
    <nav
      className={`flex gap-1.5 rounded-xl border border-outline-variant bg-surface p-2 shadow-sm ${LAYOUT[layout]}`}
    >
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
