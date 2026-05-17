"use client";

/**
 * Storybook-style demo for CompsDistribution — Phoenix metro comp data with a
 * realistic subject in the middle of the price/sqft distribution.
 *
 * View at /analyzer/dev/comps-distribution
 */
import { CompsDistribution, type Comp } from "./CompsDistribution";
import { piq } from "./piqTokens";

// 18 Phoenix metro comps, $182–$278/sqft, skewed toward the $210–$245 range.
const PHOENIX_COMPS: Comp[] = [
  { id: "1", address: "1247 W Glendale Ave", pricePerSqft: 182 },
  { id: "2", address: "8825 N 7th St", pricePerSqft: 195 },
  { id: "3", address: "3401 E Indian School Rd", pricePerSqft: 203 },
  { id: "4", address: "5410 N 12th Pl", pricePerSqft: 208 },
  { id: "5", address: "2728 E Roosevelt St", pricePerSqft: 215 },
  { id: "6", address: "6021 N 19th Ave", pricePerSqft: 218 },
  { id: "7", address: "1145 W Camelback Rd", pricePerSqft: 222 },
  { id: "8", address: "4502 N 26th St", pricePerSqft: 225 },
  { id: "9", address: "7821 E Thomas Rd", pricePerSqft: 228 },
  { id: "10", address: "3304 E Bethany Home Rd", pricePerSqft: 232 },
  { id: "11", address: "5612 N 39th Ave", pricePerSqft: 236 },
  { id: "12", address: "2901 E McDowell Rd", pricePerSqft: 241 },
  { id: "13", address: "1850 W Northern Ave", pricePerSqft: 244 },
  { id: "14", address: "4422 N 16th St", pricePerSqft: 247 },
  { id: "15", address: "6711 E Indian Bend Rd", pricePerSqft: 253 },
  { id: "16", address: "8230 N Central Ave", pricePerSqft: 259 },
  { id: "17", address: "3902 E Camelback Rd", pricePerSqft: 268 },
  { id: "18", address: "5215 E Lincoln Dr", pricePerSqft: 278 },
];

const NARROW_COMPS: Comp[] = [
  { id: "a", address: "203 E Adams St", pricePerSqft: 220 },
  { id: "b", address: "412 W Jefferson St", pricePerSqft: 224 },
  { id: "c", address: "715 N 1st Ave", pricePerSqft: 227 },
  { id: "d", address: "812 S 2nd St", pricePerSqft: 229 },
  { id: "e", address: "1106 W Van Buren St", pricePerSqft: 231 },
  { id: "f", address: "1320 E Washington St", pricePerSqft: 233 },
  { id: "g", address: "1502 N 3rd St", pricePerSqft: 235 },
  { id: "h", address: "1815 W Roosevelt St", pricePerSqft: 238 },
];

function DemoSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2
          className="text-xs font-semibold uppercase"
          style={{ color: piq.textMuted, letterSpacing: "0.14em" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: "13px", color: piq.textMuted, margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="rounded-2xl p-6"
        style={{
          background: piq.surface,
          border: `0.5px solid ${piq.border}`,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function CompsDistributionDemo() {
  return (
    <main
      className="min-h-screen px-8 py-12"
      style={{ background: piq.canvas, color: piq.textPrimary }}
    >
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="space-y-2">
          <h1
            className="text-3xl font-semibold"
            style={{ color: piq.textPrimary, letterSpacing: "-0.02em" }}
          >
            CompsDistribution — visual reference
          </h1>
          <p style={{ fontSize: "14px", color: piq.textMuted, margin: 0 }}>
            D3 histogram with subject overlay. Hover the bars for ranges, hover
            the subject line for the deal&apos;s address.
          </p>
        </header>

        <DemoSection
          title="Phoenix metro — 18 comps, subject mid-distribution"
          subtitle="Subject at $240/sqft lands in the upper-middle of the range. The subject's bin is filled at 80% opacity to stand out from the 20% background bars."
        >
          <CompsDistribution
            comps={PHOENIX_COMPS}
            subjectPricePerSqft={240}
            subjectAddress="4112 N 32nd St, Phoenix"
            bins={12}
          />
        </DemoSection>

        <DemoSection
          title="Subject above the entire comp set"
          subtitle="Same Phoenix comps, subject at $295/sqft — outside the comp range. The 100th percentile case: subject would land above every comp."
        >
          <CompsDistribution
            comps={PHOENIX_COMPS}
            subjectPricePerSqft={295}
            subjectAddress="7012 N 24th Pl, Phoenix"
            bins={12}
          />
        </DemoSection>

        <DemoSection
          title="Subject below the entire comp set"
          subtitle="Subject at $170/sqft — a steal vs. the comp set. 0th percentile."
        >
          <CompsDistribution
            comps={PHOENIX_COMPS}
            subjectPricePerSqft={170}
            subjectAddress="9821 W Bell Rd, Phoenix"
            bins={12}
          />
        </DemoSection>

        <DemoSection
          title="Narrow distribution (8 comps, tight $220–$238 range)"
          subtitle="When the comp range is tight, bins compress and the subject's position is more decisive. Fewer bars to scan, easier to read at a glance."
        >
          <CompsDistribution
            comps={NARROW_COMPS}
            subjectPricePerSqft={230}
            subjectAddress="945 N Central Ave"
            bins={6}
          />
        </DemoSection>
      </div>
    </main>
  );
}
