"use client";

import { useState } from "react";

export function EmailCaptureBar() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [website, setWebsite] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (website) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "homepage" }),
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

  return (
    <section className="w-full px-4 py-6 bg-surface/10 backdrop-blur-sm border-t border-white/10">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-white/90 text-sm font-medium mb-3">
          Get free market scores weekly
        </p>
        {status === "success" ? (
          <p className="text-emerald-400 text-sm font-medium">
            Check your inbox — confirmation link sent.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-2 justify-center"
          >
            {/* Honeypot */}
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
              placeholder="Enter your email"
              required
              aria-label="Email address for weekly market scores"
              className="w-full sm:w-72 px-4 py-2.5 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-6 py-2.5 bg-white text-[#1A237E] rounded-full font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {status === "loading" ? "Sending..." : "Get Scores"}
            </button>
          </form>
        )}
        {status === "error" && (
          <p className="text-red-300 text-xs mt-2">
            Something went wrong. Please try again.
          </p>
        )}
        <p className="text-white/40 text-xs mt-2">
          Free. No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
}
