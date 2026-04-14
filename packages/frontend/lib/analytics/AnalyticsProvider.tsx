"use client";

import { useEffect } from "react";
import { usePageviewTracker } from "./pageview-tracker";
import { useHeartbeat } from "./heartbeat";
import { setUserId, setTrackingExcluded } from "./tracker";
import { useAuth } from "@/lib/auth";

const EXCLUDED_EMAILS = new Set(["troy@propertyiq.app"]);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    setUserId(user?.id ?? null);
    const email = user?.email?.toLowerCase();
    setTrackingExcluded(!!email && EXCLUDED_EMAILS.has(email));
  }, [user?.id, user?.email]);

  usePageviewTracker();
  useHeartbeat();
  return <>{children}</>;
}
