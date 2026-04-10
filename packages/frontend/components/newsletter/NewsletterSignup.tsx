"use client";

import { useState } from "react";

interface NewsletterSignupProps {
  source?: "homepage" | "city-page" | "exit-intent";
  label?: string;
  description?: string;
  buttonText?: string;
}

export function NewsletterSignup({
  source,
  label = "Weekly Market Insights",
  description = "Get data-driven housing market analysis delivered to your inbox every week.",
  buttonText = "Subscribe",
}: NewsletterSignupProps) {
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
        body: JSON.stringify({ email, ...(source ? { source } : {}) }),
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
    <section className="bg-surface-container-low rounded-xl p-6 my-8">
      <h3 className="text-lg font-semibold text-on-surface mb-2">{label}</h3>
      <p className="text-sm text-on-surface-variant mb-4">{description}</p>

      {status === "success" ? (
        <div className="text-emerald-600">
          <p className="font-medium">Almost there!</p>
          <p className="text-sm mt-1 text-on-surface-variant">
            We&apos;ve sent a confirmation link to your email. Please click it
            to complete your subscription.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          {/* Honeypot field — hidden from real users, filled by bots */}
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
            placeholder="you@example.com"
            required
            className="flex-1 px-4 py-2 rounded-full bg-surface border border-outline text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-6 py-2 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {status === "loading" ? "Subscribing..." : buttonText}
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="text-error text-sm mt-2">
          Something went wrong. Please try again.
        </p>
      )}
    </section>
  );
}
