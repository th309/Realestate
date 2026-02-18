'use client';

import { useInView } from './hooks/useInView';
import { ArrowRight } from 'lucide-react';

/**
 * Graphs-in-motion showcase — real product video.
 *
 * Plays a short looping clip that crossfades between the scatter plot
 * and rankings chart, giving visitors a taste of the interactive
 * analytics tools. Uses <video> with autoPlay, muted, loop, playsInline
 * for zero-interaction playback on all devices.
 */
export function GraphsShowcase() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="py-20 lg:py-28 px-6"
      aria-labelledby="graphs-heading"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div
          className="text-center max-w-2xl mx-auto mb-12"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          <span className="text-xs font-semibold text-primary uppercase tracking-[0.15em] mb-3 block">
            Interactive Analytics
          </span>
          <h2
            id="graphs-heading"
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-on-surface tracking-tight leading-tight mb-4 font-[family-name:var(--font-source-serif)]"
          >
            Compare any metric across any market
          </h2>
          <p className="text-base text-on-surface-variant leading-relaxed">
            Scatter plots, timelines, radar charts, rankings, and waterfalls.
            Pick your markets, pick your metrics, and see the story the data tells.
          </p>
        </div>

        {/* Video showcase */}
        <div
          className="relative mx-auto max-w-5xl"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
            transitionDelay: '0.15s',
          }}
        >
          {/* Outer frame */}
          <div className="rounded-xl overflow-hidden shadow-xl border border-outline-variant/20 bg-surface">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/images/home/graphs-poster.png"
              className="w-full h-auto block"
              aria-label="PropertyIQ interactive analytics demo showing animated scatter plot of home values vs days on market across US metros, then transitioning to an animated bar chart race ranking California metros by median home value with Napa highlighted"
            >
              <source src="/videos/graphs-showcase.webm" type="video/webm" />
              <source src="/videos/graphs-showcase.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Glow */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[70%] h-8 rounded-full blur-2xl bg-primary/8"
            aria-hidden="true"
          />
        </div>

        {/* CTA */}
        <div
          className="text-center mt-8"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 0.6s ease',
            transitionDelay: '0.3s',
          }}
        >
          <a
            href="/graphs"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
          >
            Try the analytics tools
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}
