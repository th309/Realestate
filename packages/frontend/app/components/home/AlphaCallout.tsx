"use client";

import { TrendingUp } from "lucide-react";
import { useInView } from "./hooks/useInView";
import { V4_CLAIMS, formatDollarClaim } from "@/lib/data";

export function AlphaCallout() {
  const [setRef, inView] = useInView();
  const alphaFormatted = formatDollarClaim(V4_CLAIMS.metroGap1Y);

  return (
    <section
      ref={setRef}
      className="py-5 lg:py-7 px-6"
      aria-labelledby="alpha-heading"
    >
      <div
        className="max-w-3xl mx-auto rounded-2xl bg-[#1A237E]/60 backdrop-blur-sm border border-white/15 p-8 md:p-12"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        {/* Icon + Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#C5CAE9]" />
          </div>
          <span className="text-xs font-semibold text-[#C5CAE9] uppercase tracking-[0.15em]">
            The Harder Problem
          </span>
        </div>

        {/* Headline */}
        <h2
          id="alpha-heading"
          className="text-2xl md:text-3xl lg:text-[2.1rem] font-bold text-white tracking-tight leading-tight mb-6 font-[family-name:var(--font-source-serif)]"
        >
          We Don&apos;t Predict &ldquo;Florida Will Be Hot.&rdquo;
          <br />
          We Predict <span className="text-[#00C853]">Which</span> Florida Metro
          Will Beat the Others.
        </h2>

        {/* Body */}
        <div className="space-y-4 text-base text-[#C5CAE9] leading-relaxed mb-8">
          <p>
            Most forecast models predict raw appreciation. Will home prices go
            up or down? That&apos;s <strong className="text-white">beta</strong>
            . It&apos;s easy and not very useful. Every model gets &ldquo;Sun
            Belt is growing&rdquo; right.
          </p>
          <p>
            PropertyIQ scores predict{" "}
            <strong className="text-white">
              excess returns above regional benchmarks
            </strong>
            . That&apos;s <em className="text-white">alpha</em>. Given two
            metros in the same state, which one will <em>outperform</em>?
            That&apos;s the question worth {alphaFormatted} per year.
          </p>
        </div>

        {/* Beta vs Alpha cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Beta */}
          <div className="rounded-xl border border-white/20 bg-white/10 p-5">
            <span className="text-[11px] font-semibold text-[#C5CAE9] uppercase tracking-[0.12em]">
              Beta (What Others Predict)
            </span>
            <p className="mt-2 text-sm font-semibold text-white">
              &ldquo;Tampa will appreciate 5% this year&rdquo;
            </p>
            <p className="mt-1 text-xs text-[#C5CAE9]">
              Raw appreciation. Everyone knows this.
            </p>
          </div>

          {/* Alpha */}
          <div className="rounded-xl border border-[#00C853]/20 bg-[#00C853]/10 p-5">
            <span className="text-[11px] font-semibold text-[#00C853] uppercase tracking-[0.12em]">
              Alpha (What PropertyIQ Predicts)
            </span>
            <p className="mt-2 text-sm font-semibold text-white">
              &ldquo;Tampa will beat other FL metros by 2.3pp&rdquo;
            </p>
            <p className="mt-1 text-xs text-[#00C853] flex items-center gap-1">
              <span aria-hidden="true">&rarr;</span> This is the{" "}
              {alphaFormatted} insight.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
