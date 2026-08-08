import type { Metadata } from "next";
import { Info, Users, Target, Shield, Database, Scale } from "lucide-react";
import Link from "next/link";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { COVERAGE_COPY, V4_CLAIMS } from "@/lib/data/validation-claims";
import { ABOUT_FAQS } from "./about-faqs";
import { AboutJourneyTimeline } from "./AboutJourneyTimeline";
import { AboutDifferentiators } from "./AboutDifferentiators";

export const metadata: Metadata = {
  title: "About PropertyIQ — Our Mission, Team & Data Sources",
  description: `Learn how PropertyIQ's transparent, validated scoring formula ranks ${COVERAGE_COPY.metros} US metros and ${COVERAGE_COPY.zips} ZIP codes, helping homebuyers, investors, and agents.`,
  alternates: { canonical: "https://www.propertyiq.app/about" },
  openGraph: {
    title: "About PropertyIQ | AI Real Estate Intelligence",
    description: `How PropertyIQ's transparent, validated scoring formula ranks ${COVERAGE_COPY.metros} US metros and ${COVERAGE_COPY.zips} ZIP codes.`,
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
      {/* Named author entity (E-E-A-T) — referenced by the methodology Article's
          author. Establishes who is responsible for the YMYL analysis. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            "@id": "https://www.propertyiq.app/about#troy-h",
            name: "Troy H",
            honorificSuffix: "MBA",
            jobTitle: "Founder",
            url: "https://www.propertyiq.app/about",
            worksFor: { "@id": "https://www.propertyiq.app/#organization" },
            sameAs: ["https://www.linkedin.com/company/propertyiq-app/"],
          }),
        }}
      />
      <div className="min-h-dvh bg-surface">
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
                analyzes millions of data points across {COVERAGE_COPY.metros}{" "}
                US metros, {COVERAGE_COPY.counties} counties, and{" "}
                {COVERAGE_COPY.zips} ZIP codes to deliver actionable insights.
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
                      The PropertyIQ Score:
                    </strong>{" "}
                    a single 1–99 market score that predicts how a market will
                    perform versus its state over the next 3 years
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
                <p className="font-medium text-on-surface">
                  — Troy H, MBA · Founder, PropertyIQ
                </p>
              </div>
            </section>

            {/* Who Builds It — must stay consistent with the first-person
                "Behind PropertyIQ" section above and the Person JSON-LD at the
                top of this page: PropertyIQ is founder-built, not a team. */}
            <section className="mt-12 pt-12 border-t border-outline-variant">
              <h2 className="text-xl font-medium text-on-surface mb-6">
                Who Builds It
              </h2>
              <div className="flex flex-col sm:flex-row gap-8">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-on-surface mb-2">
                    Independent and Founder-Built
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed mb-4">
                    PropertyIQ was founded in 2024 by Troy H, MBA, and is built
                    and maintained by its founder. It is not owned by a listing
                    portal, a brokerage, or a lender, so nobody can pay to have
                    a market scored higher. Plenty of raw housing data already
                    existed — what was missing was a validated, predictive
                    signal for which markets would outperform, published in the
                    open rather than sold as a black box.
                  </p>
                  <p className="text-on-surface-variant leading-relaxed">
                    Being a one-person operation means the work has to stand on
                    its own rather than on a logo. That is why the full formula,
                    its four inputs, and every out-of-sample validation run are
                    published — including the {V4_CLAIMS.ic3Y} information
                    coefficient the PropertyIQ Score earns at metro level over a
                    3-year horizon. You do not have to take our word for any of
                    it; you can check the method.
                  </p>
                </div>
              </div>
            </section>

            <AboutJourneyTimeline />

            <AboutDifferentiators />

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
              <div className="flex flex-col sm:flex-row gap-4">
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
                <Link
                  href="/about/privacy"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Privacy Policy
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
              </div>
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
      <FaqSection faqs={ABOUT_FAQS} />
    </>
  );
}
