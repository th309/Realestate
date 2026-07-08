// Run with: npx tsx scripts/generate-llms-txt.ts  (npm run seo:generate-llms)
//
// Regenerates packages/frontend/public/llms.txt and llms-full.txt from the single
// template module in scripts/lib/llms-txt-template.ts. Coverage + IC values come
// from validation-claims.ts (the SSOT); pricing is fetched LIVE from the pricing
// API so the AI-facing files can never drift from what customers actually pay.
//
// FAIL-CLOSED: if the pricing fetch fails, or the pro/enterprise tiers are missing
// a valid monthly price, the script exits non-zero and writes NOTHING — the files
// never ship stale or empty pricing.

import fs from "fs";
import path from "path";

import {
  buildLlmsTxt,
  buildLlmsFullTxt,
  type LlmsPricing,
} from "./lib/llms-txt-template";

// Same env var the slug generators read (CI sets it to the production backend).
const API_URL = process.env.API_URL || "http://localhost:3001";

interface ApiTier {
  slug: string;
  name: string;
  price_monthly: number | string | null;
}

async function fetchLivePricing(): Promise<LlmsPricing> {
  const endpoint = `${API_URL}/api/pricing/tiers`;
  console.log(`Fetching pricing from ${endpoint}...`);

  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Pricing API returned ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  if (!body?.success || !Array.isArray(body?.data?.tiers)) {
    throw new Error(
      `Pricing API response malformed (no success/tiers): ${JSON.stringify(body).slice(0, 200)}`,
    );
  }

  const bySlug = new Map<string, ApiTier>(
    (body.data.tiers as ApiTier[]).map((t) => [t.slug, t]),
  );

  const resolveTier = (slug: string): { name: string; monthly: number } => {
    const tier = bySlug.get(slug);
    if (!tier) {
      throw new Error(
        `fail-closed: pricing tier "${slug}" not found in API response`,
      );
    }
    const monthly = Number(tier.price_monthly);
    if (!Number.isFinite(monthly) || monthly <= 0) {
      throw new Error(
        `fail-closed: pricing tier "${slug}" has no valid monthly price (got ${JSON.stringify(tier.price_monthly)})`,
      );
    }
    return { name: tier.name, monthly: Math.round(monthly) };
  };

  return {
    pro: resolveTier("pro"),
    enterprise: resolveTier("enterprise"),
  };
}

async function main(): Promise<void> {
  const pricing = await fetchLivePricing();
  console.log(
    `Pricing resolved: ${pricing.pro.name} $${pricing.pro.monthly}/mo, ${pricing.enterprise.name} $${pricing.enterprise.monthly}/mo`,
  );

  // Build BOTH documents before writing anything, so a template error can't leave
  // one file updated and the other stale.
  const llms = buildLlmsTxt(pricing);
  const llmsFull = buildLlmsFullTxt(pricing);

  const publicDir = path.join(
    __dirname,
    "..",
    "packages",
    "frontend",
    "public",
  );
  const llmsPath = path.join(publicDir, "llms.txt");
  const llmsFullPath = path.join(publicDir, "llms-full.txt");

  fs.writeFileSync(llmsPath, llms);
  fs.writeFileSync(llmsFullPath, llmsFull);

  console.log(`Wrote ${llmsPath} (${Buffer.byteLength(llms)} bytes)`);
  console.log(`Wrote ${llmsFullPath} (${Buffer.byteLength(llmsFull)} bytes)`);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
