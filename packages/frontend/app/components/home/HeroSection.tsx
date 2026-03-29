"use client";

import { useInView } from "./hooks/useInView";
import { HeroSearchBar } from "./HeroSearchBar";
import { V4_CLAIMS } from "@/lib/data/validation-claims";

function fadeUp(inView: boolean, delay: string) {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(16px)",
    transition: "opacity 0.7s ease, transform 0.7s ease",
    transitionDelay: delay,
  } as const;
}

const PROOF_POINTS = [
  {
    value: `+$${V4_CLAIMS.metroGap3Y.toLocaleString()}`,
    color: "text-[#00C853]",
    lines: ["3-year equity edge in", "top-scored vs bottom markets"],
  },
  {
    value: `${V4_CLAIMS.yearHitRate1Y}%`,
    color: "text-[#00C853]",
    lines: ["of years tested, top-scored", "markets outperformed"],
  },
  {
    value: `${V4_CLAIMS.backtestYears} years`,
    color: "text-white",
    lines: [
      "of validated predictions",
      `across ${V4_CLAIMS.metrosValidated.toLocaleString()}+ metros`,
    ],
  },
];

export function HeroSection() {
  const [setRef, inView] = useInView();

  const totalMarkets = (
    V4_CLAIMS.metrosValidated +
    V4_CLAIMS.countiesValidated +
    V4_CLAIMS.zipsValidated
  ).toLocaleString();

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

        {/* Headline — lead with transformation, not features */}
        <h1
          id="hero-heading"
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5 leading-[1.1] font-[family-name:var(--font-source-serif)]"
          style={fadeUp(inView, "0.1s")}
        >
          Know before you buy.{" "}
          <span className="text-[#C5CAE9]/70">Not after.</span>
        </h1>

        {/* Subheadline — address all three audiences */}
        <p
          className="text-lg md:text-xl text-[#C5CAE9] mb-10 max-w-2xl mx-auto leading-relaxed"
          style={fadeUp(inView, "0.2s")}
        >
          PropertyIQ scores {totalMarkets} markets across America — so agents
          advise with confidence, investors find outperformers early, and
          homebuyers make the right call.
        </p>

        {/* Proof points — dollars and plain English, not jargon */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-12"
          style={fadeUp(inView, "0.3s")}
        >
          {PROOF_POINTS.map((point) => (
            <div
              key={point.value}
              className="bg-white/10 backdrop-blur rounded-xl p-5 text-center"
            >
              <div
                className={`text-[28px] font-bold ${point.color} font-mono leading-tight`}
              >
                {point.value}
              </div>
              {point.lines.map((line) => (
                <div key={line} className="text-xs text-[#C5CAE9] leading-snug">
                  {line}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="mb-8" style={fadeUp(inView, "0.4s")}>
          <HeroSearchBar />
          <p className="text-xs text-[#C5CAE9]/60 mt-2">
            Try: Miami, Austin TX, 90210, Cook County
          </p>
        </div>

        {/* CTAs */}
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
      </div>
    </section>
  );
}
