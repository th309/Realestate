import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare PropertyIQ",
  description:
    "See how PropertyIQ compares to other real estate analytics platforms like Mashvisor, NeighborhoodScout, and Reventure.",
  alternates: { canonical: "https://www.propertyiq.app/compare" },
  openGraph: {
    title: "Compare PropertyIQ | Platform Comparisons",
    description:
      "See how PropertyIQ compares to Mashvisor, NeighborhoodScout, Reventure, and other real estate analytics platforms.",
    url: "https://www.propertyiq.app/compare",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Compare PropertyIQ",
      },
    ],
  },
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="max-w-4xl mx-auto px-4 py-8">{children}</div>;
}
