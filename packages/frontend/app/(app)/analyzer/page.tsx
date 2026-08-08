import AnalyzerClient from "./AnalyzerClient";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { ANALYZER_FAQS } from "./analyzer-faqs";

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
  return (
    <>
      <AnalyzerClient searchParamsPromise={searchParams} />
      {/* Same container as the tool above, so the FAQ starts on the same left
          edge instead of floating in from a narrower centred box. It keeps its
          own prose measure inside that container.

          `w-full` is required, not decorative: this is a direct flex item of
          AppShell's column `<main>`, where `mx-auto` alone makes the box
          shrink to fit-content and centre — which reproduced the exact
          misalignment it is here to fix. */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <FaqSection faqs={ANALYZER_FAQS} align="start" />
      </div>
    </>
  );
}
