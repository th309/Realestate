import { Header } from "@/src/components/layout/Header";
import { GlobalBreadcrumbs } from "@/components/navigation";
import { Providers } from "@/app/providers";
import { DevToolbarLoader } from "@/components/dev/DevToolbarLoader";
import { GoogleAnalytics } from "@/app/components/analytics/GoogleAnalytics";
import { WebVitals } from "@/app/components/analytics/WebVitals";
import { OrganizationJsonLd } from "@/app/components/seo/OrganizationJsonLd";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { AppFooter } from "@/app/components/AppFooter";
import { BottomNavBar } from "@/src/components/layout/BottomNavBar";
import { InstallBanner } from "@/app/components/pwa/InstallBanner";
import { ServiceWorkerManager } from "@/app/components/pwa/ServiceWorkerManager";
import { EnterpriseGraceBanner } from "@/components/entitlements/EnterpriseGraceBanner";
import { EnterpriseOnboardingGate } from "@/components/entitlements/EnterpriseOnboardingGate";
import { fetchEntitlementsServer } from "@/lib/entitlements/server";

/**
 * The application chrome shared by every route group.
 *
 * This is intentionally a Server Component: it renders the client `Providers`
 * boundary but passes the server-rendered `GoogleAnalytics` and `AppFooter`
 * through unchanged, exactly as the root layout did before the route-group
 * split. `initialUserId` is read from the `piq-uid` cookie by whichever group
 * layout wraps it — the authenticated `(app)` group seeds the real id (no auth
 * flash, same as before), while the static `(public)` group passes `null` so it
 * can be statically rendered.
 *
 * Being a Server Component, it also resolves the user's entitlements tier on the
 * server (`fetchEntitlementsServer`) and seeds `Providers` with it, so the first
 * paint already shows the real tier — no `free`-blurred flash before the client
 * refresh lands. Resolves to `null` for anonymous users (static render keeps
 * working) and on any backend miss (client refresh recovers).
 */
export async function AppShell({
  initialUserId,
  children,
}: {
  initialUserId: string | null;
  children: React.ReactNode;
}) {
  const initialEntitlementState = await fetchEntitlementsServer(initialUserId);

  return (
    <>
      <GoogleAnalytics />
      <WebVitals />
      {/* Sitewide publisher entity (E-E-A-T) — present on every page, not just home. */}
      <OrganizationJsonLd />
      <Providers
        initialUserId={initialUserId}
        initialEntitlementState={initialEntitlementState}
      >
        <Header />
        <GlobalBreadcrumbs />
        <EnterpriseGraceBanner />
        <EnterpriseOnboardingGate>
          <AnalyticsProvider>
            <main
              id="main-content"
              className="flex-1 min-h-0 flex flex-col relative overflow-x-clip"
            >
              {children}
            </main>
          </AnalyticsProvider>
          <AppFooter />
          {/* PWA chrome: bottom tabs render their own flow spacer (blocklisted
              routes get neither bar nor gap); banner + SW manager are fixed
              overlays and render null until their own conditions are met. */}
          <BottomNavBar />
          <InstallBanner />
          <ServiceWorkerManager />
          <DevToolbarLoader />
        </EnterpriseOnboardingGate>
      </Providers>
    </>
  );
}
