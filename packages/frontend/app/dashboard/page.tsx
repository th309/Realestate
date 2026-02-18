'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, MapPin, Bell, TrendingUp, Search, LogIn } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { WatchlistDashboard } from '@/components/watchlist';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setAuthLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Dashboard' }]}
          title="Dashboard"
          description="Your saved markets and insights"
          icon={<LayoutDashboard className="w-5 h-5" />}
        />

        {authLoading ? (
          <DashboardSkeleton />
        ) : !userId ? (
          <SignInPrompt />
        ) : (
          <AuthenticatedDashboard userId={userId} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Authenticated dashboard with all sections                         */
/* ------------------------------------------------------------------ */

function AuthenticatedDashboard({ userId }: { userId: string }) {
  const { items, isLoading } = useWatchlist({ userId, autoLoad: true });

  return (
    <div className="mt-8 space-y-10">
      {/* Your Markets */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-on-surface">Your Markets</h2>
          {!isLoading && items.length > 0 && (
            <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <WatchlistDashboard items={items} isLoading={isLoading} />
      </section>

      {/* Alerts (Phase 8 placeholder) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-on-surface-variant" />
          <h2 className="text-base font-semibold text-on-surface">Alerts</h2>
        </div>
        <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-on-surface-variant/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Coming soon</p>
            <p className="text-xs text-on-surface-variant/70 mt-0.5">
              Set price and score alerts on your saved markets and get notified when conditions change.
            </p>
          </div>
        </div>
      </section>

      {/* Markets to Watch (Phase 9 placeholder) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-on-surface-variant" />
          <h2 className="text-base font-semibold text-on-surface">Markets to Watch</h2>
        </div>
        <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-on-surface-variant/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Coming soon</p>
            <p className="text-xs text-on-surface-variant/70 mt-0.5">
              Personalized market recommendations based on your preferences and saved markets.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sign-in prompt for unauthenticated visitors                       */
/* ------------------------------------------------------------------ */

function SignInPrompt() {
  return (
    <div className="mt-12 text-center">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <LogIn className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-on-surface">Sign in to view your dashboard</h2>
      <p className="text-sm text-on-surface-variant mt-1 max-w-md mx-auto">
        Save markets, set alerts, and get personalized recommendations.
      </p>
      <div className="flex items-center justify-center gap-3 mt-6">
        <Link
          href="/auth/sign-in"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-container text-on-surface rounded-full text-sm font-medium border border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton for initial auth check                           */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="mt-8 space-y-10 animate-pulse">
      <section>
        <div className="h-5 w-32 rounded bg-surface-container-highest mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-container-low rounded-xl border border-outline-variant p-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-surface-container-highest" />
                <div className="h-4 w-32 rounded bg-surface-container-highest" />
              </div>
              <div className="mt-3 h-6 w-12 rounded bg-surface-container-highest" />
              <div className="mt-2 h-3 w-20 rounded bg-surface-container-highest" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="h-5 w-20 rounded bg-surface-container-highest mb-4" />
        <div className="h-20 rounded-xl bg-surface-container-low border border-outline-variant" />
      </section>
      <section>
        <div className="h-5 w-36 rounded bg-surface-container-highest mb-4" />
        <div className="h-20 rounded-xl bg-surface-container-low border border-outline-variant" />
      </section>
    </div>
  );
}
