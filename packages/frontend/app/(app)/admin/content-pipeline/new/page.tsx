"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolvePrefill } from "./helpers/prefill";
import {
  FORMAT_PICKER_STEP,
  firstStep,
  previousStep,
  type WizardStepId,
} from "./wizard-steps";
import { FormatStep } from "./format-step";
import { MarketStep } from "./market-step";
import { ConfirmStep } from "./confirm-step";
import { RankingParamsStep } from "./ranking-params-step";
import { RankingPreviewStep } from "./ranking-preview-step";
import { InfographicParamsStep } from "./infographic-params-step";
import {
  INFOGRAPHIC_FORMAT,
  type InfographicRunPlan,
  type InfographicSelection,
} from "./helpers/infographic-params";
import type { BatchMarket } from "../lib/batch-runs-api";
import {
  createRun,
  type RankingRunParams,
  type ResolveRankingResponse,
} from "../lib/content-pipeline-api";
import type { GeoLevel, ScopeType } from "./helpers/ranking-validity";
import type { ScoreMoverGeo, ScoreMoverWindowDays } from "../lib/movers-api";

export type WizardMode = "single" | "batch" | "top_movers";

export interface WizardFormatOptions {
  windowDays?: ScoreMoverWindowDays;
  /** Long-form metro only — passed to render as format_options.heroImageOptionId */
  heroImageOptionId?: string;
  /** Phase 3: Style Library video reference id → render styleVariant selection */
  styleReferenceId?: string;
}

type RankingArgs = {
  metric_id: string;
  geo_level: GeoLevel;
  scope_type: ScopeType;
  scope_id: string | null;
};

const RANKING_FORMATS = new Set(["top_10_ranking", "bottom_10_ranking"]);

/**
 * The prefill helper still speaks the wizard's old step names. Map them onto
 * the manifest's vocabulary here rather than renaming a deep-link contract
 * that other pages ("Make this video") already build URLs against.
 */
const LEGACY_STEP_ALIASES: Record<string, WizardStepId> = {
  market: "market",
  "ranking-params": "params",
  "infographic-params": "params",
};

/**
 * Reads the "Make this video" prefill (`?format=&market=`) and seeds the flow.
 * useSearchParams requires a Suspense boundary in the App Router.
 */
export default function NewRunPage() {
  return (
    <Suspense fallback={null}>
      <NewRunEntry />
    </Suspense>
  );
}

function NewRunEntry() {
  const searchParams = useSearchParams();
  const prefill = resolvePrefill({
    format: searchParams.get("format"),
    market: searchParams.get("market"),
  });
  return <NewRunFlow prefill={prefill} />;
}

