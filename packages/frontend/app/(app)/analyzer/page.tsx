import AnalyzerClient from "./AnalyzerClient";

export const metadata = {
  title: "Deal Analyzer",
  description:
    "Analyze any property: cap rate, cashflow, BRRRR, 70% rule, plus PropertyIQ market context.",
  alternates: { canonical: "https://www.propertyiq.app/analyzer" },
};

export default function AnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{
    address?: string;
    zip?: string;
  }>;
}) {
  return <AnalyzerClient searchParamsPromise={searchParams} />;
}
