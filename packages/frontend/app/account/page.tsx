"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { User, HelpCircle, Building2 } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { useWatchlist } from "@/components/analytics-assistant/persistence/useWatchlist";
import { useAlerts, useAlertHistory } from "@/lib/alerts/hooks";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SupportTab } from "@/components/account";
import {
  HeroBanner,
  PlanUsageSection,
  PersonalInfoSection,
  PreferencesSection,
  SavedMarketsSection,
  AlertHistorySection,
  RecentReportsSection,
  NotificationsSection,
  AccountSecuritySection,
} from "@/components/account/sections";

// --- Tier badge styling ------------------------------------------------------

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  free: {
    label: "FREE",
    className: "bg-white/20 text-white",
  },
  pro: {
    label: "PRO",
    className: "bg-white text-[#7C3AED]",
  },
  enterprise: {
    label: "ENTERPRISE",
    className: "bg-white text-[#6D28D9]",
  },
  admin: {
    label: "ADMIN",
    className: "bg-red-500 text-white",
  },
};

// --- Loading skeleton --------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-surface-container-highest rounded animate-pulse" />
          <div className="h-8 w-48 bg-surface-container-highest rounded animate-pulse" />
        </div>
        <div className="mt-8 h-32 bg-surface-container-highest rounded-2xl animate-pulse" />
        <div className="mt-6 space-y-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-surface-container-highest rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main page ---------------------------------------------------------------

export default function AccountPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AccountPageContent />
    </Suspense>
  );
}

function AccountPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { tier, trial, loading: entitlementsLoading } = useEntitlements();
  const [isOrgMember, setIsOrgMember] = useState(false);

  // Check if user belongs to an org (billing managed at org level, not personal)
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()
      .then(({ data }: { data: { organization_id: string | null } | null }) => {
        if (data?.organization_id) setIsOrgMember(true);
      });
  }, [user?.id]);

  const tabParam = searchParams.get("tab");

  // Redirect old tab URLs to unified page (except support)
  if (
    tabParam &&
    tabParam !== "support" &&
    ["profile", "subscription", "activity"].includes(tabParam)
  ) {
    router.replace("/account", { scroll: false });
    return <LoadingSkeleton />;
  }

  const showSupport = tabParam === "support";

  if (authLoading || entitlementsLoading) {
    return <LoadingSkeleton />;
  }

  // In dev, create a mock user if no real session exists
  const effectiveUser =
    user ??
    (process.env.NODE_ENV !== "production"
      ? ({
          id: "dev-mock-user",
          email: "dev@propertyiq.app",
          created_at: "2025-06-01T00:00:00Z",
          user_metadata: { display_name: "Dev User" },
          app_metadata: {},
          aud: "authenticated",
        } as any)
      : null);

  if (!effectiveUser) return null;

  const displayName =
    effectiveUser.user_metadata?.display_name || effectiveUser.email || "User";
  const email = effectiveUser.email || "";
  const avatarUrl = effectiveUser.user_metadata?.avatar_url || null;
  const memberSince = effectiveUser.created_at
    ? new Date(effectiveUser.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "";
  const badge = TIER_BADGE[tier] || TIER_BADGE.free;

  // If support tab, show it in isolation
  if (showSupport) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <PageHeaderWithBreadcrumbs
            breadcrumbs={[
              { label: "Account", href: "/account" },
              { label: "Support" },
            ]}
            title="Support"
            icon={<HelpCircle className="w-5 h-5" />}
          />
          <div className="mt-8">
            <SupportTab user={effectiveUser} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: "Account" }]}
          title="Account"
          icon={<User className="w-5 h-5" />}
        />

        <div className="mt-8 space-y-6">
          {/* 1. Hero Banner */}
          <HeroBanner
            displayName={displayName}
            email={email}
            avatarUrl={avatarUrl}
            tierLabel={badge.label}
            tierClassName={badge.className}
            memberSince={memberSince}
          />

          {/* 2. Plan + Usage (hidden for org members — billing is at org level) */}
          {isOrgMember ? (
            <section className="bg-white rounded-xl border border-purple-200/50 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-tertiary" />
                </div>
                <div>
                  <p className="text-base font-semibold text-on-surface">
                    Enterprise Plan
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    Your subscription is managed by your organization. Visit
                    your{" "}
                    <a href="/org" className="text-primary hover:underline">
                      organization settings
                    </a>{" "}
                    to manage billing.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <PlanUsageWrapper user={effectiveUser} tier={tier} trial={trial} />
          )}

          {/* 3. Personal Information */}
          <PersonalInfoSection user={effectiveUser} />

          {/* 4. Preferences */}
          <PreferencesSection user={effectiveUser} />

          {/* 5. Saved Markets */}
          <SavedMarketsWrapper userId={effectiveUser.id} tier={tier} />

          {/* 6. Alerts */}
          <AlertHistoryWrapper tier={tier} />

          {/* 7. Recent Reports */}
          <RecentReportsSection />

          {/* 8. Notifications */}
          <NotificationsSection />

          {/* 9. Account & Security */}
          <AccountSecuritySection user={effectiveUser} />
        </div>
      </div>
    </div>
  );
}

// --- Wrapper components for data fetching ------------------------------------
// These keep the hooks at a stable call position (not conditional).

function PlanUsageWrapper({
  user,
  tier,
  trial,
}: {
  user: any;
  tier: any;
  trial: any;
}) {
  const { items: watchlistItems } = useWatchlist({
    userId: user.id,
    autoLoad: true,
  });
  const { alerts } = useAlerts();

  return (
    <PlanUsageSection
      tier={tier}
      trial={trial}
      watchlistCount={watchlistItems.length}
      alertCount={alerts.length}
    />
  );
}

function SavedMarketsWrapper({ userId, tier }: { userId: string; tier: any }) {
  const { items, isLoading } = useWatchlist({
    userId,
    autoLoad: true,
  });

  return (
    <SavedMarketsSection
      items={items as any}
      isLoading={isLoading}
      tier={tier}
    />
  );
}

function AlertHistoryWrapper({ tier }: { tier: any }) {
  const { entries, isLoading } = useAlertHistory();

  return (
    <AlertHistorySection
      entries={entries as any}
      isLoading={isLoading}
      tier={tier}
    />
  );
}
