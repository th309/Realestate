import type { Metadata } from "next";
import { Info, Users, Target, Shield, Database, Scale } from "lucide-react";
import Link from "next/link";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

export const metadata: Metadata = {
  title: "About PropertyIQ — Our Mission, Team & Data Sources",
  description:
    "Learn how PropertyIQ uses machine learning to analyze 925 US metros and 33,000+ ZIP codes, helping homebuyers, investors, and agents.",
  alternates: { canonical: "https://www.propertyiq.app/about" },
  openGraph: {
    title: "About PropertyIQ | AI Real Estate Intelligence",
    description:
      "How PropertyIQ uses machine learning to analyze 925 US metros and 33,000+ ZIP codes.",
    url: "https://www.propertyiq.app/about",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "About PropertyIQ",
      },
    ],
  },
};

export default function AboutPage() {
  return (
    <>
      <WebPageJsonLd
        url="https://www.propertyiq.app/about"
        name="About PropertyIQ"
        description="AI-powered real estate intelligence for smarter property decisions"
        breadcrumbs={[
          { name: "Home", url: "https://www.propertyiq.app" },
          { name: "About", url: "https://www.propertyiq.app/about" },
        ]}
      />
      <div className="min-h-screen bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <PageHeaderWithBreadcrumbs
            breadcrumbs={[{ label: "About" }]}
            title="About PropertyIQ"
            description="AI-powered real estate intelligence for smarter property decisions"
            icon={<Info className="w-5 h-5" />}
          />

          <div className="mt-12 space-y-12">
            {/* Mission */}
            <section>
              <h2 className="text-xl font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Our Mission
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                PropertyIQ was built to democratize real estate data. We believe
                everyone, from first-time homebuyers to seasoned investors,
                deserves access to the same market intelligence that was once
                reserved for institutional players. Our AI-powered platform
                analyzes millions of data points across 925 US metros, 3,100+
                counties, and 33,000+ ZIP codes to deliver actionable insights.
              </p>
            </section>

            {/* What We Offer */}
            <section>
              <h2 className="text-xl font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                What We Offer
              </h2>
              <ul className="space-y-3 text-on-surface-variant">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>
                    <strong className="text-on-surface">
                      Proprietary Scores:
                    </strong>{" "}
                    HomeReady Score for livability, InvestorEdge Score for
                    investment potential
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>
                    <strong className="text-on-surface">
                      Interactive Maps:
                    </strong>{" "}
                    Explore markets from national down to ZIP code level
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>
                    <strong className="text-on-surface">
                      Market Analytics:
                    </strong>{" "}
                    Track trends, compare regions, and forecast changes
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>
                    <strong className="text-on-surface">Custom Reports:</strong>{" "}
                    Generate professional market analysis with our drag-and-drop
                    builder
                  </span>
                </li>
              </ul>
            </section>

            {/* Behind PropertyIQ */}
            <section>
              <h2 className="text-xl font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Behind PropertyIQ
              </h2>
              <div className="space-y-4 text-on-surface-variant leading-relaxed">
                <p>
                  PropertyIQ was born out of a simple frustration: real estate
                  data is everywhere, but it&apos;s scattered, contradictory,
                  and overwhelming. As someone deeply passionate about real
                  estate, I kept running into the same problem. Dozens of
                  sources telling different stories, making it nearly impossible
                  to see the full picture without hours of manual research.
                </p>
                <p>
                  I built PropertyIQ to solve that. The goal is to take
                  complicated and often conflicting data and condense it down
                  into manageable, actionable information. Technology is
                  changing fast around us, and by leveraging the power of AI we
                  can make sense of an overwhelming amount of information,
                  helping people make decisions faster and with more clarity.
                </p>
                <p>
                  Whether you&apos;re buying your first home or evaluating your
                  next investment, you deserve access to clear, trustworthy
                  insights without needing a data science degree to understand
                  them.
                </p>
              </div>
            </section>

            {/* Our Team */}
            <section className="mt-12 pt-12 border-t border-outline-variant">
              <h2 className="text-xl font-medium text-on-surface mb-6">
                Our Team
              </h2>
              <div className="flex flex-col sm:flex-row gap-8">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-on-surface mb-2">
                    Built by Data Scientists, for Real People
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed mb-4">
                    PropertyIQ was founded in 2024 by a team of data scientists
                    and real estate professionals who saw a gap in the market:
                    plenty of raw data existed, but no platform was using
                    machine learning to actually predict which markets would
                    outperform. The founders combined expertise in quantitative
                    finance, real estate investment, and machine learning
                    engineering to build a scoring system that doesn&apos;t just
                    describe markets — it predicts their future performance.
                  </p>
                  <p className="text-on-surface-variant leading-relaxed">
                    The team&apos;s background spans hedge fund analytics, real
                    estate portfolio management, and production ML systems. This
                    cross-disciplinary expertise is why PropertyIQ&apos;s scores
                    achieve a 0.37 out-of-sample Information Coefficient — a
                    level of predictive accuracy typically found only in
                    institutional-grade analytics tools.
                  </p>
                </div>
              </div>
            </section>

            {/* Our Journey */}
            <section className="mt-12 pt-12 border-t border-outline-variant">
              <h2 className="text-xl font-medium text-on-surface mb-6">
                Our Journey
              </h2>
              <div className="space-y-6">
                {[
                  {
                    date: "2024",
                    event:
                      "PropertyIQ founded with a mission to democratize real estate market intelligence",
                  },
                  {
                    date: "Early 2025",
                    event:
                      "First scoring models trained on 6 years of historical data across 924 metros",
                  },
                  {
                    date: "Mid 2025",
                    event:
                      "Walk-forward validation completed: 0.37 OOS IC confirmed across 4 time windows",
                  },
                  {
                    date: "Late 2025",
                    event:
                      "Platform expanded to cover 33,000+ ZIP codes and 3,100+ counties",
                  },
                  {
                    date: "2026",
                    event:
                      "Public beta launch with AI-generated market reports and interactive analytics",
                  },
                ].map((milestone) => (
                  <div key={milestone.date} className="flex gap-6 items-start">
                    <span className="text-sm font-medium text-primary whitespace-nowrap min-w-[100px]">
                      {milestone.date}
                    </span>
                    <p className="text-on-surface-variant">{milestone.event}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* What Makes PropertyIQ Different */}
            <section className="mt-12 pt-12 border-t border-outline-variant">
              <h2 className="text-xl font-medium text-on-surface mb-6">
                What Makes PropertyIQ Different
              </h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-surface-container-low">
                  <h3 className="font-medium text-on-surface mb-2">
                    Predictive, Not Just Descriptive
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Most real estate platforms show you what happened.
                    PropertyIQ predicts what will happen, using validated
                    machine learning models that have been tested against actual
                    market outcomes.
                  </p>
                </div>
                <div className="p-6 rounded-xl bg-surface-container-low">
                  <h3 className="font-medium text-on-surface mb-2">
                    Validated with Real Data
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Our scores are walk-forward validated across 4
                    non-overlapping time windows. We publish our accuracy
                    metrics openly — something most competitors don&apos;t do.
                  </p>
                </div>
                <div className="p-6 rounded-xl bg-surface-container-low">
                  <h3 className="font-medium text-on-surface mb-2">
                    Comprehensive Coverage
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    925 metros, 3,100+ counties, 33,000+ ZIP codes. From major
                    cities to small towns, PropertyIQ covers every corner of the
                    US housing market.
                  </p>
                </div>
                <div className="p-6 rounded-xl bg-surface-container-low">
                  <h3 className="font-medium text-on-surface mb-2">
                    Transparent Methodology
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    We publish our full methodology, validation results, and
                    data sources. You can see exactly how scores are calculated
                    and verified.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Sources */}
            <section>
              <h2 className="text-xl font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Data Sources
              </h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                PropertyIQ aggregates data from trusted public and private
                sources including Realtor.com, Zillow, the U.S. Census Bureau,
                FRED, BLS, and BEA. We update metrics monthly to ensure you
                always have the latest picture.
              </p>
              <Link
                href="/data"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View all data sources
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </section>

            {/* Legal */}
            <section>
              <h2 className="text-xl font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                Legal
              </h2>
              <Link
                href="/about/terms"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Terms of Service
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </section>

            {/* CTA */}
            <div className="pt-8 border-t border-outline-variant">
              <p className="text-on-surface-variant mb-4">
                Ready to explore smarter real estate insights?
              </p>
              <a
                href="/map"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Start Exploring
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
