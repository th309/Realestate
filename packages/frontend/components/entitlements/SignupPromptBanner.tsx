'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { shouldShowSignupPrompt, dismissSignupPrompt } from '@/lib/entitlements/anonymousViews';
import { trackEvent } from '@/lib/analytics/tracker';

export function SignupPromptBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = shouldShowSignupPrompt();
    setVisible(show);
    if (show) {
      trackEvent('signup.banner_view');
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-surface-container-highest rounded-2xl p-4 shadow-lg border border-outline-variant flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <UserPlus className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-on-surface">Create a free account</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Save markets, track changes, and get personalized insights.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Link
              href="/auth/signup"
              onClick={() => trackEvent('signup.banner_click', { target: 'signup' })}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Sign up free
            </Link>
            <Link
              href="/auth/login"
              onClick={() => trackEvent('signup.banner_click', { target: 'login' })}
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
        <button
          onClick={() => {
            dismissSignupPrompt();
            setVisible(false);
          }}
          className="p-1 rounded-lg hover:bg-surface-container transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-on-surface-variant" />
        </button>
      </div>
    </div>
  );
}
