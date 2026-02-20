'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { User, CreditCard, Bell, HelpCircle } from 'lucide-react';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements';
import { ProfileTab, SubscriptionTab, ActivityTab, SupportTab } from '@/components/account';

type AccountTab = 'profile' | 'subscription' | 'activity' | 'support';

const TABS: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'subscription', label: 'Subscription', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <Bell className="w-4 h-4" /> },
  { id: 'support', label: 'Support', icon: <HelpCircle className="w-4 h-4" /> },
];

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-on-surface/10 text-on-surface-variant' },
  pro: { label: 'Pro', className: 'bg-primary text-on-primary' },
  enterprise: { label: 'Enterprise', className: 'bg-tertiary text-on-tertiary' },
  admin: { label: 'Admin', className: 'bg-error text-on-error' },
};

function getInitials(displayName?: string | null, email?: string | null): string {
  if (displayName) {
    return displayName.charAt(0).toUpperCase();
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return '?';
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Breadcrumb skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-32 bg-surface-container-highest rounded animate-pulse" />
          <div className="h-8 w-48 bg-surface-container-highest rounded animate-pulse" />
        </div>

        {/* Profile header skeleton */}
        <div className="mt-8 bg-surface-container rounded-xl border border-outline-variant p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-highest animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-40 bg-surface-container-highest rounded animate-pulse" />
              <div className="h-4 w-56 bg-surface-container-highest rounded animate-pulse" />
              <div className="h-4 w-32 bg-surface-container-highest rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="mt-6 flex gap-6 border-b border-outline-variant">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 w-24 bg-surface-container-highest rounded animate-pulse mb-2" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { tier, loading: entitlementsLoading } = useEntitlements();

  const tabParam = searchParams.get('tab') as AccountTab | null;
  const activeTab: AccountTab =
    tabParam && TABS.some(t => t.id === tabParam) ? tabParam : 'profile';

  const handleTabChange = (tab: AccountTab) => {
    router.replace(`/account?tab=${tab}`, { scroll: false });
  };

  if (authLoading || entitlementsLoading) {
    return <LoadingSkeleton />;
  }

  const displayName = user?.user_metadata?.display_name || user?.email || 'User';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = getInitials(user?.user_metadata?.display_name, user?.email);
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const badge = TIER_BADGE[tier] || TIER_BADGE.free;

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Page header with breadcrumbs */}
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Account' }]}
          title="Account"
          icon={<User className="w-5 h-5" />}
        />

        {/* Profile header card */}
        <div className="mt-8 bg-surface-container rounded-xl border border-outline-variant p-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-semibold text-on-primary">{initials}</span>
              </div>
            )}

            {/* Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-on-surface truncate">{displayName}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant truncate">{email}</p>
              {memberSince && (
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Member since {memberSince}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-6 overflow-x-auto -mx-6 px-6">
          <div className="flex gap-1 border-b border-outline-variant min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-primary text-primary font-medium'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {(() => {
          // In dev, create a mock user if no real session exists (for visual testing)
          const effectiveUser = user ?? (process.env.NODE_ENV !== 'production' ? {
            id: 'dev-mock-user',
            email: 'dev@propertyiq.com',
            created_at: '2025-06-01T00:00:00Z',
            user_metadata: { display_name: 'Dev User' },
            app_metadata: {},
            aud: 'authenticated',
          } as any : null);
          if (!effectiveUser) return null;
          return (
            <>
              {activeTab === 'profile' && <ProfileTab user={effectiveUser} />}
              {activeTab === 'subscription' && <SubscriptionTab user={effectiveUser} />}
              {activeTab === 'activity' && <ActivityTab user={effectiveUser} />}
              {activeTab === 'support' && <SupportTab user={effectiveUser} />}
            </>
          );
        })()}
      </div>
    </div>
  );
}
