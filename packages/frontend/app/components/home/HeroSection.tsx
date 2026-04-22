"use client";

import { useInView } from "./hooks/useInView";
import { HeroSearchBar } from "./HeroSearchBar";
import { trackEvent, flush } from "@/lib/analytics/tracker";

function fadeUp(inView: boolean, delay: string) {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(16px)",
    transition: "opacity 0.7s ease, transform 0.7s ease",
    transitionDelay: delay,
  } as const;
}

const TRUST_SIGNALS = [
  "400+ markets scored",
  "Updated monthly with Zillow, Census, Realtor.com data",
  "Used by investors, agents, and syndicators",
];

export function HeroSection() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="relative pt-8 pb-20 lg:pt-10 lg:pb-32 px-6 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <div className="relative max-w-5xl mx-auto text-center z-10">
        {/* H1 — CMO headline */}
        <h1
          id="hero-heading"
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5 leading-[1.1] font-[family-name:var(--font-source-serif)]"
          style={fadeUp(inView, "0s")}
        >
          23,600+ U.S. Real Estate Markets.{" "}
          <span className="text-[#00C853]">Scored.</span>
        </h1>

        {/* Subhead — CMO copy */}
        <p
          className="text-lg md:text-xl text-[#C5CAE9] mb-8 max-w-2xl mx-auto leading-relaxed"
          style={fadeUp(inView, "0.1s")}
        >
          PropertyIQ gives every metro, county, and ZIP code a 0–100 score —
          updated monthly. Know which markets are heating up, cooling off, or
          flying under the radar before you commit capital.
        </p>

        {/* Trust signals — above the fold */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-10"
          style={fadeUp(inView, "0.15s")}
        >
          {TRUST_SIGNALS.map((signal) => (
            <div
              key={signal}
              className="flex items-center gap-2 text-sm text-[#C5CAE9]"
            >
              <svg
                className="w-4 h-4 text-[#00C853] flex-shrink-0"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
              </svg>
              {signal}
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="mb-8" style={fadeUp(inView, "0.2s")}>
          <HeroSearchBar />
          <p className="text-xs text-[#C5CAE9]/60 mt-2">
            Try: Miami, Austin TX, 90210, Cook County
          </p>
        </div>

        {/* CTAs — primary + secondary */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          style={fadeUp(inView, "0.25s")}
        >
          <a
            href="/map"
            onMouseDown={() => {
              trackEvent("hero.cta_click", {
                cta_id: "explore_map",
                cta_label: "Explore the Map — Free",
                destination: "/map",
              });
              flush();
            }}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#1A237E] text-sm font-semibold shadow-md hover:bg-white/90 hover:shadow-lg transition-all duration-200"
          >
            Explore the Map — Free
          </a>
          <a
            href="/reports/sample"
            onMouseDown={() => {
              trackEvent("hero.cta_click", {
                cta_id: "sample_report",
                cta_label: "See a Sample AI Report",
                destination: "/reports/sample",
              });
              flush();
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-all duration-200"
          >
            See a Sample AI Report
          </a>
        </div>
      </div>
    </section>
  );
}
