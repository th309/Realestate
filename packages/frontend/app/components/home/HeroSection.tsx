'use client';

import { ScoreRing } from './ScoreRing';
import { FeatureCarousel } from './FeatureCarousel';

export function HeroSection() {
  return (
    <section
      className="relative pt-24 pb-20 px-6 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 30% 30%, var(--md-primary-container), transparent 60%)',
          opacity: 0.15,
        }}
      />

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        {/* Left column - Text content */}
        <article className="relative flex-1 max-w-2xl z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary-container text-on-primary-container text-sm font-medium">
          <span aria-hidden="true">✦</span>
          <span>AI-Powered Real Estate Analytics</span>
        </div>

        {/* SEO-optimized H1 */}
        <h1
          id="hero-heading"
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-on-surface mb-5 leading-tight"
        >
          Real estate market intelligence for{' '}
          <span className="text-primary">homebuyers, investors & agents</span>
        </h1>

        {/* Keyword-rich description targeting all audiences */}
        <p className="hero-description text-lg text-on-surface-variant mb-8 max-w-lg leading-relaxed">
          Whether you&apos;re buying your first home, analyzing rental properties,
          or advising clients—PropertyIQ delivers AI-powered neighborhood scores,
          investment ROI projections, and market reports across 384 US metros.
        </p>

        {/* CTAs with accessible labels */}
        <div className="flex flex-wrap gap-4 mb-12" role="group" aria-label="Get started options">
          <a
            href="/signup"
            className="px-6 py-3 rounded-full text-base font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors duration-200 elevation-2"
          >
            Start Free Analysis
          </a>
          <a
            href="/demo"
            className="px-6 py-3 rounded-full text-base font-semibold border border-outline text-on-surface hover:bg-surface-container transition-colors duration-200"
          >
            See How It Works
          </a>
        </div>

        {/* Score Rings - colors auto-calculated from score (red=0, green=100) */}
        <div className="flex gap-8" role="list" aria-label="PropertyIQ scoring metrics">
          <div role="listitem">
            <ScoreRing score={87} label="HomeReady Score" delay={300} />
          </div>
          <div role="listitem">
            <ScoreRing score={72} label="InvestorEdge Score" delay={450} />
          </div>
          <div role="listitem">
            <ScoreRing score={94} label="Market Health Index" delay={600} />
          </div>
        </div>
        </article>

        {/* Right column - Feature carousel */}
        <div className="relative flex-1 flex justify-center lg:justify-end">
          <FeatureCarousel />
        </div>
      </div>
    </section>
  );
}
