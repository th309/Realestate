"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTourSignup } from "@/lib/data";
import { useTour } from "../TourStateProvider";

export function InlineSignupForm() {
  const { session } = useTour();
  const router = useRouter();
  const signup = useTourSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-4 top-4 z-40 rounded-full bg-primary px-4 py-2 text-xs font-medium text-on-primary shadow-lg"
      >
        Sign up to save →
      </button>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.sessionId) return;
    try {
      const result = await signup.mutateAsync({
        email,
        password,
        tourSessionId: session.sessionId,
      });
      if (!result.needsEmailConfirmation) {
        const params = new URLSearchParams();
        params.set("phase", "celebrate");
        params.set("sessionId", session.sessionId);
        router.replace(`/tour?${params}`);
      }
    } catch {
      // error rendered below; nothing else needed here
    }
  };

  if (signup.isSuccess && signup.data?.needsEmailConfirmation) {
    return (
      <div
        id="signup-cta"
        className="mt-4 rounded-2xl border border-primary-container bg-gradient-to-b from-surface-container-lowest to-surface p-7"
      >
        <h3 className="text-xl font-semibold text-on-surface">
          Almost done — check your email
        </h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          finish setting up your account. Your report is already saved and
          waiting for you.
        </p>
      </div>
    );
  }

  return (
    <form
      id="signup-cta"
      onSubmit={onSubmit}
      className="mt-4 rounded-2xl border border-primary-container bg-gradient-to-b from-surface-container-lowest to-surface p-7"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-on-surface">
            Save {session.market?.name?.split(",")[0] ?? "your market"}. Make
            another. Share with your client.
          </h3>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Sign up free — keeps your demo report, removes the watermark,
            unlocks unlimited markets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Dismiss signup"
          className="text-on-surface-variant/60 hover:text-on-surface-variant"
        >
          ✕
        </button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@brokerage.com"
          required
          autoComplete="email"
          className="min-w-[220px] flex-1 rounded-full border border-outline-variant bg-surface px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
          required
          autoComplete="new-password"
          minLength={8}
          className="min-w-[180px] flex-1 rounded-full border border-outline-variant bg-surface px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={signup.isPending}
          className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary transition hover:bg-primary/90 disabled:opacity-60"
        >
          {signup.isPending ? "Saving…" : "Save my report →"}
        </button>
      </div>

      <ul className="mt-3.5 flex flex-wrap gap-4 text-xs text-on-surface-variant">
        {[
          "14-day Pro trial",
          "No credit card",
          "Unlimited markets",
          "Branded shareable links",
        ].map((b) => (
          <li
            key={b}
            className="flex items-center gap-1.5 before:font-bold before:text-tertiary before:content-['✓']"
          >
            {b}
          </li>
        ))}
      </ul>

      {signup.isError && (
        <p className="mt-3 text-xs text-error">{signup.error.message}</p>
      )}

      <p className="mt-3 text-[11px] text-on-surface-variant">
        By signing up you accept our{" "}
        <a href="/terms" className="text-primary">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-primary">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
