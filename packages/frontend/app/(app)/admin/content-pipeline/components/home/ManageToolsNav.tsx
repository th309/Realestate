/**
 * Manage tools — a compact secondary nav so every content-pipeline surface
 * stays reachable from the home without cluttering the task-first layout.
 * Named by what the operator manages, not by route.
 */
import Link from "next/link";

interface ToolLink {
  label: string;
  href: string;
}

const TOOLS: ToolLink[] = [
  { label: "Review queue", href: "/admin/content-pipeline/review" },
  { label: "Planner", href: "/admin/content-pipeline/planner" },
  { label: "Insights", href: "/admin/content-pipeline/insights" },
  { label: "Platforms", href: "/admin/content-pipeline/platforms" },
  { label: "Performance", href: "/admin/content-pipeline/performance" },
  { label: "Auto-ideation", href: "/admin/content-pipeline/auto-ideation" },
  { label: "Lead magnets", href: "/admin/content-pipeline/lead-magnets" },
  {
    label: "Style references",
    href: "/admin/content-pipeline/style-references",
  },
  { label: "Archetypes", href: "/admin/content-pipeline/archetypes" },
  { label: "Settings", href: "/admin/content-pipeline/settings" },
];

export function ManageToolsNav() {
  return (
    <nav
      aria-label="Manage content pipeline"
      className="border-t border-outline-variant pt-5"
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
        Manage
      </h2>
      <ul className="flex flex-wrap gap-2">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="inline-flex rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm text-on-surface transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {tool.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
