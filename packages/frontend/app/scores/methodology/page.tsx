import fs from "fs";
import path from "path";
import {
  DollarSign,
  Briefcase,
  Target,
  Database,
  TrendingUp,
  Shield,
  CheckCircle,
  FileText,
} from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { DollarImpactSection } from "./DollarImpactSection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — How PropertyIQ Scores Predict Market Performance",
  description:
    "Out-of-sample validated across more than two decades of market data. See the statistical proof behind PropertyIQ Demand Signal Scores.",
  alternates: { canonical: "https://www.propertyiq.app/scores/methodology" },
  openGraph: {
    title: "Methodology — How PropertyIQ Scores Predict Market Performance",
    description:
      "Out-of-sample validated across more than two decades of market data. See the statistical proof behind PropertyIQ Demand Signal Scores.",
    url: "https://www.propertyiq.app/scores/methodology",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

const STATS = [
  {
    icon: DollarSign,
    value: "$21,741",
    label: "Extra equity — top vs bottom scored market, within state (3yr)",
  },
  {
    icon: Briefcase,
    value: "$65,200",
    label: "Extra appreciation on a 3-property portfolio (3yr)",
  },
  {
    icon: Target,
    value: "100%",
    label: "Validated years with a positive score-to-return link",
  },
  {
    icon: Database,
    value: "38,000+",
    label: "Locations scored across metro, county, and ZIP",
  },
];

// Mean annualized 3-year excess return vs state, by metro score band.
const QUINTILES = [
  { label: "Q5 (Top 20%)", range: "81–99", return: 0.38, width: 100 },
  { label: "Q4", range: "61–80", return: 0.08, width: 72 },
  { label: "Q3", range: "41–60", return: -0.13, width: 52 },
  { label: "Q2", range: "21–40", return: -0.46, width: 32 },
  { label: "Q1 (Bottom 20%)", range: "1–20", return: -1.29, width: 10 },
];

const KEY_FINDINGS = [
  {
    icon: Shield,
    iconClass: "bg-secondary/10 p-2 rounded-xl text-secondary w-fit",
    title: "Walk-Forward & Out-of-Sample Tested",
    description:
      "Features were selected with walk-forward analysis — trained on earlier years, tested on later ones. The final equal-weight formula has no fitted parameters, so every score is out-of-sample: measured against returns that came after the score date. Positive IC in every validated year (2001–2023).",
  },
  {
    icon: TrendingUp,
    iconClass: "bg-primary/10 p-2 rounded-xl text-primary w-fit",
    title: "Consistent Across Geographies",
    description:
      "Validated at metro (IC 0.27), county (0.20), and ZIP (0.20) levels. Strictly monotonic score-to-return bands at every level — no reversals.",
  },
  {
    icon: CheckCircle,
    iconClass: "bg-tertiary/10 p-2 rounded-xl text-tertiary w-fit",
    title: "PropertyIQ Demand Signal",
    description:
      "Four signals — Zillow price momentum (3- and 12-month) plus Realtor.com days on market and price-cut share — combined into one interpretable score. Significant at p < 0.000001 (permutation test, 52–201σ above the null).",
  },
];

function resolveReportPath() {
  const candidates = [
    // Co-located file (works in Docker/Vercel where docs/ isn't available)
    path.join(
      process.cwd(),
      "app",
      "scores",
      "methodology",
      "validation-report.md",
    ),
    // Workspace root (Turbopack dev: cwd = workspace root)
    path.join(
      process.cwd(),
      "packages",
      "frontend",
      "app",
      "scores",
      "methodology",
      "validation-report.md",
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export default function MethodologyPage() {
  const reportContent = fs.readFileSync(resolveReportPath(), "utf-8");

  return (
    <div className="mt-12 space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: "How PropertyIQ Scores Predict Market Performance",
                description:
                  "Out-of-sample validated across more than two decades of market data. Technical methodology behind the PropertyIQ Score.",
                datePublished: "2026-02-10",
                dateModified: new Date().toISOString().split("T")[0],
                author: {
                  "@type": "Organization",
                  name: "PropertyIQ",
                  url: "https://www.propertyiq.app",
                },
                publisher: {
                  "@id": "https://www.propertyiq.app/#organization",
                },
                mainEntityOfPage:
                  "https://www.propertyiq.app/scores/methodology",
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: "https://www.propertyiq.app",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Scores",
                    item: "https://www.propertyiq.app/scores",
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: "Methodology",
                    item: "https://www.propertyiq.app/scores/methodology",
                  },
                ],
              },
            ],
          }),
        }}
      />
      {/* Header */}
      <section>
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: "Scores", href: "/scores" },
            { label: "Methodology" },
          ]}
          title="The Proof Behind PropertyIQ Scores"
          description="Out-of-sample validated across more than two decades of market data"
          icon={<Target className="w-5 h-5" />}
        />
      </section>

      {/* Marketing Stats */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.value}
                className="bg-surface-container rounded-2xl p-5 border border-outline-variant"
              >
                <div className="p-2 bg-primary-container rounded-xl text-on-primary-container w-fit">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-on-surface mt-3">
                  {stat.value}
                </p>
                <p className="text-sm text-on-surface-variant mt-1">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quintile Comparison */}
      <section>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Performance By Score Quintile
        </p>
        <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
          How Scores Predict Returns
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          The PropertyIQ Score, validated across more than two decades of market
          outcomes. Higher scores consistently predict higher 3-year excess
          returns versus the market&apos;s state.
        </p>

        <div className="mt-8 space-y-3">
          {QUINTILES.map((q) => (
            <div key={q.label} className="flex items-center gap-4">
              <div className="w-32 text-sm text-on-surface-variant shrink-0">
                {q.label}
              </div>
              <div className="flex-1 h-8 bg-surface-container rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg ${q.return >= 0 ? "bg-primary/30" : "bg-error/30"}`}
                  style={{ width: `${q.width}%` }}
                />
              </div>
              <div
                className={`w-20 text-sm font-semibold text-right ${q.return >= 0 ? "text-primary" : "text-error"}`}
              >
                {q.return >= 0 ? "+" : ""}
                {q.return.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-primary-container/30 rounded-xl border border-primary/20">
          <p className="text-sm font-medium text-on-surface">
            Top-20% scored markets outperformed their state by{" "}
            <span className="text-primary font-bold">
              about 1.7 percentage points more per year
            </span>{" "}
            than bottom-20% scored markets. Within the same state, a top-band
            market outperforms a bottom-band market by{" "}
            <span className="text-primary font-bold">about $21,700</span> over 3
            years on a $252K home.
          </p>
        </div>
      </section>

      {/* Dollar Impact — The Cost of Choosing Wrong */}
      <DollarImpactSection />

      {/* Key Findings */}
      <section>
        <div className="grid md:grid-cols-2 gap-4">
          {KEY_FINDINGS.map((finding) => {
            const Icon = finding.icon;
            return (
              <div
                key={finding.title}
                className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant"
              >
                <div className={finding.iconClass}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-on-surface mt-3">
                  {finding.title}
                </h3>
                <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                  {finding.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Technical Validation Report */}
      <section id="technical-report" className="mt-16">
        <div className="border-t border-outline-variant pt-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
              Technical Validation Report
            </p>
          </div>
          <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
            Demand signal validation with walk-forward cross-validation and
            permutation testing
          </h2>
          <p className="text-sm text-on-surface-variant mt-2 mb-8">
            Full methodology and results from the PropertyIQ scoring validation,
            covering January 2001 through 2023 across 5.7M scored
            location-periods.
          </p>
          <MarkdownRenderer content={reportContent} />
        </div>
      </section>
    </div>
  );
}
