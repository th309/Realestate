// packages/frontend/components/entitlements/AnonCaptureModal.tsx
"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackPaywallEvent } from "@/lib/entitlements/api";
import { useDismissable } from "@/lib/entitlements/useDismissable";
import { useModalHistory } from "@/lib/pwa/use-modal-history";

interface AnonCaptureModalProps {
  /** Human-readable name of the feature the user tried to unlock. */
  featureName: string;
  /** URL to return to after signup (already encodes desired map state). */
  returnTo: string;
  onDismiss: () => void;
}

/**
 * Dismissible, email-first capture shown when an anonymous user clicks a
 * locked premium feature. Email routes to the canonical signup with the email
 * prefilled and a redirect back to `returnTo`; Google runs OAuth directly,
 * carrying `tos=1` + `next` exactly like the signup page. The new account
 * receives a 14-day Pro trial at signup (see complete-signup / auth callback),
 * which unlocks the clicked feature on return.
 */
export function AnonCaptureModal({
  featureName,
  returnTo,
  onDismiss,
}: AnonCaptureModalProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const { onScrimClick } = useDismissable({ onDismiss, cardRef });

  // System back button / edge-swipe dismisses this modal instead of
  // navigating away or exiting the installed PWA. Only mounts while shown
  // (see MetricItem/QuickActions' `{showPaywall && <AnonCaptureModal .../>}`).
  useModalHistory(true, onDismiss, "anon-capture-modal");

  useEffect(() => {
    trackPaywallEvent(
      "feature",
      "anon-capture",
      "view",
      window.location.pathname,
    );
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    trackPaywallEvent(
      "feature",
      "anon-capture",
      "click_upgrade",
      window.location.pathname,
    );
    const url = `/auth/sign-up?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(returnTo)}`;
    router.push(url);
  };

  const handleGoogle = async () => {
    trackPaywallEvent(
      "feature",
      "anon-capture",
      "click_upgrade",
      window.location.pathname,
    );
    const supabase = createSupabaseBrowserClient();
    const callbackUrl = `${window.location.origin}/auth/callback?tos=1&next=${encodeURIComponent(returnTo)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-400"
      onClick={onScrimClick}
    >
      <div
        ref={cardRef}
        className="relative mx-4 w-full max-w-md rounded-[28px] bg-surface-container-high p-8 shadow-lg animate-in zoom-in-95 duration-400"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anon-capture-heading"
      >
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-5 flex justify-center">
          <Image
            src="/brand/piq-avatar-400x400.png"
            alt="PropertyIQ"
            width={56}
            height={56}
            className="rounded-2xl"
            priority
          />
        </div>

        <h2
          id="anon-capture-heading"
          className="mb-2 text-center text-xl font-semibold tracking-tight text-on-surface"
        >
          Unlock {featureName} — free for 14 days
        </h2>
        <p className="mb-6 text-center text-sm text-on-surface-variant">
          Create a free account and your first 14 days of Pro are on us. No card
          required.
        </p>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            Continue
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-outline-variant" />
          <span className="text-xs text-on-surface-variant">or</span>
          <div className="h-px flex-1 bg-outline-variant" />
        </div>

        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-6 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
        >
          Sign in with Google
        </button>

        <p className="mt-4 text-center text-xs text-on-surface-variant">
          By continuing you agree to our{" "}
          <a
            href="/about/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            Terms of Service
          </a>
          .
        </p>
      </div>
    </div>
  );
}
