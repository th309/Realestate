'use client';

import { LayoutDashboard, MapPin, Bell, TrendingUp, LogIn } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { WatchlistDashboard } from '@/components/watchlist';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import { useAuth } from '@/lib/auth';
import { AlertFeed } from '@/components/alerts';
import { MarketsToWatch } from '@/components/recommendations';
import { useAlertHistory } from '@/lib/alerts/hooks';
import { useMarketsToWatch } from '@/lib/recommendations/hooks';
import { useEntitlements } from '@/lib/entitlements';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

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
  const { entries, unreadCount, isLoading: alertsLoading, markRead } = useAlertHistory();
  const { recommendations, isLoading: recsLoading, hasAccess: hasRecsAccess } = useMarketsToWatch();
  const { tier } = useEntitlements();
  const isPaid = tier === 'pro' || tier === 'enterprise' || tier === 'admin';

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

      {/* Alerts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-on-surface-variant" />
            <h2 className="text-base font-semibold text-on-surface">Alerts</h2>
            {unreadCount > 0 && (
              <span className="text-xs text-on-primary bg-error px-2 py-0.5 rounded-full font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          {isPaid && entries.length > 0 && (
            <Link href="/alerts" className="text-xs text-primary hover:text-primary/80">
              View All
            </Link>
          )}
        </div>
        {!isPaid ? (
          <div className="bg-surface-container-low rounded-xl border border-outline-variant p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-on-surface-variant/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-on-surface-variant">Pro Feature</p>
              <p className="text-xs text-on-surface-variant/70 mt-0.5">
                Set price and score alerts on your saved markets.
              </p>
            </div>
          </div>
        ) : (
          <AlertFeed entries={entries.slice(0, 5)} isLoading={alertsLoading} onMarkRead={markRead} />
        )}
      </section>

      {/* Markets to Watch */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-on-surface-variant" />
          <h2 className="text-base font-semibold text-on-surface">Markets to Watch</h2>
        </div>
        <MarketsToWatch
          recommendations={recommendations}
          isLoading={recsLoading}
          hasAccess={hasRecsAccess}
        />
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
