'use client';

import { ScoreRing } from './ScoreRing';

function MapVisualization() {
  // Generate deterministic dots for SSR compatibility
  const dots = [
    { x: 25, y: 30, size: 2.5, delay: 1.2, intensity: 0.7 },
    { x: 45, y: 25, size: 3.2, delay: 2.1, intensity: 0.8 },
    { x: 65, y: 35, size: 2.8, delay: 0.8, intensity: 0.6 },
    { x: 35, y: 50, size: 3.5, delay: 1.5, intensity: 0.9 },
    { x: 55, y: 45, size: 2.2, delay: 2.8, intensity: 0.5 },
    { x: 75, y: 55, size: 3.0, delay: 0.5, intensity: 0.7 },
    { x: 20, y: 60, size: 2.7, delay: 1.8, intensity: 0.6 },
    { x: 50, y: 65, size: 3.3, delay: 2.5, intensity: 0.8 },
    { x: 70, y: 70, size: 2.4, delay: 1.0, intensity: 0.5 },
    { x: 40, y: 40, size: 3.8, delay: 3.0, intensity: 0.9 },
  ];

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute top-1/2 right-0 w-1/2 h-4/5 -translate-y-1/2 opacity-30"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" className="[stop-color:var(--md-primary)]" stopOpacity="0.6" />
          <stop offset="100%" className="[stop-color:var(--md-primary)]" stopOpacity="0" />
        </radialGradient>
      </defs>
      {dots.map((dot, i) => (
        <g key={i}>
          <circle cx={dot.x} cy={dot.y} r={dot.size * 3} fill="url(#dotGlow)" opacity={dot.intensity * 0.4}>
            <animate
              attributeName="opacity"
              values={`${dot.intensity * 0.2};${dot.intensity * 0.5};${dot.intensity * 0.2}`}
              dur={`${3 + dot.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={dot.x} cy={dot.y} r={dot.size * 0.5} className="fill-primary" opacity={dot.intensity} />
        </g>
      ))}
    </svg>
  );
}

export function HeroSection() {
  return (
    <section
      className="relative flex items-center pt-24 pb-12 px-6 overflow-hidden"
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
      <MapVisualization />

      <article className="relative max-w-2xl z-10">
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
    </section>
  );
}
