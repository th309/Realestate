'use client';

import { useInView } from './hooks/useInView';

export function CTASection() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="text-center py-20 lg:py-28 px-6 bg-surface-container-low border-t border-outline-variant"
      aria-labelledby="cta-heading"
    >
      <div
        className="max-w-2xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <h2
          id="cta-heading"
          className="text-3xl md:text-4xl font-bold text-on-surface mb-5 tracking-tight font-[family-name:var(--font-source-serif)]"
        >
          Stop guessing. Start investing with data.
        </h2>
        <p className="text-lg text-on-surface-variant mb-10 leading-relaxed">
          Join homebuyers, investors, and agents who use PropertyIQ to make
          smarter real estate decisions. Free to start—no credit card required.
        </p>
        <a
          href="/map"
          className="inline-block px-8 py-4 rounded-full text-base font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors duration-200 elevation-2"
        >
          Start Exploring Free
        </a>
      </div>
    </section>
  );
}
