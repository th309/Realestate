import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Market Reports",
  description:
    "Generate AI-powered market reports for any US metro, county, or ZIP code. Get personalized analysis for homebuyers and investors with PropertyIQ.",
  alternates: { canonical: "https://www.propertyiq.app/reports" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "AI Market Reports | PropertyIQ",
    description:
      "Generate AI-powered market reports for any US metro, county, or ZIP code. Personalized analysis for homebuyers and investors.",
    url: "https://www.propertyiq.app/reports",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ AI Market Reports",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Market Reports | PropertyIQ",
    description:
      "Generate AI-powered market reports for any US metro, county, or ZIP code.",
    images: ["/twitter-image.png"],
  },
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
