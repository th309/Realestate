"use client";

import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { trackEvent, flush } from "@/lib/analytics/tracker";
import { formatMarketsScored } from "@/lib/data/validation-claims";

const DISMISS_KEY = "piq_seo_bar_dismissed";
const DISMISS_TTL_MS = 7 * 86_400_000; // 7 days
const SHOW_AFTER_MS = 8_000;
const SHOW_AFTER_SCROLL_PCT = 40;

type Context = "market" | "blog";

interface SeoPageConversionBarProps {
  context: Context;
  marketName?: string;
}

export function SeoPageConversionBar({
  context,
  marketName,
}: SeoPageConversionBarProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const triggerRef = useRef<"scroll" | "timer" | null>(null);
  const shownFiredRef = useRef(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) {
      const dismissedAt = parseInt(stored, 10);
      if (
        !Number.isNaN(dismissedAt) &&
        Date.now() - dismissedAt < DISMISS_TTL_MS
      ) {
        setDismissed(true);
        return;
      }
    }

    let triggered = false;
    const fire = (trigger: "scroll" | "timer") => {
      if (triggered) return;
      triggered = true;
      triggerRef.current = trigger;
      setVisible(true);
    };

    const timer = window.setTimeout(() => fire("timer"), SHOW_AFTER_MS);

    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.body.scrollHeight;
      if (total > 0 && (scrolled / total) * 100 >= SHOW_AFTER_SCROLL_PCT) {
        fire("scroll");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // While the bar is shown, reserve exactly its height at the bottom of the page
  // so the last content can scroll clear of it (and is released when dismissed).
  useEffect(() => {
    if (dismissed || !visible) return;
    const bar = barRef.current;
    if (!bar) return;
    const applyPadding = () => {
      document.body.style.paddingBottom = `${bar.offsetHeight}px`;
    };
    applyPadding();
    window.addEventListener("resize", applyPadding);
    return () => {
      window.removeEventListener("resize", applyPadding);
      document.body.style.paddingBottom = "";
    };
  }, [dismissed, visible]);

  useEffect(() => {
    if (!visible || shownFiredRef.current) return;
    shownFiredRef.current = true;
    trackEvent("seo.conversion_bar_shown", {
      context,
      page_path:
        typeof window !== "undefined" ? window.location.pathname : undefined,
      trigger: triggerRef.current ?? "unknown",
    });
  }, [visible, context]);

  function pagePath(): string {
    return typeof window !== "undefined" ? window.location.pathname : "/";
  }

  function handleCtaClick(action: "signup" | "newsletter") {
    trackEvent("seo.conversion_bar_clicked", {
      context,
      page_path: pagePath(),
      action,
    });
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
    trackEvent("seo.conversion_bar_dismissed", {
      context,
      page_path: pagePath(),
    });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !email) return;
    setSubmitting(true);
    try {
      await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "seo_conversion_bar", context }),
      });
      setSubmitted(true);
      handleCtaClick("newsletter");
    } finally {
      setSubmitting(false);
    }
  }

  if (dismissed || !visible) return null;

  const headline =
    context === "market" && marketName
      ? `Get the full score breakdown for ${marketName} — free`
      : `See live scores for ${formatMarketsScored()} markets — free`;

  const newsletterCtaLabel =
    context === "blog" ? "Weekly market pulse" : "Weekly updates";

  return (
    <div
      ref={barRef}
      // Mobile: stack above BottomNavBar (fixed, 64px + safe-area — see
      // BOTTOM_NAV_HEIGHT_PX in src/components/layout/BottomNavBar.tsx).
      // z-50 (was z-40, tied with the nav) so this wins as the later sibling.
      className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] lg:bottom-0 inset-x-0 z-50 bg-surface-container border-t border-outline-variant shadow-lg pb-safe"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">
            {headline}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!emailMode && !submitted && (
            <>
              <a
                href={`/auth/sign-up?redirect=${encodeURIComponent(pagePath())}`}
                onMouseDown={() => {
                  handleCtaClick("signup");
                  flush();
                }}
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-medium hover:bg-primary/90"
              >
                Sign up free
              </a>
              <button
                type="button"
                onClick={() => setEmailMode(true)}
                className="px-4 py-2 rounded-full border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-high"
              >
                {newsletterCtaLabel}
              </button>
            </>
          )}

          {emailMode && !submitted && (
            <form onSubmit={handleEmailSubmit} className="flex gap-2">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 rounded-full border border-outline-variant text-sm bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
              >
                {submitting ? "..." : "Subscribe"}
              </button>
            </form>
          )}

          {submitted && (
            <span className="text-sm text-on-surface-variant">
              Thanks — check your inbox.
            </span>
          )}

          <button
            type="button"
            aria-label="Dismiss"
            onClick={handleDismiss}
            className="p-2 rounded-full hover:bg-surface-container-high"
          >
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
      </div>
    </div>
  );
}
