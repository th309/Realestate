/**
 * Stripe Test Products Setup
 *
 * Creates Pro and Enterprise products + monthly/yearly prices in Stripe test mode.
 * Idempotent: searches for existing products by metadata['tier_slug'] before creating.
 * Outputs SQL UPDATE statements to seed subscription_tiers with the generated IDs.
 *
 * Usage: npx tsx scripts/stripe-setup-test-products.ts
 * Requires: STRIPE_SECRET_KEY in packages/backend/.env.local
 */

import Stripe from 'stripe';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load backend env
dotenv.config({ path: path.join(__dirname, '../packages/backend/.env.local') });

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY not found in packages/backend/.env.local');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });

interface TierConfig {
  slug: string;
  name: string;
  monthlyPrice: number; // in cents
  yearlyPrice: number; // in cents
}

const TIERS: TierConfig[] = [
  { slug: 'pro', name: 'PropertyIQ Pro', monthlyPrice: 3900, yearlyPrice: 39900 },
  {
    slug: 'enterprise',
    name: 'PropertyIQ Enterprise',
    monthlyPrice: 14900,
    yearlyPrice: 99900,
  },
];

async function findOrCreateProduct(tier: TierConfig): Promise<Stripe.Product> {
  // Primary: search by metadata (Stripe search index is eventually consistent)
  const searchResult = await stripe.products.search({
    query: `metadata['tier_slug']:'${tier.slug}'`,
  });

  if (searchResult.data.length > 0) {
    const active = searchResult.data.find((p) => p.active);
    if (active) {
      console.log(`  Found existing product (via search) for ${tier.slug}: ${active.id}`);
      return active;
    }
  }

  // Fallback: list products and check metadata manually (handles search index lag)
  const allProducts = await stripe.products.list({ limit: 100, active: true });
  const match = allProducts.data.find(
    (p) => p.metadata.tier_slug === tier.slug,
  );
  if (match) {
    console.log(`  Found existing product (via list) for ${tier.slug}: ${match.id}`);
    return match;
  }

  const product = await stripe.products.create({
    name: tier.name,
    metadata: { tier_slug: tier.slug },
  });
  console.log(`  Created product for ${tier.slug}: ${product.id}`);
  return product;
}

async function findOrCreatePrice(
  productId: string,
  amount: number,
  interval: 'month' | 'year',
  tierSlug: string,
): Promise<Stripe.Price> {
  // Check for existing active price with matching amount and interval
  const existingPrices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 20,
  });

  const match = existingPrices.data.find(
    (p) =>
      p.unit_amount === amount &&
      p.recurring?.interval === interval &&
      p.currency === 'usd',
  );

  if (match) {
    console.log(`  Found existing ${interval}ly price: ${match.id}`);
    return match;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: 'usd',
    recurring: { interval },
    metadata: { tier_slug: tierSlug, interval },
  });
  return price;
}

async function main() {
  console.log('=== Stripe Test Products Setup ===\n');

  const sqlStatements: string[] = [];

  for (const tier of TIERS) {
    console.log(`\nProcessing tier: ${tier.name} (${tier.slug})`);

    const product = await findOrCreateProduct(tier);

    // Find or create monthly price
    const monthlyPrice = await findOrCreatePrice(
      product.id,
      tier.monthlyPrice,
      'month',
      tier.slug,
    );
    console.log(
      `  Monthly price: ${monthlyPrice.id} ($${tier.monthlyPrice / 100}/mo)`,
    );

    // Find or create yearly price
    const yearlyPrice = await findOrCreatePrice(
      product.id,
      tier.yearlyPrice,
      'year',
      tier.slug,
    );
    console.log(
      `  Yearly price: ${yearlyPrice.id} ($${tier.yearlyPrice / 100}/yr)`,
    );

    sqlStatements.push(
      `UPDATE subscription_tiers SET stripe_product_id = '${product.id}', stripe_price_monthly_id = '${monthlyPrice.id}', stripe_price_yearly_id = '${yearlyPrice.id}' WHERE slug = '${tier.slug}';`,
    );
  }

  console.log('\n\n--- SQL to run against Supabase ---\n');
  for (const sql of sqlStatements) {
    console.log(sql);
  }
  console.log('\n--- Done ---');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
