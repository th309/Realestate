import Link from "next/link";
import {
  Target,
  Map,
  FileText,
  TrendingUp,
  Search,
  BarChart3,
  Sparkles,
  Layers,
} from "lucide-react";

/**
 * The capability rail under the hero monitor — what the product actually does,
 * in one glance, before the visitor has scrolled anything.
 *
 * The mockup drew these as chips with the first one "on", implying a switcher
 * for the monitor above. They are links instead: a chip that looks selectable
 * and does nothing is worse than one that goes somewhere, and every one of
 * these is a real surface. MCP has no page of its own, so it points at the
 * feature section that describes it.
 */
const CAPABILITIES = [
  { label: "Market Score", href: "/scores", Icon: Target, tone: "tertiary" },
  { label: "Interactive Map", href: "/map", Icon: Map, tone: "primary" },
  { label: "AI Reports", href: "/reports", Icon: FileText, tone: "tertiary" },
  { label: "Forecasts", href: "/market", Icon: TrendingUp, tone: "warning" },
  { label: "Screener", href: "/screener", Icon: Search, tone: "primary" },
  { label: "Comparison", href: "/compare", Icon: BarChart3, tone: "error" },
  { label: "MCP for Claude", href: "#platform", Icon: Sparkles, tone: "teal" },
  { label: "ZIP Drill-Down", href: "/map", Icon: Layers, tone: "violet" },
] as const;

const TILE: Record<(typeof CAPABILITIES)[number]["tone"], string> = {
  primary: "bg-primary text-on-primary",
  tertiary: "bg-tertiary text-on-tertiary",
  warning: "bg-warning text-on-warning",
  error: "bg-error text-on-error",
  teal: "bg-accent-teal text-on-surface",
  violet: "bg-accent-violet text-on-surface",
};

export function HeroCapabilities() {
  return (
    <ul className="mt-8 flex max-w-[660px] list-none flex-wrap justify-center gap-2.5 p-0">
      {CAPABILITIES.map(({ label, href, Icon, tone }) => (
        <li key={label}>
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface py-1.5 pl-2 pr-4 text-[13.5px] font-semibold text-on-surface shadow-sm transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-lg ${TILE[tone]}`}
            >
              <Icon className="size-3.5" strokeWidth={2.2} />
            </span>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
