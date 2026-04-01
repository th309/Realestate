"use client";

import { AnimatedCounter } from "./AnimatedCounter";
import { V4_CLAIMS } from "@/lib/data/validation-claims";

/* Coverage breadth + dollar impact — answers "do you cover my area?" and "why should I care?" */
const STATS = [
  {
    value: V4_CLAIMS.scoreExtreme3YGap,
    prefix: "$",
    suffix: "",
    label: "Extra equity — top vs bottom scored market (3yr)",
  },
  {
    value: V4_CLAIMS.metrosValidated,
    suffix: "",
    label: "Metros scored and ranked",
  },
  {
    value: V4_CLAIMS.countiesValidated,
    suffix: "",
    label: "Counties analyzed daily",
  },
  {
    value: V4_CLAIMS.zipsValidated,
    suffix: "",
    label: "ZIP codes — down to your neighborhood",
  },
];

export function StatsSection() {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 py-12 border-y border-white/10">
      {STATS.map((stat, i) => (
        <div key={i} className="text-center">
          <div className="text-3xl md:text-4xl lg:text-5xl font-bold font-mono text-white">
            {"prefix" in stat && stat.prefix}
            <AnimatedCounter end={stat.value} suffix={stat.suffix} />
          </div>
          <div className="text-sm text-[#C5CAE9] mt-2">{stat.label}</div>
        </div>
      ))}
    </section>
  );
}
