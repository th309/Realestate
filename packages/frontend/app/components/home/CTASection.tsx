'use client';

export function CTASection() {
  return (
    <section className="text-center py-16 px-6 bg-surface-container-low border-t border-outline-variant">
      <h2 className="text-2xl md:text-3xl font-bold text-on-surface mb-4 tracking-tight">
        Ready to invest smarter?
      </h2>
      <p className="text-lg text-on-surface-variant mb-8 max-w-md mx-auto">
        Join thousands of homebuyers and investors who&apos;ve upgraded their decision-making with PropertyIQ.
      </p>
      <button className="px-8 py-4 rounded-full text-base font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors duration-200 elevation-2">
        Start Your Free Account
      </button>
    </section>
  );
}