function NewRunFlow({
  prefill,
}: {
  prefill: ReturnType<typeof resolvePrefill>;
}) {
  // Step ids come from the format manifest (see wizard-steps), so adding a
  // template no longer means editing this component's branching.
  const [step, setStep] = useState<WizardStepId>(
    prefill.step === "format"
      ? FORMAT_PICKER_STEP
      : (LEGACY_STEP_ALIASES[prefill.step] ?? FORMAT_PICKER_STEP),
  );
  const [format, setFormat] = useState<string>(prefill.format);
  const [mode, setMode] = useState<WizardMode>("single");
  // The confirmed market is only ever set by picking a resolveMarket match; the
  // prefill contributes a search seed, not a verified value.
  const [market, setMarket] = useState<string>("");
  const [batchMarkets, setBatchMarkets] = useState<BatchMarket[]>([]);
  const [formatOptions, setFormatOptions] = useState<WizardFormatOptions>({});
  const [topMoversGeo, setTopMoversGeo] = useState<ScoreMoverGeo>("metro");

  // Ranking-specific state
  const [rankingArgs, setRankingArgs] = useState<RankingArgs | undefined>(
    undefined,
  );
  const [driftError, setDriftError] = useState<string | null>(null);
  const [rankingSubmitting, setRankingSubmitting] = useState(false);

  // Infographic-specific state. The selection is kept so stepping back from
  // confirm returns the operator to their picks, not to an empty step.
  const [infographicSelection, setInfographicSelection] = useState<
    InfographicSelection | undefined
  >(undefined);
  const [infographicPlan, setInfographicPlan] = useState<
    InfographicRunPlan | undefined
  >(undefined);
  const isInfographic = format === INFOGRAPHIC_FORMAT;

  // Stable idempotency key for ranking submissions (regenerated on each preview visit)
  const rankingIdempotencyKey = useMemo(() => crypto.randomUUID(), [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const router = useRouter();

  function handleFormatPick(f: string) {
    setFormat(f);
    // top_movers mode is score_mover-only — fall back to single when leaving
    if (f !== "score_mover" && mode === "top_movers") setMode("single");
    if (f !== "score_mover") {
      setBatchMarkets([]);
      setFormatOptions({});
    }
    if (f !== INFOGRAPHIC_FORMAT) {
      setInfographicSelection(undefined);
      setInfographicPlan(undefined);
    }
    // Where to go next is the manifest's call, not a branch here.
    setStep(firstStep(f));
  }

  async function handleRankingSubmit(resolved: ResolveRankingResponse) {
    if (!rankingArgs) return;
    setDriftError(null);
    setRankingSubmitting(true);

    const rankingParams: RankingRunParams = {
      format: format as "top_10_ranking" | "bottom_10_ranking",
      metric: { id: resolved.metric.id },
      geo_level: resolved.geo_level as "metro" | "county" | "zip",
      scope: {
        type: resolved.scope.type as "national" | "state" | "metro",
        id: resolved.scope.id,
      },
      resolved_markets: resolved.rankings.map((r) => ({
        rank: r.rank,
        region_id: r.region_id,
        region_name: r.region_name,
        state: r.state ?? null,
        value: r.value,
        value_formatted: r.value_formatted,
      })),
    };

    // Build a human-readable market query label for the run record
    const directionLabel =
      resolved.direction === "top" ? "Top 10" : "Bottom 10";
    const marketQuery = `${directionLabel} ${resolved.geo_level}s by ${resolved.metric.label} — ${resolved.scope.label}`;

    try {
      const run = await createRun({
        format,
        marketQuery,
        idempotencyKey: rankingIdempotencyKey,
        rankingParams,
      });
      router.push(`/admin/content-pipeline/runs/${run.id}`);
    } catch (err: unknown) {
      setRankingSubmitting(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("data_drift") ||
        (err as { status?: number }).status === 409
      ) {
        setDriftError(
          "Data shifted while you were reviewing. Refresh the preview and re-submit.",
        );
      } else {
        setDriftError(msg);
      }
    }
  }

  return (
    <div>
      {step === FORMAT_PICKER_STEP && <FormatStep onPick={handleFormatPick} />}

      {step === "market" && (
        <MarketStep
          format={format}
          mode={mode}
          onModeChange={setMode}
          formatOptions={formatOptions}
          onFormatOptionsChange={setFormatOptions}
          topMoversGeo={topMoversGeo}
          onTopMoversGeoChange={setTopMoversGeo}
          initialQuery={prefill.marketSeed}
          onBack={() => setStep(previousStep(format, step))}
          onPickSingle={(m, opts) => {
            setMarket(m);
            if (format === "long_form_deep_dive") {
              if (opts?.heroImageOptionId) {
                setFormatOptions((cur) => ({
                  ...cur,
                  heroImageOptionId: opts.heroImageOptionId,
                }));
              } else {
                setFormatOptions((cur) => {
                  const next = { ...cur };
                  delete next.heroImageOptionId;
                  return next;
                });
              }
            }
            setStep("confirm");
          }}
          onPickBatch={(markets) => {
            setBatchMarkets(markets);
            setStep("confirm");
          }}
          onPickTopMovers={(markets, windowDays) => {
            setBatchMarkets(markets);
            setFormatOptions({ windowDays });
            setStep("confirm");
          }}
        />
      )}

      {step === "params" && isInfographic && (
        <InfographicParamsStep
          initial={infographicSelection}
          onBack={() => setStep(previousStep(format, step))}
          onNext={(selection, plan) => {
            setInfographicSelection(selection);
            setInfographicPlan(plan);
            setStep("confirm");
          }}
        />
      )}

      {step === "confirm" && (
        <ConfirmStep
          format={format}
          mode={mode}
          market={market}
          batchMarkets={batchMarkets}
          formatOptions={formatOptions}
          onFormatOptionsChange={setFormatOptions}
          infographicPlan={isInfographic ? infographicPlan : undefined}
          onBack={() => setStep(previousStep(format, step))}
          onCreatedSingle={(id) =>
            router.push(`/admin/content-pipeline/runs/${id}`)
          }
          onCreatedBatch={(batchId) =>
            router.push(`/admin/content-pipeline?batch=${batchId}`)
          }
        />
      )}

      {step === "params" && RANKING_FORMATS.has(format) && (
        <RankingParamsStep
          format={format as "top_10_ranking" | "bottom_10_ranking"}
          initial={rankingArgs}
          onBack={() => setStep(previousStep(format, step))}
          onNext={(args) => {
            setRankingArgs(args);
            setDriftError(null);
            setStep("preview");
          }}
        />
      )}

      {step === "preview" &&
        rankingArgs &&
        RANKING_FORMATS.has(format) && (
          <div>
            {driftError && (
              <div className="mx-8 mt-4 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container flex items-center justify-between gap-4">
                <span>{driftError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDriftError(null);
                    setStep("params");
                    setTimeout(() => setStep("preview"), 0);
                  }}
                  className="shrink-0 rounded-full border border-current px-3 py-1 text-xs font-semibold"
                >
                  Refresh preview
                </button>
              </div>
            )}
            <RankingPreviewStep
              args={{
                format: format as "top_10_ranking" | "bottom_10_ranking",
                metric_id: rankingArgs.metric_id,
                geo_level: rankingArgs.geo_level,
                scope_type: rankingArgs.scope_type,
                scope_id: rankingArgs.scope_id,
              }}
              onBack={() => {
                setDriftError(null);
                setStep(previousStep(format, step));
              }}
              onSubmit={(resolved) => {
                if (!rankingSubmitting) void handleRankingSubmit(resolved);
              }}
            />
          </div>
        )}
    </div>
  );
}
