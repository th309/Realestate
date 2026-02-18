'use client';

import Image from 'next/image';
import { useInView } from './hooks/useInView';
import { ArrowRight } from 'lucide-react';

/* ─── Individual value-prop row ─── */
interface ValuePropProps {
  eyebrow: string;
  heading: string;
  body: string;
  stat?: { value: string; label: string };
  image: { src: string; alt: string; width: number; height: number };
  href: string;
  linkLabel: string;
  reverse?: boolean;
  /** Cap the image container height and fade the bottom */
  imageMaxHeight?: number;
}

function ValueProp({
  eyebrow,
  heading,
  body,
  stat,
  image,
  href,
  linkLabel,
  reverse,
  imageMaxHeight,
}: ValuePropProps) {
  const [setRef, inView] = useInView();

  return (
    <div
      ref={setRef}
      className={`flex flex-col gap-10 lg:gap-16 items-center lg:items-start ${
        reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'
      }`}
    >
      {/* Text */}
      <div
        className="flex-1 max-w-lg lg:pt-4"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <span className="text-xs font-semibold text-primary uppercase tracking-[0.15em] mb-3 block">
          {eyebrow}
        </span>
        <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-on-surface tracking-tight leading-tight mb-4 font-[family-name:var(--font-source-serif)]">
          {heading}
        </h3>
        <p className="text-base text-on-surface-variant leading-relaxed mb-6">
          {body}
        </p>

        {stat && (
          <div className="mb-6 p-4 rounded-xl bg-primary-container/40 border border-primary/10 inline-block">
            <span className="block text-3xl font-bold text-primary font-mono">
              {stat.value}
            </span>
            <span className="text-sm text-on-primary-container">
              {stat.label}
            </span>
          </div>
        )}

        <a
          href={href}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
        >
          {linkLabel}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>

      {/* Image */}
      <div
        className="flex-1 w-full max-w-2xl"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
          transitionDelay: '0.15s',
        }}
      >
        <div
          className="relative rounded-xl overflow-hidden shadow-xl border border-outline-variant/20 bg-surface"
          style={imageMaxHeight ? { maxHeight: imageMaxHeight } : undefined}
        >
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="w-full h-auto"
          />
          {imageMaxHeight && (
            <div
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent, var(--md-surface))',
              }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main section ─── */
export function ValuePropsSection() {
  return (
    <section className="py-20 lg:py-28 px-6" id="features" aria-labelledby="value-props-heading">
      <h2 id="value-props-heading" className="sr-only">
        Why PropertyIQ
      </h2>

      <div className="max-w-6xl mx-auto space-y-24 lg:space-y-32">
        {/* 1. We do the hard part */}
        <ValueProp
          eyebrow="Market Rankings"
          heading="We do the hard part—finding markets that beat the average"
          body="Most platforms give you data. We give you answers. PropertyIQ ranks every metro, county, and ZIP code by investment potential and homebuyer readiness, so you see exactly which markets are outperforming—and which to avoid."
          stat={{ value: '142%', label: 'more equity returned by our top-scored markets vs. bottom' }}
          image={{
            src: '/images/home/top-ranked-markets-v2.png',
            alt: 'PropertyIQ market intelligence landing page showing Explore Markets search, top-ranked metros by InvestorEdge score with Batavia NY at 100.0 and Hobbs NM at 99.9, and popular market quick links',
            width: 1425,
            height: 2149,
          }}
          href="/market"
          linkLabel="Explore top markets"
          imageMaxHeight={560}
        />

        {/* 2. AI reports */}
        <ValueProp
          reverse
          eyebrow="AI Reports"
          heading="Personalized analysis written for your specific market"
          body="Every report is generated fresh by AI for the exact geography you're evaluating. Score breakdowns, affordability analysis, market timing signals, growth potential, and a clear bottom-line verdict—whether you're buying a home or evaluating an investment."
          image={{
            src: '/images/home/ai-report-narrative-v2.png',
            alt: 'PropertyIQ AI-generated market report for Las Vegas NV showing HomeReady score of 25, score breakdown with Affordability, Growth Potential, Stability, and Market Timing components, and detailed AI narrative analysis explaining market transition dynamics and buyer opportunities',
            width: 1425,
            height: 1490,
          }}
          href="/reports/sample"
          linkLabel="See a sample report"
          imageMaxHeight={560}
        />

        {/* 3. Scores that predict */}
        <ValueProp
          eyebrow="Proven Scores"
          heading="Scores that predict real market performance"
          body="HomeReady, InvestorEdge, and MarketHealth scores are built from 40+ metrics using machine learning—not opinions. Validated across 1.1 million observations and 5 years of data. Top-scored markets don't just correlate with better returns. They deliver them."
          stat={{ value: '$27,100', label: 'more equity on a typical home over 3 years in top-scored markets' }}
          image={{
            src: '/images/home/market-scores-detail-v2.png',
            alt: 'PropertyIQ market analysis for Austin TX showing InvestorEdge score of 29, Market Health score of 4, with detailed metrics including cap rate, gross yield, rent index, days on market, and appreciation data',
            width: 1440,
            height: 845,
          }}
          href="/scores"
          linkLabel="See the methodology"
        />
      </div>
    </section>
  );
}
