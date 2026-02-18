'use client';

import Image from 'next/image';
import { useInView } from './hooks/useInView';
import { HeroSearchBar } from './HeroSearchBar';

export function HeroSection() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="relative pt-12 pb-16 lg:pt-16 lg:pb-24 px-6 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Subtle background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, var(--md-primary-container), transparent 70%)',
          opacity: 0.12,
        }}
      />

      <div className="relative max-w-5xl mx-auto text-center z-10">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-primary-container/60 text-on-primary-container text-sm font-medium transition-all duration-700"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(12px)',
          }}
        >
          <span aria-hidden="true">✦</span>
          <span>AI-Powered Real Estate Intelligence</span>
        </div>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-on-surface mb-6 leading-[1.1] font-[family-name:var(--font-source-serif)]"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
            transitionDelay: '0.1s',
          }}
        >
          We find the markets that{' '}
          <span className="text-primary">outperform</span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-lg md:text-xl text-on-surface-variant mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
            transitionDelay: '0.2s',
          }}
        >
          PropertyIQ analyzes 925 US metros, 3,100+ counties, and 33,000+ ZIP codes
          with machine learning to surface the markets where your money works hardest.
          Then we write you a personalized AI report.
        </p>

        {/* Search bar */}
        <div
          className="mb-8"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
            transitionDelay: '0.3s',
          }}
        >
          <HeroSearchBar />
          <p className="text-xs text-on-surface-variant/60 mt-2">
            Try: Miami, Austin TX, 90210, Cook County
          </p>
        </div>

        {/* Secondary CTAs */}
        <div
          className="flex items-center justify-center gap-6 mb-16"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
            transitionDelay: '0.35s',
          }}
        >
          <a href="/map" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            Explore the Map
          </a>
          <span className="text-on-surface-variant/30">|</span>
          <a href="/scores" className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
            See Our Track Record
          </a>
        </div>

        {/* Hero image — real product screenshot */}
        <div
          className="relative mx-auto max-w-5xl"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
            transition: 'opacity 0.9s ease, transform 0.9s ease',
            transitionDelay: '0.4s',
          }}
        >
          <div className="rounded-xl overflow-hidden shadow-2xl border border-outline-variant/30 bg-surface">
            <Image
              src="/images/home/market-map-hero-v3.png"
              alt="PropertyIQ interactive market map showing median home values across all US states color-coded from $169K to $636K, with left sidebar for Market Trends, scores, and data categories, and top toolbar with search and geography level filters"
              width={1440}
              height={900}
              className="w-full h-auto"
              priority
            />
          </div>
          {/* Subtle shadow/glow beneath */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-8 rounded-full blur-2xl bg-primary/10"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}
