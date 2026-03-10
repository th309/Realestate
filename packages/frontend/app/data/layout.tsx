import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Sources",
  description:
    "Learn about the data sources powering PropertyIQ: Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED, BLS, and BEA. 90+ metrics updated monthly.",
  alternates: { canonical: "https://www.propertyiq.app/data" },
  openGraph: {
    title: "Data Sources | PropertyIQ",
    description:
      "PropertyIQ aggregates data from Zillow, Realtor.com, Redfin, Census, FRED, BLS, and BEA. 90+ metrics.",
    url: "https://www.propertyiq.app/data",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Data Sources",
      },
    ],
  },
};

export default function DataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
