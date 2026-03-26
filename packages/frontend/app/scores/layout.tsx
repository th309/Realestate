import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Scores & Rankings — PropertyIQ",
  description:
    "AI-powered scores that predict real estate market performance, validated across 23,000+ locations and 924 metros.",
  alternates: { canonical: "https://www.propertyiq.app/scores" },
  openGraph: {
    title: "Market Scores & Rankings — PropertyIQ",
    description:
      "AI-powered scores predicting real estate market performance, validated across 23,000+ locations.",
    url: "https://www.propertyiq.app/scores",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Scores",
      },
    ],
  },
};

export default function ScoresLayout({
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
