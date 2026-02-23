import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Mono, Source_Serif_4, DM_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/src/components/layout/Header";
import { Providers } from "./providers";
import { DevToolbarLoader } from "@/components/dev/DevToolbarLoader";
// import { QuinnFloatingButton } from "./components/quinn/QuinnFloatingButton"; // PAUSED: Quinn development on hold

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
  metadataBase: new URL('https://www.propertyiq.app'),
  title: {
    default: "PropertyIQ - AI-Powered Real Estate Market Intelligence Platform",
    template: "%s | PropertyIQ"
  },
  description: "PropertyIQ helps homebuyers, renters, real estate investors, and agents make smarter property decisions with AI-powered market analysis, market scores, rental demand data, and investment ROI projections across 925 US metros, 3,100+ counties, and 33,000+ ZIP codes.",
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
    "automated market reports"
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
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.propertyiq.app",
    siteName: "PropertyIQ",
    title: "PropertyIQ - AI-Powered Real Estate Market Intelligence",
    description: "Make smarter real estate decisions with AI-powered market analysis for homebuyers, renters, investors, and real estate professionals.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ - Real Estate Market Intelligence Platform"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "PropertyIQ - AI Real Estate Market Intelligence",
    description: "AI-powered market analysis for homebuyers, renters, investors & agents. Market scores, ROI projections, and rental demand data.",
    images: ["/twitter-image.png"],
    creator: "@propertyiq"
  },
  alternates: {
    canonical: "https://www.propertyiq.app"
  },
  category: "Real Estate Technology"
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6750a4" },
    { media: "(prefers-color-scheme: dark)", color: "#d0bcff" }
  ],
  width: "device-width",
  initialScale: 1
};

const showComingSoon = process.env.NEXT_PUBLIC_SHOW_COMING_SOON === 'true';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${robotoMono.variable} ${sourceSerif.variable} ${dmSans.variable} antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <Header />
          {showComingSoon && (
            <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 text-center">
              <p className="text-sm font-medium text-on-surface">
                <span className="inline-flex items-center gap-2">
                  <span className="bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Coming Soon
                  </span>
                  <span className="text-on-surface-variant">
                    PropertyIQ is launching shortly. Stay tuned!
                  </span>
                </span>
              </p>
            </div>
          )}
          <main className="flex-1 min-h-0 flex flex-col">
            {children}
          </main>
          <footer className="flex-shrink-0 bg-surface-container border-t border-outline-variant py-3 px-4 pb-12">
            <p className="text-center text-xs text-on-surface-variant">
              Data is provided for informational purposes only. While we strive for accuracy, we do not guarantee the completeness or correctness of the information and accept no liability for its use.
            </p>
          </footer>
          <DevToolbarLoader />
          {/* <QuinnFloatingButton /> */} {/* PAUSED: Quinn development on hold */}
        </Providers>
      </body>
    </html>
  );
}
