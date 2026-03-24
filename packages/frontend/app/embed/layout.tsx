import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { Suspense } from "react";
import "../globals.css";
import { EmbedProviders } from "./providers";
import { EmbedShell } from "./components";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

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
    <html lang="en">
      <body className={`${roboto.variable} antialiased bg-transparent`}>
        <EmbedProviders>
          <Suspense>
            <EmbedShell>{children}</EmbedShell>
          </Suspense>
        </EmbedProviders>
      </body>
    </html>
  );
}
