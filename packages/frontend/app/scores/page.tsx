import { Target, TrendingUp, Shield, ArrowRight, Database, Brain, Award } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';

const scoreCards = [
  {
    name: 'HomeReady Score',
    icon: TrendingUp,
    iconContainer: 'bg-primary-container text-on-primary-container',
    description:
      'Predicts home price appreciation potential. Best for homebuyers and primary-residence investors.',
    measures: ['Demand score', 'Days on market', 'Affordability ratio', 'Price reduction trends'],
    badgeColor: 'bg-primary/10 text-primary',
    sampleScore: 'Score: 82 \u00b7 Grade: A',
  },
  {
    name: 'InvestorEdge Score',
    icon: Target,
    iconContainer: 'bg-tertiary-container text-on-tertiary-container',
    description:
      'Predicts total investment return including appreciation and rental yield. Best for rental property investors.',
    measures: ['Gross rent levels', 'Days on market', 'Supply score', 'Demand score'],
    badgeColor: 'bg-tertiary/10 text-tertiary',
    sampleScore: 'Score: 78 \u00b7 Grade: B+',
  },
  {
    name: 'MarketHealth Score',
    icon: Shield,
    iconContainer: 'bg-secondary-container text-on-secondary-container',
    description:
      'Measures current market stability and fundamentals. Best for risk assessment and timing decisions.',
    measures: ['Price trends', 'Inventory levels', 'Economic indicators', 'Population growth'],
    badgeColor: 'bg-secondary/10 text-secondary',
    sampleScore: 'Score: 91 \u00b7 Grade: A+',
  },
];

const steps = [
  {
    number: 1,
    icon: Database,
    title: '40+ Metrics',
    description:
      'We collect data from Zillow, Census, BLS, and other authoritative sources across every major metro area.',
  },
  {
    number: 2,
    icon: Brain,
    title: 'ML Analysis',
    description:
      'Elastic net cross-validation identifies which metrics actually predict future market returns \u2014 not just correlations, but causation signals.',
  },
  {
    number: 3,
    icon: Award,
    title: 'Score 0\u2013100',
    description:
      'Each location receives a score with letter grade (A+ to F) and confidence level, updated as new data arrives.',
  },
];

export default function ScoresPage() {
  return (
    <div className="mt-12 space-y-16">
      {/* Hero */}
      <section>
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Scores' }]}
          title="PropertyIQ Scores"
          description="Data-driven scores that predict real estate market performance"
          icon={<Target className="w-5 h-5" />}
        />
        <p className="mt-4 text-on-surface-variant">
          Validated across 1.1M+ observations &middot; 925 metros &middot; 5 years of data
        </p>
      </section>

      {/* Score Cards */}
      <section>
        <div className="grid md:grid-cols-3 gap-6">
          {scoreCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.name}
                className="bg-surface-container border border-outline-variant rounded-2xl p-6"
              >
                <div className={`${card.iconContainer} p-2 rounded-xl w-fit`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-on-surface mt-3">{card.name}</h3>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                  {card.description}
                </p>
                <ul className="mt-3 space-y-1">
                  {card.measures.map((measure) => (
                    <li key={measure} className="flex items-center gap-2 text-sm text-on-surface-variant">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {measure}
                    </li>
                  ))}
                </ul>
                <div
                  className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 ${card.badgeColor} rounded-lg text-sm font-medium`}
                >
                  {card.sampleScore}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Value Proposition */}
      <section>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Proven Results
        </p>
        <h2 className="text-2xl md:text-3xl font-[var(--font-source-serif)] text-on-surface mt-2">
          Why Scores Matter
        </h2>
        <p className="text-4xl md:text-5xl font-bold text-primary mt-6">$27,100</p>
        <p className="text-lg text-on-surface-variant mt-2">
          More equity on a typical home over 3 years
        </p>
        <p className="text-on-surface-variant mt-4 leading-relaxed">
          Our top-scored markets (top 20%) returned 142% more equity than bottom-scored markets. On
          a typical $242K metro home, that&apos;s the difference between $46,700 and $19,600 in
          appreciation over three years.
        </p>
        <Link
          href="/scores/accuracy"
          className="inline-flex items-center gap-2 text-primary font-medium hover:underline mt-4"
        >
          See the proof <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* How It Works */}
      <section>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Our Process
        </p>
        <h2 className="text-2xl md:text-3xl font-[var(--font-source-serif)] text-on-surface mt-2">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8 mt-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number}>
                <span className="text-xs font-semibold text-primary">Step {step.number}</span>
                <div className="bg-primary-container p-3 rounded-2xl w-fit mt-2">
                  <Icon className="w-5 h-5 text-on-primary-container" />
                </div>
                <h3 className="text-lg font-semibold text-on-surface mt-3">{step.title}</h3>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="border-t border-outline-variant pt-8 mt-8">
        <h3 className="text-xl font-semibold text-on-surface">
          Ready to find the best markets?
        </h3>
        <p className="text-on-surface-variant mt-2">
          Use PropertyIQ Scores to discover high-performing markets backed by data, not hunches.
        </p>
        <Link
          href="/map"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors mt-4"
        >
          Explore the Map <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
