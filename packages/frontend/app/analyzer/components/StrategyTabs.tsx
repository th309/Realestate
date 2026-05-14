"use client";

import { useState } from "react";
import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import { formatMetricValue } from "@/lib/data";

interface Props {
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-on-surface-variant">{k}</span>
      <span className="font-mono text-on-surface">{v}</span>
    </div>
  );
}

export default function StrategyTabs({ rental, flip, brrrr }: Props) {
  const [tab, setTab] = useState<"rental" | "flip" | "brrrr">("rental");

  return (
    <div className="rounded-xl bg-surface-container-high p-4">
      <div className="flex gap-2 mb-3">
        {(["rental", "flip", "brrrr"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1 rounded-full text-sm font-medium ${
              tab === t
                ? "bg-primary text-on-primary"
                : "bg-surface text-on-surface-variant border border-outline"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "rental" && (
        <>
          <Row
            k="1% rule"
            v={formatMetricValue(rental.onePctRulePct, "percent_abs")}
          />
          <Row
            k="NOI / yr"
            v={
              rental.noiAnnual == null
                ? "—"
                : formatMetricValue(rental.noiAnnual, "currency")
            }
          />
          <Row
            k="Monthly debt service"
            v={formatMetricValue(rental.monthlyDebtService, "currency")}
          />
          <Row
            k="Total cash in"
            v={formatMetricValue(rental.totalCashInvested, "currency")}
          />
        </>
      )}
      {tab === "flip" &&
        (flip ? (
          <>
            <Row
              k="70% rule MAO"
              v={formatMetricValue(flip.mao70, "currency")}
            />
            <Row
              k="Wholetail max"
              v={formatMetricValue(flip.wholetailMax, "currency")}
            />
            <Row
              k="Projected profit"
              v={formatMetricValue(flip.projectedProfit, "currency")}
            />
            <Row
              k="ROI"
              v={formatMetricValue(flip.projectedRoiPct, "percent")}
            />
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Enter ARV + rehab budget below to see flip metrics.
          </p>
        ))}
      {tab === "brrrr" &&
        (brrrr ? (
          <>
            <Row
              k="BRRRR score"
              v={`${brrrr.score.toFixed(1)} / 10  ${brrrr.rating}`}
            />
            <Row
              k="Refinance cash-out"
              v={formatMetricValue(brrrr.refinanceCashOut, "currency")}
            />
            <Row
              k="Cash left in deal"
              v={formatMetricValue(brrrr.remainingCashInDeal, "currency")}
            />
            <Row
              k="Post-refi cashflow/mo"
              v={formatMetricValue(brrrr.postRefiCashflowMonthly, "currency")}
            />
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Enter ARV + rehab budget to see BRRRR analysis.
          </p>
        ))}
    </div>
  );
}
