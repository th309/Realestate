/**
 * AnonPaywallOverlay
 *
 * Full-screen non-dismissible overlay shown to anonymous users
 * after they've visited 5+ product pages. Prompts account creation.
 *
 * M3 design: Extra Large dialog (rounded-[28px]), Surface Container High,
 * Level 3 elevation. No dismiss mechanism.
 */

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { MapPin, BarChart3, Sparkles } from 'lucide-react';
import { trackPaywallEvent } from '@/lib/entitlements/api';

const VALUE_PROPS = [
  { icon: MapPin, text: 'Explore every market nationwide' },
  { icon: BarChart3, text: 'Interactive data and analytics tools' },
  { icon: Sparkles, text: 'AI-powered market insights' },
] as const;

export function AnonPaywallOverlay() {
  useEffect(() => {
    trackPaywallEvent('feature', 'site-paywall-anon', 'view', window.location.pathname);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative mx-4 w-full max-w-md rounded-[28px] bg-surface-container-high p-8 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anon-paywall-heading"
      >
        {/* Logo */}
        <div className="mb-6 text-center">
          <span className="text-xl font-bold tracking-tight text-on-surface">
            Property<span className="text-primary">IQ</span>
          </span>
        </div>

        {/* Heading */}
        <h2
          id="anon-paywall-heading"
          className="mb-2 text-center text-2xl font-semibold tracking-tight text-on-surface"
        >
          Create your free account to continue
        </h2>
        <p className="mb-8 text-center text-sm text-on-surface-variant">
          You&apos;ve explored 5 pages &mdash; sign up in seconds to keep going
        </p>

        {/* Value props */}
        <ul className="mb-8 space-y-3">
          {VALUE_PROPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-on-surface">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              {text}
            </li>
          ))}
        </ul>

        {/* Primary CTA */}
        <Link
          href="/auth/sign-up"
          onClick={() =>
            trackPaywallEvent('feature', 'site-paywall-anon', 'click_upgrade', window.location.pathname)
          }
          className="flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
        >
          Sign Up Free
        </Link>

        {/* Secondary */}
        <p className="mt-4 text-center text-sm text-on-surface-variant">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="font-medium text-primary hover:text-primary/80">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
