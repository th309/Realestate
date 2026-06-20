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
 * InvestorFinale — the finale a REAL ESTATE INVESTOR sees. Same market data,
 * curated for the investment decision: the current market signals (rent vs
 * price = cash-flow potential) and the appreciation forecast lead, then
 * price-to-rent affordability, comparable markets, and the demand drivers
 * (who's moving in, where the jobs are). The hero verdict and closing strategy
 * are investor-voiced by the backend persona narrative. No agent listing framing.
 */
const INVESTOR_ORDER: SectionKey[] = [
  "exec",
  "market", // Rent vs price — cash-flow signals
  "fc", // Appreciation outlook
  "aff", // Price-to-rent
  "peers", // Comparable markets
  "mig", // Inbound demand
  "emp", // Job-market demand drivers
  "traj", // 12-month trajectory
  "val",
  "ai", // Your investment strategy
];

export function InvestorFinale({ report, marketName, showWatermark }: Props) {
  return (
    <FinaleScaffold
      report={report}
      marketName={marketName}
      showWatermark={showWatermark}
      order={INVESTOR_ORDER}
      eyebrow="PropertyIQ · For Investors"
      reportLabel="Your Investor Briefing"
      aiTitle="Your investment strategy"
      aiSubtitle="PropertyIQ's AI turns the data above into your next moves as an investor."
    />
  );
}
