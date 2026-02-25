/**
 * CTA Banner
 *
 * Call-to-action directing users to explore maps and view pricing.
 * Fetches pricing from the database to avoid hardcoded prices.
 */

import Link from 'next/link';
import { Map, CreditCard } from 'lucide-react';
import { fetchPricingSummary } from '@/lib/data/fetchers/pricing';

export async function CTABanner() {
  let proPrice = '...';
  try {
    const pricing = await fetchPricingSummary();
    const pro = pricing.tiers.find((t) => t.slug === 'pro');
    if (pro?.price_monthly) proPrice = `$${Math.round(Number(pro.price_monthly))}/mo`;
  } catch {
    // Pricing fetch failed; leave as placeholder
  }

  return (
    <section>
      <div className="bg-primary/[0.06] rounded-2xl border border-primary/20 p-6 md:p-8">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface">
            Ready to Invest Smarter?
          </h2>
          <p className="text-on-surface-variant mt-2">
            Explore top-scored markets on our interactive map or start with plans at {proPrice}.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-full font-medium hover:bg-primary/90 transition-colors"
            >
              <Map className="w-4 h-4" />
              Explore Top-Scored Markets
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-surface border border-outline-variant text-on-surface px-6 py-2.5 rounded-full font-medium hover:bg-surface-container transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Plans Starting at {proPrice}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
