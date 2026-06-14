import AnalyzerClient from "./AnalyzerClient";

export const metadata = {
  title: "Deal Analyzer | PropertyIQ",
  description:
    "Analyze any property: cap rate, cashflow, BRRRR, 70% rule, plus PropertyIQ market context.",
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
