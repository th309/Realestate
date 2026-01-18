'use client';

import { ReactNode } from 'react';
import { useInView } from './hooks/useInView';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
}

function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
  const [setRef, inView] = useInView();

  return (
    <div
      ref={setRef}
      className="bg-surface-container-low rounded-xl p-6 elevation-1 transition-all duration-500"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center mb-4 text-on-primary-container">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-on-surface mb-2">{title}</h3>
      <p className="text-sm text-on-surface-variant leading-relaxed">{description}</p>
    </div>
  );
}

// M3 Material Symbols style icons
const Icons = {
  Score: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
  Map: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  Report: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Data: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  Trend: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Shield: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

const FEATURES = [
  { icon: <Icons.Score />, title: 'Proprietary Scores', description: 'HomeReady and InvestorEdge scores distill dozens of metrics into actionable numbers you can trust.' },
  { icon: <Icons.Map />, title: 'Interactive Maps', description: 'Explore markets visually with heat maps, overlays, and drill-down neighborhood analysis.' },
  { icon: <Icons.Report />, title: 'AI Reports', description: 'Generate comprehensive market reports instantly. Export to PDF or share with stakeholders.' },
  { icon: <Icons.Data />, title: 'Deep Data', description: 'Census, economic indicators, Zillow metrics, and more—all normalized and ready to query.' },
  { icon: <Icons.Trend />, title: 'Trend Forecasting', description: 'Machine learning models predict price movements, rental demand, and market cycles.' },
  { icon: <Icons.Shield />, title: 'Risk Assessment', description: 'Understand downside scenarios with volatility metrics and economic sensitivity analysis.' },
];

export function FeaturesSection() {
  return (
    <section className="py-24 px-6 max-w-6xl mx-auto" id="features">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-16">
        <span className="text-sm font-semibold text-primary uppercase tracking-widest">Features</span>
        <h2 className="text-2xl md:text-3xl font-bold text-on-surface mt-3 mb-4 tracking-tight">
          Everything you need to invest with confidence
        </h2>
        <p className="text-on-surface-variant">
          From proprietary scoring to AI-generated reports, PropertyIQ gives you institutional-grade tools.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((feature, i) => (
          <FeatureCard key={feature.title} {...feature} delay={i * 100} />
        ))}
      </div>
    </section>
  );
}
