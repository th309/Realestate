import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Housing Markets - Browse 925+ US Metro Areas",
  description:
    "Browse AI-powered housing market analysis for 925+ US metro areas. PropertyIQ scores, median home prices, rental demand, trends, and forecasts.",
  alternates: { canonical: "https://www.propertyiq.app/markets" },
};

export default function MarketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
