"use client";

import { usePageviewTracker } from "./pageview-tracker";
import { useHeartbeat } from "./heartbeat";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  usePageviewTracker();
  useHeartbeat();
  return <>{children}</>;
}
