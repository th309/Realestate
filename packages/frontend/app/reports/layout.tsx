import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Reports",
  description:
    "AI-generated real estate market reports with data-driven analysis, scores, and forecasts for any US metro area.",
  alternates: { canonical: "https://www.propertyiq.app/reports" },
  openGraph: {
    title: "Market Reports | PropertyIQ",
    description:
      "AI-generated real estate market reports with data-driven analysis, scores, and forecasts.",
    url: "https://www.propertyiq.app/reports",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Market Reports",
      },
    ],
  },
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
