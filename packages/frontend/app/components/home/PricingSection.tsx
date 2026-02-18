'use client';

import { useState } from 'react';
import { useInView } from './hooks/useInView';

interface PricingTierProps {
  name: string;
  price: string;
  period?: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  delay?: number;
}

function PricingTier({ name, price, period, features, highlighted, cta, delay = 0 }: PricingTierProps) {
  const [setRef, inView] = useInView();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={setRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative flex-1 max-w-sm rounded-3xl p-8 transition-all duration-300
        ${highlighted
          ? 'bg-primary-container border-2 border-primary'
          : 'bg-surface-container-low border border-outline-variant'
        }
        ${hovered ? 'elevation-3 -translate-y-1' : 'elevation-1'}
      `}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? (hovered ? 'translateY(-4px)' : 'translateY(0)') : 'translateY(24px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wide">
          Most Popular
        </div>
      )}

      <h3 className="text-lg font-semibold text-on-surface-variant mb-2">{name}</h3>

      <div className="mb-6">
        <span className="text-4xl font-bold text-on-surface">{price}</span>
        {period && <span className="text-on-surface-variant ml-1">/{period}</span>}
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5 text-primary">
              <path d="M15 5L7 13L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        className={`
          w-full py-3 px-6 rounded-full text-sm font-semibold transition-colors duration-200
          ${highlighted
            ? 'bg-primary text-on-primary hover:bg-primary/90'
            : 'border border-outline text-on-surface hover:bg-surface-container'
          }
        `}
      >
        {cta}
      </button>
    </div>
  );
}

const PRICING_TIERS = [
  {
    name: 'Free',
    price: '$0',
    features: ['Interactive market maps', 'National & state-level data', 'Historical trends & charts', 'Preview reports'],
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'mo',
    features: ['Everything in Free, plus:', 'Metro, county, and ZIP code data', 'PropertyIQ composite scores', 'AI market analysis', 'Unlimited AI reports', 'CSV data export'],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: 'mo',
    features: ['Everything in Pro, plus:', 'Scenario modeling', 'Statistical deep dives', 'Team & brokerage features', 'Priority support'],
    cta: 'Contact Sales',
  },
];

export function PricingSection() {
  return (
    <section className="py-20 lg:py-28 px-6 max-w-6xl mx-auto" id="pricing">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-sm font-semibold text-primary uppercase tracking-widest">Pricing</span>
        <h2 className="text-2xl md:text-3xl font-bold text-on-surface mt-3 mb-4 tracking-tight">
          Start free, upgrade when you&apos;re ready
        </h2>
        <p className="text-on-surface-variant">No credit card required. Cancel anytime.</p>
      </div>

      {/* Tiers */}
      <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch">
        {PRICING_TIERS.map((tier, i) => (
          <PricingTier key={tier.name} {...tier} delay={i * 100} />
        ))}
      </div>
    </section>
  );
}
