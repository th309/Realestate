"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/src/components/layout/Header";
import { AppBar } from "./AppBar";
import { isAppChromeRoute } from "./app-routes";

/**
 * Picks the site chrome for the current route.
 *
 * `AppShell` is an async Server Component shared by BOTH the `(app)` and
 * `(public)` route groups, so it cannot read the pathname itself — and the
 * groups do not line up with the marketing/tools split anyway (`(app)` holds
 * the homepage, blog, about, and pricing next to the five tools). This client
 * boundary is the smallest place where the decision can actually be made.
 *
 * `usePathname` resolves during SSR, so the correct chrome is in the first
 * painted HTML — there is no light-to-dark flash on a cold load.
 */
export function AppChrome() {
  const pathname = usePathname();
  return isAppChromeRoute(pathname) ? <AppBar /> : <Header />;
}
