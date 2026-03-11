import type { Metadata } from "next";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

export const metadata: Metadata = {
  title: "Housing Market Graphs & Trends",
  description:
    "Interactive charts and graphs showing housing market trends, price history, inventory levels, and economic indicators across US metros.",
  alternates: { canonical: "https://www.propertyiq.app/graphs" },
  openGraph: {
    title: "Housing Market Graphs & Trends | PropertyIQ",
    description:
      "Interactive charts showing housing market trends, price history, inventory levels, and economic indicators.",
    url: "https://www.propertyiq.app/graphs",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Market Graphs",
      },
    ],
  },
};

export default function GraphsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WebPageJsonLd
        url="https://www.propertyiq.app/graphs"
        name="Housing Market Graphs & Trends"
        description="Interactive charts and graphs showing housing market trends across US metros."
        breadcrumbs={[
          { name: "Home", url: "https://www.propertyiq.app" },
          { name: "Graphs", url: "https://www.propertyiq.app/graphs" },
        ]}
      />
      {children}
    </>
  );
}
