import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing & Plans",
  description:
    "Compare PropertyIQ plans: Free, Pro, and Enterprise. AI-powered market analysis, scores, reports, and maps for real estate professionals.",
  alternates: { canonical: "https://www.propertyiq.app/pricing" },
  openGraph: {
    title: "Pricing & Plans | PropertyIQ",
    description:
      "Compare PropertyIQ plans: Free, Pro, and Enterprise. AI-powered market analysis, scores, reports, and maps.",
    url: "https://www.propertyiq.app/pricing",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Pricing Plans",
      },
    ],
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
