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
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — How PropertyIQ Scores Predict Market Performance",
  description:
    "Walk-forward validated across 6 years of market data. See the statistical proof behind PropertyIQ Scores.",
  alternates: { canonical: "https://www.propertyiq.app/scores/methodology" },
  openGraph: {
    title: "Methodology — How PropertyIQ Scores Predict Market Performance",
    description:
      "Walk-forward validated across 6 years of market data. See the statistical proof behind PropertyIQ Scores.",
    url: "https://www.propertyiq.app/scores/methodology",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

const STATS = [
  {
    icon: DollarSign,
    value: "$39,900",
    label: "More equity on a typical home over 3 years",
  },
  {
    icon: Briefcase,
    value: "$119,800",
    label: "Extra appreciation on a 3-property portfolio (3yr)",
  },
  {
    icon: Target,
    value: "69.5%",
    label: "Hit rate — top-scored markets beat benchmark",
  },
  {
    icon: Database,
    value: "23,000+",
    label: "Locations scored and tracked",
  },
];

const QUINTILES = [
  { label: "Q5 (Top 20%)", range: "80–100", return: 2.78, width: 100 },
  { label: "Q4", range: "61–80", return: 1.11, width: 60 },
  { label: "Q3", range: "41–60", return: 0.0, width: 35 },
  { label: "Q2", range: "21–40", return: -1.11, width: 20 },
  { label: "Q1 (Bottom 20%)", range: "0–20", return: -2.77, width: 5 },
];

const KEY_FINDINGS = [
  {
    icon: Shield,
    iconClass: "bg-secondary/10 p-2 rounded-xl text-secondary w-fit",
    title: "Walk-Forward Validated",
    description:
      "Four non-overlapping walk-forward windows (2018–2023) ensure the model never sees future data. Positive OOS IC in every window for all score types.",
  },
  {
    icon: TrendingUp,
    iconClass: "bg-primary/10 p-2 rounded-xl text-primary w-fit",
    title: "Consistent Across Geographies",
    description:
      "Predictive at metro (IC 0.37), county (IC 0.25), and ZIP code (IC 0.18) levels. Works everywhere, not just cherry-picked markets.",
  },
  {
    icon: CheckCircle,
    iconClass: "bg-tertiary/10 p-2 rounded-xl text-tertiary w-fit",
    title: "v3.0: Model Tournament",
    description:
      "XGBoost, LightGBM, and ElasticNet compete per geography. SHAP values distilled to interpretable 10-feature linear formulas.",
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
                  "Walk-forward validated across 6 years of market data. Technical methodology behind PropertyIQ's AI-powered real estate scores.",
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
          description="Walk-forward validated across 6 years of market data"
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
          Metro InvestorEdge scores, validated across 4 walk-forward windows.
          Higher scores consistently predict higher excess returns vs state
          benchmarks.
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
            Top-20% scored markets earned{" "}
            <span className="text-primary font-bold">
              5.55 percentage points more
            </span>{" "}
            per year than bottom-20% scored markets — $13,320 annually on a
            $240K home.
          </p>
        </div>
      </section>

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
            Model tournament with walk-forward cross-validation and SHAP
            distillation
          </h2>
          <p className="text-sm text-on-surface-variant mt-2 mb-8">
            Full methodology and results from our v3.0 scoring model validation,
            covering January 2018 through December 2023.
          </p>
          <MarkdownRenderer content={reportContent} />
        </div>
      </section>
    </div>
  );
}
