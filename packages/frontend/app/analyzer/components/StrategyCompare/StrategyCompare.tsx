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
}

export function StrategyCompare({
  scores,
  cards,
  fullViews,
  summaries,
}: StrategyCompareProps) {
  const [view, setView] = useState<StrategyView>("grid3");
  const winner = pickBestPlay(scores);

  return (
    <div data-strategy-compare className="space-y-4">
      <BestPlayCallout scores={scores} />
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
          <WinnerPlusOthers winnerKey={winner} strategies={summaries} />
        )}
      </div>
    </div>
  );
}
