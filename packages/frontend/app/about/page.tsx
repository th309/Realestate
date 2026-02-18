import { Info, Users, Target, Shield, Database } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'About' }]}
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
              PropertyIQ was built to democratize real estate data. We believe everyone—from first-time
              homebuyers to seasoned investors—deserves access to the same market intelligence that was
              once reserved for institutional players. Our AI-powered platform analyzes millions of data
              points across 925 US metros, 3,100+ counties, and 33,000+ ZIP codes to deliver actionable insights.
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
                <span><strong className="text-on-surface">Proprietary Scores:</strong> HomeReady Score for livability, InvestorEdge Score for investment potential</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span><strong className="text-on-surface">Interactive Maps:</strong> Explore markets from national down to ZIP code level</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span><strong className="text-on-surface">Market Analytics:</strong> Track trends, compare regions, and forecast changes</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span><strong className="text-on-surface">Custom Reports:</strong> Generate professional market analysis with our drag-and-drop builder</span>
              </li>
            </ul>
          </section>

          {/* Team */}
          <section>
            <h2 className="text-xl font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Our Team
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
              We&apos;re a team of data scientists, real estate professionals, and engineers passionate
              about making real estate decisions easier. Based in Austin, TX, we combine local market
              expertise with cutting-edge AI technology.
            </p>
          </section>

          {/* Data Sources */}
          <section>
            <h2 className="text-xl font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Data Sources
            </h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              PropertyIQ aggregates data from trusted public and private sources including Realtor.com,
              Zillow, the U.S. Census Bureau, FRED, BLS, and BEA. We update metrics monthly to ensure
              you always have the latest picture.
            </p>
            <Link
              href="/data"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all data sources
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
  );
}
