"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Calculator,
  Search,
  FileText,
} from "lucide-react";
import { AppBarActions } from "./AppBarActions";

const TOOLS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
    accent: "bg-primary",
  },
  { href: "/map", label: "Map", Icon: Map, accent: "bg-secondary" },
  {
    href: "/analyzer",
    label: "Analyzer",
    Icon: Calculator,
    accent: "bg-primary",
  },
  { href: "/screener", label: "Screener", Icon: Search, accent: "bg-tertiary" },
  { href: "/reports", label: "Reports", Icon: FileText, accent: "bg-tertiary" },
] as const;

/**
 * The one application bar for every authed tool. Marketing pages stay light;
 * the tools get a dark bar, which signals you have moved from reading to
 * working and separates app chrome from content.
 *
 * Route matching is segment-bounded rather than a bare prefix test, for the
 * same reason `app-routes.ts` is: `/market` must not light up on `/markets`.
 */
export function AppBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-inverse-surface pt-safe-standalone">
      <div className="flex h-14 items-center gap-4 px-5">
        <Link
          href="/"
          aria-label="PropertyIQ home"
          className="flex shrink-0 items-center gap-2 text-inverse-on-surface"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-extrabold text-on-primary">
            P
          </span>
          <span className="text-base font-bold tracking-tight">
            Property<span className="text-inverse-primary">IQ</span>
          </span>
        </Link>

        <nav className="flex gap-1" aria-label="Tools">
          {TOOLS.map(({ href, label, Icon, accent }) => {
            const active =
              pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-primary text-on-primary"
                    : "text-inverse-on-surface/70 hover:text-inverse-on-surface"
                }`}
              >
                <span
                  className={`grid size-[18px] place-items-center rounded-md ${active ? "bg-on-primary/25" : accent}`}
                >
                  <Icon className="size-3 text-on-primary" strokeWidth={2} />
                </span>
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <AppBarActions />
      </div>
    </header>
  );
}
