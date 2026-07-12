"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { gtagEvent } from "@/lib/analytics/tracker";

const TIER_LABELS: Record<string, string> = {
  enterprise: "Enterprise",
  pro: "Pro",
  free: "Free",
};

function SuccessContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { tier, refresh, loading } = useEntitlements();
  const searchParams = useSearchParams();
  const rawReturn = searchParams.get("returnContext") || "/map";
  const returnContext =
    rawReturn.startsWith("/") && !rawReturn.startsWith("//")
      ? rawReturn
      : "/map";
  const [refreshed, setRefreshed] = useState(false);
  const purchaseFiredRef = useRef(false);
  const sessionId = searchParams.get("session_id");
  const purchaseValue = Number(searchParams.get("value") ?? "0");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/sign-in");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    refresh().then(() => setRefreshed(true));
  }, [refresh]);

  // Fires once per session_id — the useRef guard prevents React StrictMode
  // double-invoke and refresh double-count; transaction_id = session_id gives
  // GA server-side dedup as a backstop.
  useEffect(() => {
    if (purchaseFiredRef.current || !sessionId) return;
    purchaseFiredRef.current = true;
    gtagEvent("purchase", {
      transaction_id: sessionId,
      value: Number.isFinite(purchaseValue) ? purchaseValue : 0,
      currency: "USD",
      items: [{ item_id: tier }],
    });
  }, [sessionId, purchaseValue, tier]);

  // Defense-in-depth: show loading while auth resolves, bail out if unauthenticated
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  const tierLabel = TIER_LABELS[tier] ?? "Pro";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-on-surface mb-2">
          Welcome to {tierLabel}!
        </h1>
        <p className="text-on-surface-variant mb-8">
          Your subscription is active. You now have full access to all{" "}
          {tierLabel} features.
        </p>

        {loading || !refreshed ? (
          <div className="flex items-center justify-center gap-2 text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Activating your account...</span>
          </div>
        ) : (
          <Link
            href={returnContext}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-on-surface-variant" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
