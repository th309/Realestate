import type { Metadata } from "next";
import { SeoPageConversionBar } from "@/app/components/seo/SeoPageConversionBar";

export const metadata: Metadata = {
  title: "Blog - Housing Market Insights & Analysis",
  description:
    "Data-driven housing market analysis, investment insights, and AI-powered forecasts from the PropertyIQ research team. Updated weekly.",
  alternates: {
    canonical: "https://www.propertyiq.app/blog",
    types: {
      "application/rss+xml": "https://www.propertyiq.app/blog/rss.xml",
    },
  },
  openGraph: {
    title: "PropertyIQ Blog | Housing Market Insights",
    description:
      "Data-driven housing market analysis, investment insights, and AI-powered forecasts from PropertyIQ.",
    url: "https://www.propertyiq.app/blog",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Blog",
      },
    ],
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">{children}</div>
      <SeoPageConversionBar context="blog" />
    </>
  );
}
