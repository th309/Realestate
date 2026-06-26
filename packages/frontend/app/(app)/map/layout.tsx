import type { Metadata } from "next";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

export const metadata: Metadata = {
  title: "Interactive Real Estate Market Heat Map — 40+ Metrics by ZIP Code",
  description: `Explore the interactive housing market heat map. Visualize home values, rent prices, inventory, and 40+ metrics across ${COVERAGE_COPY.metros} US metros, ${COVERAGE_COPY.counties} counties, and ${COVERAGE_COPY.zips} ZIP codes.`,
  alternates: { canonical: "https://www.propertyiq.app/map" },
  openGraph: {
    title: "Interactive Housing Market Map | PropertyIQ",
    description: `Visualize home values, rent prices, inventory, and 40+ metrics across ${COVERAGE_COPY.metros} US metros and ${COVERAGE_COPY.zips} ZIP codes.`,
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
        description={`Visualize home values, rent prices, inventory, and 40+ metrics across ${COVERAGE_COPY.metros} US metros and ${COVERAGE_COPY.zips} ZIP codes.`}
        breadcrumbs={[
          { name: "Home", url: "https://www.propertyiq.app" },
          { name: "Map", url: "https://www.propertyiq.app/map" },
        ]}
      />
      {children}
    </>
  );
}
