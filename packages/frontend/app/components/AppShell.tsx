import { Header } from "@/src/components/layout/Header";
import { Providers } from "@/app/providers";
import { DevToolbarLoader } from "@/components/dev/DevToolbarLoader";
import { GoogleAnalytics } from "@/app/components/analytics/GoogleAnalytics";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { AppFooter } from "@/app/components/AppFooter";
import { EnterpriseGraceBanner } from "@/components/entitlements/EnterpriseGraceBanner";
import { EnterpriseOnboardingGate } from "@/components/entitlements/EnterpriseOnboardingGate";

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
 */
export function AppShell({
  initialUserId,
  children,
}: {
  initialUserId: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <GoogleAnalytics />
      <Providers initialUserId={initialUserId}>
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
