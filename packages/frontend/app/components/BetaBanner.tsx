"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "piq-beta-banner-dismissed";
const DISMISS_DAYS = 30;

/** "Coming Soon" beta tester banner — dismissable with 30-day localStorage persistence. */
export function BetaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = Number(dismissed);
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return; // Still within dismiss window
    }
    setVisible(true);
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 text-center relative">
      <p className="text-sm font-medium text-on-surface pr-8">
        <span className="inline-flex items-center gap-2">
          <span className="bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Coming Soon
          </span>
          <span className="text-on-surface-variant">
            PropertyIQ is launching shortly. Become a beta tester and get 3
            months of Pro access in exchange for your feedback &mdash; reach out
            at{" "}
            <a
              href="mailto:betatesters@propertyiq.app"
              className="text-primary hover:text-primary/80 font-semibold underline underline-offset-2"
            >
              betatesters@propertyiq.app
            </a>
          </span>
        </span>
      </p>
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-primary/10 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
