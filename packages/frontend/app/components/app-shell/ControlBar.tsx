import type { ReactNode } from "react";

/**
 * The single control row beneath the app bar. The map currently stacks a main
 * nav, a breadcrumb + search + geo-level row, a left icon rail, and a sidebar
 * before you reach the content; everything filter-shaped belongs here instead.
 */
export function ControlBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface px-5 py-3">
      {children}
    </div>
  );
}
