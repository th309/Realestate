import { Target } from "lucide-react";
import {
  getScoreLabel,
  getScoreMomentumArrow,
} from "@/app/components/scoring/score-labels";
import { ABBREV_TO_STATE } from "@/lib/data/state-slug-data";
import type { HeroMarket } from "@/lib/data";

/**
 * The hero's product illustration — a monitor showing the Score surface.
 *
 * It replaces a screenshot on purpose. Every asset in `public/images/home/`
 * predates the single-PropertyIQ-Score migration and still shows retired score
 * names and banned quality labels, so none may sit above the fold (CLAUDE.md
 * section 9). This is drawn from live scored data instead, which also means it
 * can never go stale the way a PNG does.
 *
 * The tab strip and the pagination dots are decoration — a drawing of chrome,
 * not chrome. They are `aria-hidden` and are not buttons, because a control
 * that looks interactive and is not is worse than no control. The numbers are
 * real content and stay in the accessibility tree.
 */

/** Bands match the score labels in CLAUDE.md section 9, so the bar colour and
 *  the momentum word can never disagree. */
function barTone(score: number): string {
  if (score >= 60) return "bg-tertiary";
  if (score >= 40) return "bg-warning";
  return "bg-error";
}

const SURFACE_TABS = [
  "Market Score",
  "Interactive Map",
  "AI Report",
  "Forecast",
  "Screener",
  "Comparison",
  "ZIP Drill-Down",
];

/** "Buffalo, NY" -> "New York". Falls back to the bare abbreviation. */
function stateNameOf(marketName: string): string | null {
  const abbrev = marketName.split(",").pop()?.trim();
  if (!abbrev) return null;
  return ABBREV_TO_STATE.get(abbrev)?.name ?? abbrev;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant p-2">
      <span className="block text-[8px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
        {label}
      </span>
      <span className="mt-0.5 block font-mono text-[15px] font-semibold tabular-nums text-on-surface">
        {value}
      </span>
    </div>
  );
}

function LeaderRow({ market }: { market: HeroMarket }) {
  return (
    <li className="flex items-center gap-2 text-[11px]">
      <span className="w-[88px] shrink-0 truncate text-on-surface-variant">
        {market.name}
      </span>
      <span className="h-[5px] flex-1 rounded-full bg-outline-variant">
        <span
          className={`block h-full rounded-full ${barTone(market.score)}`}
          style={{ width: `${market.score}%` }}
        />
      </span>
      <span className="w-5 text-right font-mono text-[11px] font-semibold tabular-nums text-on-surface">
        {market.score}
      </span>
    </li>
  );
}

export function HeroMonitor({
  market,
  leaderboard,
}: {
  market: HeroMarket;
  leaderboard: HeroMarket[];
}) {
  const state = stateNameOf(market.name);
  const momentum = `${getScoreLabel(market.score)} ${getScoreMomentumArrow(market.score)}`;

  return (
    <figure className="m-0 flex flex-col items-center">
      <div className="w-full rounded-2xl border border-outline-variant bg-surface p-2.5 shadow-lg">
        <div className="relative overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div
            aria-hidden
            className="flex flex-wrap gap-1 border-b border-outline-variant bg-primary-container px-2.5 py-2"
          >
            {SURFACE_TABS.map((tab, i) => (
              <span
                key={tab}
                className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold ${
                  i === 0
                    ? "bg-surface text-primary shadow-sm"
                    : "text-on-surface-variant"
                }`}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-3 p-3.5 pb-12">
            <div className="flex items-center gap-3.5 rounded-lg bg-primary-container px-3.5 py-3">
              <span className="font-mono text-[38px] font-bold leading-none tabular-nums text-tertiary-text">
                {market.score}
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                  Strongest outlook
                </span>
                <span className="block text-[15px] font-bold text-on-surface">
                  {market.name}
                </span>
                <span className="block text-[11px] text-on-surface-variant">
                  {momentum} · Confidence {market.confidenceLevel}
                  {state ? ` · vs ${state}` : ""}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Kpi
                label="ZHVI 12 mo"
                value={
                  market.valueYoyPct == null
                    ? "—"
                    : `${market.valueYoyPct > 0 ? "+" : ""}${market.valueYoyPct}%`
                }
              />
              <Kpi
                label="Score 3 mo"
                value={`${market.delta > 0 ? "+" : ""}${market.delta}`}
              />
              <Kpi
                label="Days on mkt"
                value={market.dom == null ? "—" : String(market.dom)}
              />
              <Kpi
                label="Price cuts"
                value={
                  market.priceCutPct == null ? "—" : `${market.priceCutPct}%`
                }
              />
            </div>

            <ul className="flex list-none flex-col gap-1.5 p-0">
              {leaderboard.map((m) => (
                <LeaderRow key={m.cbsa} market={m} />
              ))}
            </ul>
          </div>

          {/* Fixed black, not `inverse-surface` — this scrim must stay dark in
              BOTH schemes because the caption on it is always white. An
              inverting token here is what made the map showcase unreadable. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 py-2.5">
            <span className="flex items-center gap-2 text-[12.5px] font-semibold text-white">
              <span className="grid size-[18px] place-items-center rounded-md bg-primary text-on-primary">
                <Target className="size-3" strokeWidth={2} />
              </span>
              PropertyIQ Score
            </span>
            <span aria-hidden className="flex gap-1">
              {SURFACE_TABS.map((tab, i) => (
                <span
                  key={tab}
                  className={`h-[5px] rounded-full ${i === 0 ? "w-3.5 bg-white" : "w-[5px] bg-white/40"}`}
                />
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* Monitor stand. Purely a drawing — it is what makes the panel read as a
          screen rather than a floating card. */}
      <span aria-hidden className="h-6 w-[74px] bg-surface-dim" />
      <span
        aria-hidden
        className="h-[7px] w-[210px] rounded-b-lg bg-surface-dim"
      />

      <figcaption className="sr-only">
        The PropertyIQ Score surface for {market.name}, scoring {market.score},
        with the strongest-scoring markets ranked beneath it.
      </figcaption>
    </figure>
  );
}
