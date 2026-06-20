"use client";

import type { AnonReportResponse } from "@/lib/data";
import { FinaleScaffold, type SectionKey } from "./FinaleScaffold";

interface Props {
  report: AnonReportResponse;
  marketName: string;
  geographyDescription: string;
  households?: number;
  showWatermark: boolean;
}

/**
 * HomebuyerFinale — the finale a HOMEBUYER sees. Same market data as the agent
 * dossier, but curated for the buy decision: affordability and the price
 * forecast lead (can you afford it, and is your future equity headed up?),
 * followed by how competitive the market is, then the lifestyle/demand context.
 * The hero verdict and the closing strategy are buyer-voiced by the backend
 * persona narrative. No agent "listing / farming / pricing" framing.
 */
const HOMEBUYER_ORDER: SectionKey[] = [
  "exec",
  "aff", // Can you afford it?
  "fc", // Where prices are headed — your equity
  "market", // How competitive is it right now?
  "traj", // 12-month trajectory
  "emp", // Local jobs / economy
  "mig", // Who's moving here
  "peers", // Similar markets to consider
  "val",
  "ai", // Your buying strategy
];

export function HomebuyerFinale({ report, marketName, showWatermark }: Props) {
  return (
    <FinaleScaffold
      report={report}
      marketName={marketName}
      showWatermark={showWatermark}
      order={HOMEBUYER_ORDER}
      eyebrow="PropertyIQ · For Homebuyers"
      reportLabel="Your Homebuyer Briefing"
      aiTitle="Your buying strategy"
      aiSubtitle="PropertyIQ's AI turns the data above into your next moves as a buyer."
    />
  );
}
