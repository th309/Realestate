"use client";

import { useInView } from "./hooks/useInView";
import { AlertTriangle, Newspaper, Users } from "lucide-react";

const PROBLEMS = [
  {
    icon: AlertTriangle,
    problem: "Investing blind is expensive.",
    detail:
      "Committing capital to a market you don't understand isn't a calculated risk — it's a guess with six-figure consequences.",
  },
  {
    icon: Newspaper,
    problem: "News is noise.",
    detail:
      "Headlines lag reality by months. By the time a market makes the news, the opportunity has already moved.",
  },
  {
    icon: Users,
    problem: "Your neighbor's tip is not a strategy.",
    detail:
      "Anecdotes, gut instinct, and hot takes are not a repeatable edge. You need data, not opinions.",
  },
];

export function ProblemSection() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="py-16 lg:py-24 px-6"
      aria-labelledby="problem-heading"
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
          <span className="text-xs font-semibold text-[#C5CAE9] uppercase tracking-[0.15em] mb-3 block">
            The Problem
          </span>
          <h2
            id="problem-heading"
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight font-[family-name:var(--font-source-serif)]"
          >
            Most investors are making it up as they go.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.problem}
                className="rounded-2xl bg-white/5 border border-white/10 p-7"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? "translateY(0)" : "translateY(20px)",
                  transition: "opacity 0.6s ease, transform 0.6s ease",
                  transitionDelay: `${i * 0.1}s`,
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[#C5CAE9]" aria-hidden="true" />
                </div>
                <p className="text-base font-semibold text-white mb-2">
                  {item.problem}
                </p>
                <p className="text-sm text-[#C5CAE9] leading-relaxed">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
