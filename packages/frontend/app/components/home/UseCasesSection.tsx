"use client";

import { useInView } from "./hooks/useInView";
import { TrendingUp, Home, Building2 } from "lucide-react";

const USE_CASES = [
  {
    icon: TrendingUp,
    persona: "Investors",
    description:
      "Find markets where fundamentals support appreciation before the crowd does. Score every metro, county, and ZIP — then commit capital with data behind you.",
    cta: "Explore top markets",
    href: "/market",
  },
  {
    icon: Home,
    persona: "Agents",
    description:
      "Walk into every listing presentation with a market score and AI-generated narrative. Win listings with numbers, not instinct.",
    cta: "See market reports",
    href: "/reports/sample",
  },
  {
    icon: Building2,
    persona: "Syndicators",
    description:
      "Underwrite deals faster with monthly-updated cap rate estimates, rent data, and market timing signals across every target geography.",
    cta: "View market data",
    href: "/markets",
  },
];

export function UseCasesSection() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="py-16 lg:py-24 px-6"
      aria-labelledby="use-cases-heading"
    >
      <div className="max-w-5xl mx-auto">
        <div
          className="text-center mb-12"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <span className="text-xs font-semibold text-[#3949AB] uppercase tracking-[0.15em] mb-3 block">
            Use Cases
          </span>
          <h2
            id="use-cases-heading"
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#1A237E] tracking-tight leading-tight font-[family-name:var(--font-source-serif)]"
          >
            Built for the people who move markets.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {USE_CASES.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.persona}
                className="rounded-2xl bg-white/80 border border-[#C5CAE9] p-7 flex flex-col"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0)" : "translateY(20px)",
                  transition: "opacity 0.6s ease, transform 0.6s ease",
                  transitionDelay: `${i * 0.1}s`,
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#E8EAF6] flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[#3949AB]" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-[#1A237E] mb-3">
                  {item.persona}
                </h3>
                <p className="text-sm text-[#3949AB] leading-relaxed mb-6 flex-1">
                  {item.description}
                </p>
                <a
                  href={item.href}
                  className="text-sm font-semibold text-[#3949AB] hover:text-[#1A237E] transition-colors inline-flex items-center gap-1 group"
                >
                  {item.cta}
                  <span
                    className="transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
