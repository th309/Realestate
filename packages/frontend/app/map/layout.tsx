import type { Metadata } from "next";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

export const metadata: Metadata = {
  title: "Interactive Housing Market Map",
  description:
    "Explore the interactive housing market heat map. Visualize home values, rent prices, inventory, and 40+ metrics across 925 US metros and 33,000+ ZIP codes.",
  alternates: { canonical: "https://www.propertyiq.app/map" },
  openGraph: {
    title: "Interactive Housing Market Map | PropertyIQ",
    description:
      "Visualize home values, rent prices, inventory, and 40+ metrics across 925 US metros and 33,000+ ZIP codes.",
    url: "https://www.propertyiq.app/map",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Interactive Housing Map",
      },
    ],
  },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WebPageJsonLd
        url="https://www.propertyiq.app/map"
        name="Interactive Housing Market Map"
        description="Visualize home values, rent prices, inventory, and 40+ metrics across 925 US metros and 33,000+ ZIP codes."
        breadcrumbs={[
          { name: "Home", url: "https://www.propertyiq.app" },
          { name: "Map", url: "https://www.propertyiq.app/map" },
        ]}
      />
      {children}
    </>
  );
}
