import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { EmbedProviders } from "./providers";
import { EmbedShell } from "./components";

export const metadata: Metadata = {
  title: "PropertyIQ Embed Widget",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Embed Layout
 *
 * Minimal layout for embeddable widgets — no header, footer, sidebar, or nav.
 * Designed to be rendered inside an iframe on third-party sites.
 *
 * This is a NESTED layout under the root layout (app/layout.tsx), which is the
 * single source of <html>/<body>, fonts, and globals.css. A nested layout MUST
 * NOT render its own <html>/<body> — doing so produces invalid nested document
 * elements and a hydration mismatch (root body bg-surface vs embed body
 * bg-transparent). Instead we wrap the widget in a transparent, full-height
 * container so the host page's background shows through the iframe.
 *
 * Wraps all embed pages with:
 * 1. EmbedProviders — QueryClient, Auth, Entitlements
 * 2. EmbedShell — Reads ?token= from URL, fetches org branding, renders
 *    branded header bar + powered-by footer around the widget content.
 *
 * EmbedShell uses useSearchParams (client component) so it needs a
 * Suspense boundary to avoid CSR bailout.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-transparent">
      <EmbedProviders>
        <Suspense>
          <EmbedShell>{children}</EmbedShell>
        </Suspense>
      </EmbedProviders>
    </div>
  );
}
