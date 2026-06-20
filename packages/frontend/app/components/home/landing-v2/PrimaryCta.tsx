"use client";

import { useState } from "react";
import { AnonCaptureModal } from "@/components/entitlements/AnonCaptureModal";
import { trackEvent } from "@/lib/analytics/tracker";

/**
 * The landing's single primary conversion action, repeated at each decision
 * point (hero, after Score, after Proof, after persona, close). Opens the
 * existing email-first AnonCaptureModal (anon == free; new accounts start on a
 * Pro trial, no card). Stamps `cta.click` with the calling `source` and the
 * active variant so the funnel readout can attribute where conversions start.
 */
export function PrimaryCta({
  source,
  label = "Start free — no credit card",
  subtext = "Every account starts on Pro. Cancel anytime.",
  className = "",
}: {
  source: string;
  label?: string;
  subtext?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          trackEvent("cta.click", { source });
          setOpen(true);
        }}
        className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 font-medium text-on-primary shadow-sm transition-colors duration-200 hover:bg-primary-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-light"
      >
        {label}
      </button>
      {subtext && (
        <p className="mt-2 text-xs text-on-surface-variant">{subtext}</p>
      )}
      {open && (
        <AnonCaptureModal
          featureName="PropertyIQ Pro"
          returnTo="/map"
          onDismiss={() => setOpen(false)}
        />
      )}
    </div>
  );
}
