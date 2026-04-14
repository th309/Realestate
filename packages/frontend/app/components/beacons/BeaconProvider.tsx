"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { dismissBeaconTask } from "@/lib/data";
import { Beacon } from "./Beacon";

interface BeaconDef {
  id: string;
  trigger: string;
  targetSelector: string;
  targetFeature: string;
  tooltip: string;
  href?: string;
}

const BEACON_DEFS: BeaconDef[] = [
  {
    id: "compare-markets",
    trigger: "view_score",
    targetSelector: '[data-beacon="compare-markets"]',
    targetFeature: "compare_markets",
    tooltip: "See how this market stacks up against others",
    href: "/market",
  },
  {
    id: "time-series",
    trigger: "search_market",
    targetSelector: '[data-beacon="time-series"]',
    targetFeature: "time_series",
    tooltip: "Track how this metric has changed over time",
    href: "/graphs",
  },
  {
    id: "share-report",
    trigger: "generate_report",
    targetSelector: '[data-beacon="share-report"]',
    targetFeature: "share_report",
    tooltip: "Share this report with your team or clients",
  },
  {
    id: "market-alerts",
    trigger: "all_complete",
    targetSelector: '[data-beacon="market-alerts"]',
    targetFeature: "market_alerts",
    tooltip: "Get notified when this market moves",
    href: "/alerts",
  },
];

interface BeaconContextValue {
  dismissBeacon: (id: string) => void;
}

const BeaconContext = createContext<BeaconContextValue>({
  dismissBeacon: () => {},
});
export const useBeacons = () => useContext(BeaconContext);

interface BeaconProviderProps {
  children: React.ReactNode;
  completedTasks: string[];
  dismissedBeacons: string[];
}

export function BeaconProvider({
  children,
  completedTasks,
  dismissedBeacons,
}: BeaconProviderProps) {
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(
    new Set(dismissedBeacons),
  );

  const dismissBeacon = useCallback(async (id: string) => {
    setLocalDismissed((prev) => new Set([...prev, id]));
    dismissBeaconTask(id).catch(console.error);
  }, []);

  const completedSet = new Set(completedTasks);
  const allComplete = [
    "create_account",
    "search_market",
    "view_score",
    "compare_markets",
    "generate_report",
  ].every((t) => completedSet.has(t));

  const activeBeacons = BEACON_DEFS.filter((b) => {
    if (localDismissed.has(b.id)) return false;
    if (b.trigger === "all_complete") return allComplete;
    return completedSet.has(b.trigger);
  });

  return (
    <BeaconContext.Provider value={{ dismissBeacon }}>
      {children}
      {activeBeacons.map((b) => (
        <Beacon
          key={b.id}
          id={b.id}
          targetSelector={b.targetSelector}
          targetFeature={b.targetFeature}
          tooltip={b.tooltip}
          href={b.href}
          onDismiss={dismissBeacon}
        />
      ))}
    </BeaconContext.Provider>
  );
}
