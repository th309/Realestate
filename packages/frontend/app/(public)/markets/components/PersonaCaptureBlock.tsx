"use client";

import { useState } from "react";

type Role = "investor" | "agent" | "buyer";

const ROLES: { id: Role; label: string; description: string }[] = [
  {
    id: "investor",
    label: "Investor",
    description: "Cap rates, cash flow, and appreciation forecasts",
  },
  {
    id: "agent",
    label: "Agent / Realtor",
    description: "Listing insights, buyer demand, and market timing",
  },
  {
    id: "buyer",
    label: "Home Buyer",
    description: "Affordability, price trends, and local inventory",
  },
];

interface PersonaCaptureBlockProps {
  geoName: string;
  /** Newsletter source tag — passed to /api/newsletter */
  source?: string;
}

export function PersonaCaptureBlock({
  geoName,
  source = "persona-capture",
}: PersonaCaptureBlockProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole || !email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source,
          role: selectedRole,
          geo: geoName,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ?? "Subscription failed",
        );
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  if (status === "done") {
    return (
      <div
        role="status"
        className="max-w-4xl mx-auto px-4 py-8 text-center text-on-surface"
      >
        <p className="text-lg font-medium">You&apos;re in!</p>
        <p className="text-sm text-on-surface-variant mt-1">
          We&apos;ll send you{" "}
          {selectedRole === "investor"
            ? "investment insights"
            : selectedRole === "agent"
              ? "agent market briefs"
              : "buyer market updates"}{" "}
          for {geoName}.
        </p>
      </div>
    );
  }

  return (
    <section
      className="max-w-4xl mx-auto px-4 py-8"
      aria-label="Get market updates"
    >
      <div className="rounded-xl border border-outline-variant bg-surface-container-low shadow-sm p-6">
        <h2 className="text-base font-medium text-on-surface mb-1">
          Get {geoName} market updates
        </h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Choose your role for tailored insights.
        </p>

        {/* Role tabs */}
        <div
          className="flex flex-wrap gap-2 mb-5"
          role="group"
          aria-label="Select your role"
        >
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={selectedRole === r.id}
              onClick={() => setSelectedRole(r.id)}
              className={[
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                selectedRole === r.id
                  ? "border-primary bg-primary text-white"
                  : "border-outline text-on-surface-variant hover:border-primary hover:text-primary",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Role description */}
        {selectedRole && (
          <p className="text-xs text-on-surface-variant mb-4">
            {ROLES.find((r) => r.id === selectedRole)?.description}
          </p>
        )}

        {/* Email form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            aria-label="Email address"
            disabled={status === "loading"}
            className="flex-1 rounded-full border border-outline px-4 py-2 text-sm text-on-surface bg-surface focus:outline-none focus:border-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!selectedRole || !email.trim() || status === "loading"}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-primary-dark transition-colors"
          >
            {status === "loading" ? "Subscribing…" : "Get updates"}
          </button>
        </form>

        {status === "error" && (
          <p role="alert" className="mt-2 text-xs text-error">
            {errorMsg}
          </p>
        )}
      </div>
    </section>
  );
}
