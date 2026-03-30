"use client";

import { AnimatedCounter } from "./AnimatedCounter";
import { V4_CLAIMS } from "@/lib/data/validation-claims";

/* Coverage breadth — answers "do you cover my area?" for every audience */
const STATS = [
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
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8 px-6 py-12 border-y border-white/10">
      {STATS.map((stat, i) => (
        <div key={i} className="text-center">
          <div className="text-3xl md:text-4xl lg:text-5xl font-bold font-mono text-white">
            <AnimatedCounter end={stat.value} suffix={stat.suffix} />
          </div>
          <div className="text-sm text-[#C5CAE9] mt-2">{stat.label}</div>
        </div>
      ))}
    </section>
  );
}
