import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

/**
 * The landing-page A/B experiment is retired: there is ONE homepage.
 *
 * These are structural guards rather than render assertions — the failure mode
 * being prevented is a half-reverted experiment (route or flag module quietly
 * reappearing, middleware regaining a rewrite on `/`), which a component test
 * cannot see. Runtime behaviour of `/` is covered in `middleware.test.ts`.
 */
describe("the homepage A/B split is retired", () => {
  it("no longer ships a home-v2 route", () => {
    expect(existsSync(join(ROOT, "app/(app)/home-v2"))).toBe(false);
  });

  it("no longer ships the landing-variant experiment module", () => {
    expect(existsSync(join(ROOT, "lib/experiments/landing-variant.ts"))).toBe(
      false,
    );
  });

  it("no longer ships the VariantStamp analytics shim", () => {
    expect(
      existsSync(join(ROOT, "app/components/home/landing-v2/VariantStamp.tsx")),
    ).toBe(false);
  });

  it("middleware performs no landing rewrite", () => {
    const mw = readFileSync(join(ROOT, "middleware.ts"), "utf8");
    expect(mw).not.toContain("home-v2");
    expect(mw).not.toContain("LANDING_VARIANT_COOKIE");
    expect(mw).not.toContain("LANDING_EXPERIMENT");
  });

  it("the homepage renders the narrative beats directly", () => {
    const page = readFileSync(join(ROOT, "app/(app)/page.tsx"), "utf8");
    expect(page).toContain("<BeatHero");
    expect(page).toContain("<BeatClose");
    expect(page).not.toContain("VariantStamp");
  });

  it("the homepage keeps the canonical landing metadata", () => {
    const page = readFileSync(join(ROOT, "app/(app)/page.tsx"), "utf8");
    expect(page).toMatch(/export const metadata: Metadata = landingMetadata;/);
  });

  it("the homepage still renders the FAQ that carries the FAQPage JSON-LD", () => {
    const page = readFileSync(join(ROOT, "app/(app)/page.tsx"), "utf8");
    expect(page).toContain("<FaqSection faqs={HOME_FAQS} />");
  });
});
