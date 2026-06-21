"use client";

import type { AnonReportResponse } from "@/lib/data";
import { FinaleScaffold, type SectionKey } from "./finale/FinaleScaffold";

interface Props {
  report: AnonReportResponse;
  marketName: string;
  geographyDescription: string;
  households?: number;
  showWatermark: boolean;
}

/**
 * ListingPresentation — the AGENT finale: the full listing-presentation dossier.
 * It is now a thin configuration of the shared FinaleScaffold (the Homebuyer and
 * Investor finales configure the same scaffold differently). Section order and
 * the default hero / AI-strategy framing match the original agent layout, so the
 * agent experience is unchanged.
 */
const AGENT_ORDER: SectionKey[] = [
  "exec",
  "market",
  "traj",
  "fc",
  "peers",
  "mig",
  "aff",
  "emp",
  "val",
  "ai",
];

export function ListingPresentation({
  report,
  marketName,
  showWatermark,
}: Props) {
  return (
    <FinaleScaffold
      report={report}
      marketName={marketName}
      showWatermark={showWatermark}
      order={AGENT_ORDER}
    />
  );
}
