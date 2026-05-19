"use client";
import { useState } from "react";
import { ViewPicker, StrategyView } from "./ViewPicker";
import { ThreeStrategyGrid, StrategyCardData } from "./ThreeStrategyGrid";
import { SingleStrategyTab } from "./SingleStrategyTab";
import { WinnerPlusOthers } from "./WinnerPlusOthers";
import {
  BestPlayCallout,
  StrategyScores,
  pickBestPlay,
} from "./BestPlayCallout";
import type { InvestorGoal } from "../../lib/goal-types";
import type { Strategy } from "../../lib/strategy-tile-mappers";

interface StrategyCompareProps {
  scores: StrategyScores;
  cards: StrategyCardData[]; // expected length 3 (B&H, Flip, BRRRR)
  fullViews: {
    buyAndHold: React.ReactNode;
    flip: React.ReactNode;
    brrrr: React.ReactNode;
  };
  summaries: {
    key: "buyAndHold" | "flip" | "brrrr";
    title: string;
    heroLabel: string;
    heroValue: string;
    full: React.ReactNode;
    summary: { label: string; value: string }[];
  }[];
  /** True when the overall deal verdict is at least "marginal" — drives
   *  whether BestPlayCallout celebrates the winner or warns the user. */
  isDealViable?: boolean;
  /** When set, the BestPlayCallout heading reframes to "Best for <goal>". */
  selectedGoal?: InvestorGoal | null;
  /** Goal-aware winner. When set, BestPlayCallout uses it instead of the
   *  deterministic pickBestPlay so the callout agrees with the cards' BEST
   *  badge. The grid-card winner is driven by the parent's bestPlay prop
   *  via buildStrategyCompareProps. "multifamily" is treated as
   *  "no override" because the 3-card compare grid only houses B&H / Flip
   *  / BRRRR. */
  winner?: Strategy;
}

type ResidentialWinner = "buyAndHold" | "flip" | "brrrr";

function asResidentialWinner(
  s: Strategy | undefined,
): ResidentialWinner | null {
  return s === "buyAndHold" || s === "flip" || s === "brrrr" ? s : null;
}

export function StrategyCompare({
  scores,
  cards,
  fullViews,
  summaries,
  isDealViable = true,
  selectedGoal,
  winner,
}: StrategyCompareProps) {
  const [view, setView] = useState<StrategyView>("grid3");
  const narrowedWinner = asResidentialWinner(winner);
  const resolvedWinner: ResidentialWinner =
    narrowedWinner ?? pickBestPlay(scores);

  return (
    <div data-strategy-compare className="space-y-4">
      <BestPlayCallout
        scores={scores}
        isDealViable={isDealViable}
        goal={selectedGoal}
        winnerOverride={narrowedWinner}
      />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
          Compare strategies
        </h3>
        <ViewPicker value={view} onChange={setView} />
      </div>
      <div data-strategy-body data-view={view}>
        {view === "grid3" && <ThreeStrategyGrid strategies={cards} />}
        {view === "tabs" && (
          <SingleStrategyTab
            buyAndHold={fullViews.buyAndHold}
            flip={fullViews.flip}
            brrrr={fullViews.brrrr}
          />
        )}
        {view === "winner" && (
          <WinnerPlusOthers winnerKey={resolvedWinner} strategies={summaries} />
        )}
      </div>
    </div>
  );
}
