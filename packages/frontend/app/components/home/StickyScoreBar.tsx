"use client";

import { useState, useEffect } from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";

interface StickyScore {
  name: string;
  score: number;
}

interface StickyScoreBarProps {
  scores: StickyScore[];
}

export function StickyScoreBar({ scores }: StickyScoreBarProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [website, setWebsite] = useState(""); // honeypot

  useEffect(() => {
    if (sessionStorage.getItem("piq_sticky_dismissed")) {
      setDismissed(true);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 10_000);

    const hero = document.getElementById("hero-heading");
    if (!hero) return () => clearTimeout(timer);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setVisible(true);
      },
      { threshold: 0 },
    );
    observer.observe(hero);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem("piq_sticky_dismissed", "1");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (website) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "sticky-bar" }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (dismissed || !visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-[#1A237E]/95 backdrop-blur-sm border-t border-white/10 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Score ticker + link */}
        <div className="flex items-center gap-2 text-sm text-white/90 flex-wrap justify-center">
          <span className="text-white/50 text-xs uppercase tracking-wide mr-1 hidden sm:inline">
            PropertyIQ Score:
          </span>
          {scores.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/30 mx-1">|</span>}
              <span className="text-white/80">{s.name}</span>
              <span
                className="font-[family-name:var(--font-roboto-mono)] font-bold"
                style={{ color: getScoreColor(s.score) }}
              >
                {s.score}
              </span>
            </span>
          ))}
          <a
            href="/markets"
            className="text-[#C5CAE9] hover:text-white text-xs font-semibold ml-2 transition-colors whitespace-nowrap"
          >
            See all metros →
          </a>
        </div>

        {/* Email capture (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-2">
          {status === "success" ? (
            <span className="text-emerald-400 text-xs">Subscribed!</span>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Get weekly scores"
                required
                aria-label="Email for weekly scores"
                className="w-48 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-xs focus:outline-none focus:ring-1 focus:ring-white/40"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="px-4 py-1.5 bg-white text-[#1A237E] rounded-full font-semibold text-xs hover:bg-white/90 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {status === "loading" ? "..." : "Subscribe"}
              </button>
            </form>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-2 sm:static text-white/40 hover:text-white text-lg leading-none p-1 transition-colors"
          aria-label="Dismiss score bar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
