"use client";

import { useState, type ReactNode } from "react";
import { AnonCaptureModal } from "@/components/entitlements/AnonCaptureModal";
import { trackEvent } from "@/lib/analytics/tracker";

/**
 * The landing's single primary conversion action, repeated at each decision
 * point (hero, after Score, after Proof, after persona, close). Opens the
 * existing email-first AnonCaptureModal (anon == free; new accounts start on a
 * Pro trial, no card). Stamps `cta.click` with the calling `source` and the
 * active variant so the funnel readout can attribute where conversions start.
 */
/** Indigo owns product chrome; green owns the closing ask. Both are brand
 *  accents (CLAUDE.md section 8.2) — this is the split the mockup uses. */
const ACCENT = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-medium focus-visible:outline-primary-light",
  tertiary:
    "bg-tertiary text-on-tertiary hover:bg-tertiary/90 focus-visible:outline-tertiary",
} as const;

export function PrimaryCta({
  source,
  label = "Start free — no credit card",
  subtext = "Every account starts on Pro. Cancel anytime.",
  tone = "onLight",
  accent = "primary",
  icon = null,
  className = "",
}: {
  source: string;
  label?: string;
  subtext?: string | null;
  /** Background the CTA sits on — controls the subtext color for contrast. */
  tone?: "onLight" | "onDark";
  /** Button fill. Green is reserved for the page's closing ask. */
  accent?: keyof typeof ACCENT;
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const subtextColor =
    tone === "onDark" ? "text-primary-light" : "text-on-surface-variant";
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          trackEvent("cta.click", { source });
          setOpen(true);
        }}
        className={`inline-flex h-14 items-center justify-center gap-2.5 rounded-full px-8 font-semibold shadow-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 ${ACCENT[accent]}`}
      >
        {label}
        {icon}
      </button>
      {subtext && <p className={`mt-2 text-xs ${subtextColor}`}>{subtext}</p>}
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
