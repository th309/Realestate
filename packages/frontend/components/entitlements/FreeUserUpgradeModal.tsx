/**
 * FreeUserUpgradeModal
 *
 * Dismissible modal shown to free authenticated users every 5 minutes.
 * Shows feature comparison (Free vs Pro) and CTA to Stripe checkout.
 *
 * M3 design: Extra Large dialog, Surface Container High, Level 3.
 * Dismissible via X button or clicking outside.
 */

'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { X, Lock, Check, Minus } from 'lucide-react';
import { startCheckout } from '@/lib/data/fetchers/billing';
import { trackPaywallEvent } from '@/lib/entitlements/api';

interface FreeUserUpgradeModalProps {
  onDismiss: () => void;
}

const COMPARISON_ROWS = [
  { feature: 'Market access', free: '5 markets', pro: 'Unlimited' },
  { feature: 'Data metrics', free: 'Basic set', pro: 'All 40+ metrics' },
  { feature: 'AI reports', free: false, pro: true },
  { feature: 'Score breakdowns', free: false, pro: true },
  { feature: 'Data export', free: false, pro: true },
] as const;

export function FreeUserUpgradeModal({ onDismiss }: FreeUserUpgradeModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackPaywallEvent('feature', 'site-paywall-free', 'view', window.location.pathname);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleScrimClick = useCallback(
    (e: React.MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        trackPaywallEvent('feature', 'site-paywall-free', 'dismiss', window.location.pathname);
        onDismiss();
      }
    },
    [onDismiss],
  );

  const handleUpgradeClick = useCallback(async () => {
    trackPaywallEvent('feature', 'site-paywall-free', 'click_upgrade', window.location.pathname);
    try {
      const checkoutUrl = await startCheckout('pro', 'month', window.location.pathname);
      window.location.href = checkoutUrl;
    } catch {
      // Fallback: send to pricing page
      window.location.href = '/pricing';
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-400"
      onClick={handleScrimClick}
    >
      <div
        ref={cardRef}
        className="relative mx-4 w-full max-w-md rounded-[28px] bg-surface-container-high p-8 shadow-lg animate-in zoom-in-95 duration-400"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-heading"
      >
        {/* Close button */}
        <button
          onClick={() => {
            trackPaywallEvent('feature', 'site-paywall-free', 'dismiss', window.location.pathname);
            onDismiss();
          }}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>

        {/* Heading */}
        <h2
          id="upgrade-modal-heading"
          className="mb-2 text-center text-xl font-semibold tracking-tight text-on-surface"
        >
          Unlock the full PropertyIQ experience
        </h2>
        <p className="mb-6 text-center text-sm text-on-surface-variant">
          Get unlimited access to every market, metric, and AI-powered tool.
        </p>

        {/* Feature comparison */}
        <div className="mb-6 overflow-hidden rounded-xl border border-outline-variant">
          {/* Header row */}
          <div className="grid grid-cols-3 border-b border-outline-variant bg-surface-container-low px-4 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
              Feature
            </span>
            <span className="text-center text-xs font-medium uppercase tracking-wide text-on-surface-variant">
              Free
            </span>
            <span className="text-center text-xs font-medium uppercase tracking-wide text-primary">
              Pro
            </span>
          </div>
          {/* Rows */}
          {COMPARISON_ROWS.map(({ feature, free, pro }) => (
            <div
              key={feature}
              className="grid grid-cols-3 border-b border-outline-variant/50 px-4 py-2.5 last:border-0"
            >
              <span className="text-sm text-on-surface">{feature}</span>
              <span className="flex items-center justify-center text-sm text-on-surface-variant">
                {typeof free === 'string' ? (
                  free
                ) : free ? (
                  <Check className="h-4 w-4 text-on-surface-variant" />
                ) : (
                  <Minus className="h-4 w-4 text-outline" />
                )}
              </span>
              <span className="flex items-center justify-center text-sm font-medium text-primary">
                {typeof pro === 'string' ? (
                  pro
                ) : pro ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Minus className="h-4 w-4 text-outline" />
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleUpgradeClick}
          className="flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
        >
          Upgrade to Pro
        </button>

        {/* Secondary */}
        <p className="mt-3 text-center text-sm text-on-surface-variant">
          <Link href="/pricing" className="font-medium text-primary hover:text-primary/80">
            View all plans
          </Link>
        </p>
      </div>
    </div>
  );
}
