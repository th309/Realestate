import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Roboto, Roboto_Mono, Source_Serif_4, DM_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/src/components/layout/Header";
import { Providers } from "./providers";
import { DevToolbarLoader } from "@/components/dev/DevToolbarLoader";
import { GoogleAnalytics } from "./components/analytics/GoogleAnalytics";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { AppFooter } from "./components/AppFooter";
import { EnterpriseGraceBanner } from "@/components/entitlements/EnterpriseGraceBanner";
import { EnterpriseOnboardingGate } from "@/components/entitlements/EnterpriseOnboardingGate";

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
  description:
    "PropertyIQ helps homebuyers, renters, real estate investors, and agents make smarter property decisions with AI-powered market analysis, market scores, rental demand data, and investment ROI projections across 925 US metros, 3,100+ counties, and 33,000+ ZIP codes.",
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
    creator: "@propertyiq",
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialUserId = cookieStore.get("piq-uid")?.value ?? null;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link
          rel="preconnect"
          href="https://backend-production-ee4d.up.railway.app"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${roboto.variable} ${robotoMono.variable} ${sourceSerif.variable} ${dmSans.variable} antialiased min-h-screen flex flex-col bg-surface text-on-surface`}
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
      </body>
    </html>
  );
}
