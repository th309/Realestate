import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

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

// SEO: Comprehensive metadata for all pages
export const metadata: Metadata = {
  metadataBase: new URL('https://propertyiq.com'),
  title: {
    default: "PropertyIQ - AI-Powered Real Estate Market Intelligence Platform",
    template: "%s | PropertyIQ"
  },
  description: "PropertyIQ helps homebuyers, renters, real estate investors, and agents make smarter property decisions with AI-powered market analysis, neighborhood scores, rental demand data, and investment ROI projections across 384 US metro areas.",
  keywords: [
    // Primary audiences
    "real estate market analysis",
    "home buying tools",
    "rental market data",
    "real estate investing platform",
    "real estate agent tools",
    // Features
    "neighborhood scores",
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
    url: "https://propertyiq.com",
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
    description: "AI-powered market analysis for homebuyers, renters, investors & agents. Neighborhood scores, ROI projections, and rental demand data.",
    images: ["/twitter-image.png"],
    creator: "@propertyiq"
  },
  alternates: {
    canonical: "https://propertyiq.com"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${robotoMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
