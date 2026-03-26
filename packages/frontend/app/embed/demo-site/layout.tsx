import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Acme Real Estate Group",
  description:
    "Your trusted real estate partner — market intelligence powered by data.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Demo Brokerage Site Layout
 *
 * Standalone layout that simulates a third-party brokerage website
 * ("Acme Real Estate Group") embedding PropertyIQ widgets via iframes.
 *
 * Uses its OWN styling — serif headings, sans body text, white/navy color
 * scheme — intentionally separate from the PropertyIQ M3 design system.
 */
export default function DemoSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#1e3a5f",
          backgroundColor: "#ffffff",
        }}
      >
        {children}
      </body>
    </html>
  );
}
