import type { Metadata } from "next";
import { SeoPageConversionBar } from "@/app/components/seo/SeoPageConversionBar";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const metadata: Metadata = {
  title: `Housing Markets - Browse ${COVERAGE_COPY.metros} US Metro Areas`,
  description: `Browse AI-powered housing market analysis for ${COVERAGE_COPY.metros} US metro areas. PropertyIQ scores, median home prices, rental demand, trends, and forecasts.`,
  alternates: { canonical: "https://www.propertyiq.app/markets" },
};

export default function MarketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <SeoPageConversionBar context="market" />
    </>
  );
}
