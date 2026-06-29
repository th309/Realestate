"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useEntitlements, ResourceType, UserTier } from "@/lib/entitlements";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getPricingCtaVariant,
  PRICING_CTA_COPY,
  type PricingCtaVariant,
} from "@/lib/ab";
import { trackEvent } from "@/lib/analytics/tracker";

interface PaywallCardProps {
  type: ResourceType;
  id: string;
  title?: string;
  description?: string;
  className?: string;
}

const TIER_LABELS: Record<UserTier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
  admin: "Admin",
};

// Stable references for useSyncExternalStore (below). The A/B variant lives in
// localStorage (client-only); the server snapshot is always "A" so SSR and the
// initial client render agree, then it resolves to the real variant after hydration.
const subscribeNoop = () => () => {};
const variantServerSnapshot = (): PricingCtaVariant => "A";

export function PaywallCard({
  type,
  id,
  title,
  description,
  className = "",
}: PaywallCardProps) {
  const { getTierRequired, trackUpgradeClick } = useEntitlements();
  const tierRequired = getTierRequired(type, id) || "pro";
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(true); // default true to avoid flash

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(
        ({ data }: Awaited<ReturnType<typeof supabase.auth.getSession>>) => {
          setIsAuthenticated(!!data.session);
        },
      );
  }, []);

  // The A/B variant is client-only (localStorage + Math.random) so it can never
  // match SSR. useSyncExternalStore renders the SSR-stable "A" through hydration,
  // then swaps to the real client variant after — no hydration mismatch, and the
  // assignment/tracking side effect runs on the client snapshot, not in render.
  const variant = useSyncExternalStore(
    subscribeNoop,
    getPricingCtaVariant,
    variantServerSnapshot,
  );

  const handleUpgradeClick = () => {
    trackUpgradeClick(type, id);
    trackEvent("conversion.pricing_cta_click", { variant, source: "paywall" });
  };

  return (
    <div
      data-testid={`paywall-card-${type}-${id}`}
      className={`
        bg-surface-container rounded-xl p-6 border border-outline-variant
        flex flex-col items-center text-center gap-4
        ${className}
      `}
    >
      <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold tracking-wide uppercase">
        {TIER_LABELS[tierRequired as UserTier] || "Pro"}
      </span>

      <div>
        <h3
          data-testid="paywall-title"
          className="text-lg font-medium text-on-surface"
        >
          {title || "Upgrade to Unlock"}
        </h3>
        <p className="text-sm text-on-surface-variant mt-1">
          {description ||
            "Get the data edge. Access 60+ metrics, ZIP-level detail, and full market history \u2014 analytics typically reserved for institutional investors."}
        </p>
      </div>

      <Link
        data-testid="paywall-cta"
        href={
          isAuthenticated
            ? `/pricing?from=${encodeURIComponent(pathname)}`
            : `/auth/sign-up?redirect=${encodeURIComponent(pathname)}`
        }
        onClick={handleUpgradeClick}
        className="
          inline-flex items-center gap-2 px-6 py-2.5
          bg-primary text-on-primary rounded-full
          font-medium text-sm
          hover:bg-primary/90 transition-colors
        "
      >
        {isAuthenticated ? PRICING_CTA_COPY[variant] : "Sign Up Free"}
      </Link>
    </div>
  );
}
