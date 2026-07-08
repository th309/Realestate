import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Mono, Source_Serif_4, DM_Sans } from "next/font/google";
import "./globals.css";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import WebMcpProvider from "./components/agent/WebMcpProvider";

// M3 Typography: Roboto is the standard Material Design typeface
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// Editorial Typography for Reports
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// SEO: Comprehensive metadata for all pages
export const metadata: Metadata = {
  metadataBase: new URL("https://www.propertyiq.app"),
  title: {
    default: "PropertyIQ - AI-Powered Real Estate Market Intelligence Platform",
    template: "%s | PropertyIQ",
  },
  description: `PropertyIQ helps homebuyers, renters, real estate investors, and agents make smarter property decisions with AI-powered market analysis, market scores, rental demand data, and investment ROI projections across ${COVERAGE_COPY.sentence}.`,
  keywords: [
    // Primary audiences
    "real estate market analysis",
    "home buying tools",
    "rental market data",
    "real estate investing platform",
    "real estate agent tools",
    // Features
    "market scores",
    "property investment ROI",
    "rental demand analysis",
    "home value trends",
    "market heat index",
    // Geographic
    "US real estate data",
    "metro area housing market",
    "local market insights",
    // AI/Tech
    "AI real estate analysis",
    "predictive housing analytics",
    "automated market reports",
  ],
  authors: [{ name: "PropertyIQ" }],
  creator: "PropertyIQ",
  publisher: "PropertyIQ",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.propertyiq.app",
    siteName: "PropertyIQ",
    title: "PropertyIQ - AI-Powered Real Estate Market Intelligence",
    description:
      "Make smarter real estate decisions with AI-powered market analysis for homebuyers, renters, investors, and real estate professionals.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ - Real Estate Market Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PropertyIQ - AI Real Estate Market Intelligence",
    description:
      "AI-powered market analysis for homebuyers, renters, investors & agents. Market scores, ROI projections, and rental demand data.",
    images: ["/twitter-image.png"],
    // No creator/site handle: @propertyiq on X is not controlled by us —
    // attributing cards to a handle we don't own feeds entity confusion.
  },
  // Canonical URLs are set per-page in each route's metadata/layout.
  // Do NOT set a global canonical here — it overrides all child routes.
  category: "Real Estate Technology",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3949AB" },
    { media: "(prefers-color-scheme: dark)", color: "#7986CB" },
  ],
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to resolve to non-zero on notched
  // devices — fixed bottom bars and sheets pad against the home indicator.
  viewportFit: "cover",
};

// The root layout intentionally does NOT read cookies. Reading `cookies()` here
// would opt EVERY route out of static rendering. The application chrome and the
// `piq-uid` auth seed now live in the per-group layouts (see app/(app)/layout.tsx
// and app/(public)/layout.tsx) so that the public SEO pages can be statically
// rendered / ISR-cached while the authenticated app stays dynamic + seeded.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" />
        {/*
          No backend preconnect: the browser never talks to the backend host
          directly. All data requests are same-origin (`/backend/*`, proxied
          server-side) so ad blockers don't reject them as third-party. See
          lib/data/fetchers/api-url.ts and app/backend/[[...path]]/route.ts.
        */}
      </head>
      <body
        className={`${roboto.variable} ${robotoMono.variable} ${sourceSerif.variable} ${dmSans.variable} antialiased min-h-dvh flex flex-col bg-surface text-on-surface`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-primary focus:text-on-primary focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <noscript>
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              fontFamily: "sans-serif",
            }}
          >
            <h1>JavaScript Required</h1>
            <p>
              PropertyIQ requires JavaScript to function. Please enable
              JavaScript in your browser settings.
            </p>
          </div>
        </noscript>
        <WebMcpProvider />
        {children}
      </body>
    </html>
  );
}
