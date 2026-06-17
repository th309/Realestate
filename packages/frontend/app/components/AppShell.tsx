import { Header } from "@/src/components/layout/Header";
import { Providers } from "@/app/providers";
import { DevToolbarLoader } from "@/components/dev/DevToolbarLoader";
import { GoogleAnalytics } from "@/app/components/analytics/GoogleAnalytics";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { AppFooter } from "@/app/components/AppFooter";
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
      <Providers
        initialUserId={initialUserId}
        initialEntitlementState={initialEntitlementState}
      >
        <Header />
        <EnterpriseGraceBanner />
        <EnterpriseOnboardingGate>
          <AnalyticsProvider>
            <main
              id="main-content"
              className="flex-1 min-h-0 flex flex-col relative"
            >
              {children}
            </main>
          </AnalyticsProvider>
          <AppFooter />
          <DevToolbarLoader />
        </EnterpriseOnboardingGate>
      </Providers>
    </>
  );
}
