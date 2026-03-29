"use client";

import { useInView } from "./hooks/useInView";
import { HeroSearchBar } from "./HeroSearchBar";
import { getV4HomepageClaims, V4_CLAIMS } from "@/lib/data/validation-claims";

/* ─── A/B variant toggle ─── */
const HERO_VARIANT: "A" | "B" = "A"; // Toggle for future A/B test with PostHog

/* ─── Shared animation helper ─── */
function fadeUp(inView: boolean, delay: string) {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(16px)",
    transition: "opacity 0.7s ease, transform 0.7s ease",
    transitionDelay: delay,
  } as const;
}

/* ─── Shared bottom section: search bar + CTAs + hero image ─── */
function HeroBottom({ inView }: { inView: boolean }) {
  return (
    <>
      {/* Search bar */}
      <div className="mb-8" style={fadeUp(inView, "0.4s")}>
        <HeroSearchBar />
        <p className="text-xs text-[#C5CAE9]/60 mt-2">
          Try: Miami, Austin TX, 90210, Cook County
        </p>
      </div>

      {/* Secondary CTAs */}
      <div
        className="flex items-center justify-center gap-4"
        style={fadeUp(inView, "0.45s")}
      >
        <a
          href="/map"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#1A237E] text-sm font-semibold shadow-md hover:bg-white/90 hover:shadow-lg transition-all duration-200"
        >
          Explore the Map
        </a>
        <a
          href="/scores"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-all duration-200"
        >
          See the Proof
        </a>
      </div>
    </>
  );
}

/* ─── Variant A: "Lead with Proof" ─── */
function HeroVariantA() {
  const [setRef, inView] = useInView();
  const claims = getV4HomepageClaims();

  const statCards = [
    {
      value: `+$${V4_CLAIMS.metroGap3Y.toLocaleString()}`,
      lines: ["3-year equity advantage", "Score 80+ vs Score 20"],
    },
    {
      value: claims.yearHitRate,
      lines: ["Years where top-scored", "markets beat bottom"],
    },
    {
      value: claims.alphaPp,
      lines: ["3-year alpha", "Q5 vs Q1"],
    },
  ];

  return (
    <section
      ref={setRef}
      className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 px-6 overflow-hidden bg-gradient-to-br from-[#1A237E] to-[#3949AB]"
      aria-labelledby="hero-heading"
    >
      <div className="relative max-w-5xl mx-auto text-center z-10">
        {/* Eyebrow */}
        <div
          className="inline-block px-4 py-1 mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#C5CAE9]"
          style={fadeUp(inView, "0s")}
        >
          PropertyIQ
        </div>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5 leading-[1.1] font-[family-name:var(--font-source-serif)]"
          style={fadeUp(inView, "0.1s")}
        >
          Know which markets will outperform.
        </h1>

        {/* Subheadline */}
        <p
          className="text-lg md:text-xl text-[#C5CAE9] mb-10 max-w-2xl mx-auto leading-relaxed"
          style={fadeUp(inView, "0.2s")}
        >
          Our score predicted the winners in {claims.yearHitRate} of years
          tested — across {claims.metrosValidated.toLocaleString()} metros over{" "}
          {claims.backtestYears} years.
        </p>

        {/* Stat cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-12"
          style={fadeUp(inView, "0.3s")}
        >
          {statCards.map((card) => (
            <div
              key={card.value}
              className="bg-white/10 backdrop-blur rounded-xl p-5 text-center"
            >
              <div className="text-[28px] font-bold text-[#00C853] font-mono leading-tight">
                {card.value}
              </div>
              {card.lines.map((line) => (
                <div key={line} className="text-xs text-[#C5CAE9] leading-snug">
                  {line}
                </div>
              ))}
            </div>
          ))}
        </div>

        <HeroBottom inView={inView} />
      </div>
    </section>
  );
}

/* ─── Variant B: "Cost of Inaction" ─── */
function HeroVariantB() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 px-6 overflow-hidden bg-gradient-to-br from-[#1A237E] to-[#3949AB]"
      aria-labelledby="hero-heading"
    >
      <div className="relative max-w-5xl mx-auto text-center z-10">
        {/* Eyebrow */}
        <div
          className="inline-block px-4 py-1 mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#C5CAE9]"
          style={fadeUp(inView, "0s")}
        >
          PropertyIQ
        </div>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5 leading-[1.1] font-[family-name:var(--font-source-serif)]"
          style={fadeUp(inView, "0.1s")}
        >
          The wrong market costs you{" "}
          <span className="text-[#00C853]">
            ${V4_CLAIMS.metroGap3Y.toLocaleString()} in 3 years.
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-lg md:text-xl text-[#C5CAE9] mb-10 max-w-2xl mx-auto leading-relaxed"
          style={fadeUp(inView, "0.2s")}
        >
          PropertyIQ scores every metro, county, and ZIP code in America — so
          you pick the markets that outperform.
        </p>

        {/* Side-by-side comparison */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl mx-auto mb-12"
          style={fadeUp(inView, "0.3s")}
        >
          {/* Score 80+ card */}
          <div className="flex-1 w-full bg-white/10 backdrop-blur rounded-xl p-6 text-center border border-[#00C853]/30">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#00C853] mb-3">
              Score 80+ market
            </div>
            <div className="text-2xl font-bold text-[#00C853] font-mono mb-1">
              +$54,906
            </div>
            <div className="text-xs text-[#C5CAE9] mb-2">
              equity after 3 years
            </div>
            <div className="text-sm font-medium text-[#00C853]">
              +{V4_CLAIMS.topQuintile3YExcess}% above state avg/yr
            </div>
          </div>

          {/* VS divider */}
          <div className="text-white/40 font-bold text-lg py-2 sm:py-0">vs</div>

          {/* Score 20 card */}
          <div className="flex-1 w-full bg-white/10 backdrop-blur rounded-xl p-6 text-center border border-red-500/30">
            <div className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">
              Score 20 market
            </div>
            <div className="text-2xl font-bold text-red-400 font-mono mb-1">
              +$36,829
            </div>
            <div className="text-xs text-[#C5CAE9] mb-2">
              equity after 3 years
            </div>
            <div className="text-sm font-medium text-red-400">
              {V4_CLAIMS.bottomQuintile3YExcess}% below state avg/yr
            </div>
          </div>
        </div>

        <HeroBottom inView={inView} />
      </div>
    </section>
  );
}

/* ─── Exported component — dispatches to active variant ─── */
export function HeroSection() {
  return HERO_VARIANT === "A" ? <HeroVariantA /> : <HeroVariantB />;
}
