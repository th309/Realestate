"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useInView } from "./hooks/useInView";
import { usePricingTiers } from "@/lib/data";
import { FALLBACK_BULLETS } from "@/app/pricing/components/build-feature-bullets";

const CTA_HREF: Record<string, string> = {
  free: "/auth/sign-up",
  pro: "/auth/sign-up",
  enterprise: "/auth/sign-up",
};

interface PricingTierProps {
  slug: string;
  name: string;
  price: string;
  priceLoading?: boolean;
  period?: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  delay?: number;
}

function PricingTier({
  slug,
  name,
  price,
  priceLoading,
  period,
  features,
  highlighted,
  cta,
  delay = 0,
}: PricingTierProps) {
  const [setRef, inView] = useInView();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={setRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative flex-1 max-w-sm rounded-3xl p-8 transition-all duration-300
        ${
          highlighted
            ? "bg-white border-2 border-[#3949AB] shadow-lg"
            : "bg-white/80 border border-[#C5CAE9]"
        }
        ${hovered ? "elevation-3 -translate-y-1" : "elevation-1"}
      `}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView
          ? hovered
            ? "translateY(-4px)"
            : "translateY(0)"
          : "translateY(24px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wide">
          Most Popular
        </div>
      )}

      <h3 className="text-lg font-semibold text-[#3949AB] mb-2">{name}</h3>

      <div className="mb-6">
        {priceLoading ? (
          <span className="inline-block h-10 w-20 rounded-lg bg-[#3949AB]/10 animate-pulse" />
        ) : (
          <>
            <span className="text-4xl font-bold text-[#1A237E]">{price}</span>
            {period && <span className="text-[#3949AB] ml-1">/{period}</span>}
          </>
        )}
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-[#3949AB]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="flex-shrink-0 mt-0.5 text-primary"
              aria-hidden="true"
            >
              <path
                d="M15 5L7 13L3 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href={CTA_HREF[slug] ?? "/auth/sign-up"}
        className={`
          block w-full py-3 px-6 rounded-full text-sm font-semibold text-center transition-colors duration-200
          ${
            highlighted
              ? "bg-primary text-on-primary hover:bg-primary/90"
              : "border border-[#3949AB] text-[#1A237E] hover:bg-[#3949AB]/10"
          }
        `}
      >
        {cta}
      </Link>
    </div>
  );
}

/** CTA text and display order per tier. Features come from shared builder. */
const TIER_DISPLAY: Record<
  string,
  { highlighted?: boolean; cta: string; order: number }
> = {
  free: { cta: "Get Started", order: 0 },
  pro: { highlighted: true, cta: "Start Free Trial", order: 1 },
  enterprise: { cta: "Get Started", order: 2 },
};

export function PricingSection() {
  const { tiers, isLoading } = usePricingTiers();

  const pricingTiers = useMemo(() => {
    if (tiers.length === 0) {
      // Loading / fallback — use static bullets from shared source
      return Object.entries(TIER_DISPLAY)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([slug, display]) => ({
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          price: slug === "free" ? "$0" : "",
          priceLoading: slug !== "free" && isLoading,
          period: slug === "free" ? undefined : "mo",
          features: FALLBACK_BULLETS[slug] ?? [],
          ...display,
        }));
    }
    return tiers
      .filter((t) => TIER_DISPLAY[t.slug])
      .sort(
        (a, b) =>
          (TIER_DISPLAY[a.slug]?.order ?? 99) -
          (TIER_DISPLAY[b.slug]?.order ?? 99),
      )
      .map((t) => {
        const display = TIER_DISPLAY[t.slug];
        const monthly = Number(t.price_monthly) || 0;
        return {
          slug: t.slug,
          name: t.name,
          price: monthly === 0 ? "$0" : `$${Math.round(monthly)}`,
          priceLoading: false,
          period: monthly === 0 ? undefined : "mo",
          features:
            t.pricing_card_items?.length > 0
              ? t.pricing_card_items
              : (FALLBACK_BULLETS[t.slug] ?? []),
          ...display,
        };
      });
  }, [tiers, isLoading]);

  return (
    <section
      className="pt-5 pb-10 lg:pt-7 lg:pb-14 px-6 max-w-6xl mx-auto"
      id="pricing"
    >
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-sm font-semibold text-[#1A237E] uppercase tracking-widest">
          Pricing
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-[#1A237E] mt-3 mb-4 tracking-tight">
          Start free, upgrade when you&apos;re ready
        </h2>
        <p className="text-[#3949AB]">
          No credit card required. Cancel anytime.
        </p>
      </div>

      {/* Tiers */}
      <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch">
        {pricingTiers.map((tier, i) => (
          <PricingTier key={tier.name} {...tier} delay={i * 100} />
        ))}
      </div>
    </section>
  );
}
