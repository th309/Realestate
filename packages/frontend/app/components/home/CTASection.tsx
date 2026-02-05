'use client';

export function CTASection() {
  return (
    <section
      className="text-center py-16 px-6 bg-surface-container-low border-t border-outline-variant"
      aria-labelledby="cta-heading"
    >
      <h2 id="cta-heading" className="text-2xl md:text-3xl font-bold text-on-surface mb-4 tracking-tight">
        Start making data-driven real estate decisions
      </h2>
      <p className="text-lg text-on-surface-variant mb-8 max-w-lg mx-auto">
        Join homebuyers finding their perfect neighborhood, investors maximizing rental ROI,
        and agents delivering insights clients trust. Free to start—no credit card required.
      </p>
      <a
        href="/map"
        className="inline-block px-8 py-4 rounded-full text-base font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors duration-200 elevation-2"
      >
        Start Exploring Free
      </a>
    </section>
  );
}
