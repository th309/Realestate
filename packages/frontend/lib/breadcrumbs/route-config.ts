/**
 * Global breadcrumb configuration.
 *
 * ROUTE_LABELS maps a full path (cumulative, leading slash) to a friendly
 * label. Anything not listed falls back to a title-cased segment, and opaque
 * dynamic segments (numeric ids / long hashes) are skipped so we never show
 * raw ids like "40380" in the trail. See GlobalBreadcrumbs.tsx.
 */
export const ROUTE_LABELS: Record<string, string> = {
  "/account": "Account",
  "/account/api-keys": "API Keys",
  "/account/billing": "Billing",
  "/account/notifications": "Notifications",
  "/market": "Markets",
  "/markets": "Markets",
  "/reports": "Reports",
  "/reports/research": "Custom Research",
  "/graphs": "Graphs",
  "/screener": "Screener",
  "/scores": "Scores",
  "/scores/methodology": "Methodology",
  "/scores/accuracy": "Accuracy",
  "/analyzer": "Analyzer",
  "/compare": "Compare",
  "/alerts": "Alerts",
  "/data": "Data Sources",
  "/methodology": "Methodology",
  "/blog": "Blog",
  "/about": "About",
  "/about/terms": "Terms",
  "/contact": "Contact",
  "/help": "Help",
  "/pricing": "Pricing",
  "/team": "Team",
  "/upgrade": "Upgrade",
  "/admin": "Admin",
  "/admin/entitlements": "Entitlements",
  "/admin/analytics": "Analytics",
  "/admin/content-pipeline": "Content Pipeline",
};

/**
 * Route prefixes where the global breadcrumb bar should NOT render —
 * full-screen surfaces, auth/onboarding flows, embeds, and the landing page.
 */
export const BREADCRUMB_EXCLUDED_PREFIXES: string[] = [
  "/map", // full-screen interactive map (own in-toolbar breadcrumb)
  "/embed", // embedded widgets — no app chrome
  "/auth", // sign-in / sign-up / callback
  "/activate", // activation flow
  "/get-started", // onboarding
  "/onboarding",
  "/tour",
  "/reports/builder", // full-height report builder
  "/home-v2", // landing variant
];

export function isBreadcrumbExcluded(pathname: string): boolean {
  if (pathname === "/") return true;
  // Market detail pages render their own name-aware breadcrumb in DashboardHeader.
  if (/^\/market\/[^/]+/.test(pathname)) return true;
  return BREADCRUMB_EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
