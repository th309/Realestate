"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createRun,
  fetchPlatforms,
  type CreateRunFormatOptions,
  type PlatformStatus,
} from "../lib/content-pipeline-api";
import { fetchSettings } from "../lib/settings-api";
import { useCreateBatchRuns, type BatchMarket } from "../lib/batch-runs-api";
import { SingleMarketSummary } from "./single-market-summary";
import { InfographicSummary } from "./infographic-summary";
import { BatchConfirmBanner } from "./batch-confirm-banner";
import { BatchSubmitDialog } from "./batch-submit-dialog";
import type { WizardFormatOptions, WizardMode } from "./page";
import {
  PlatformChips,
  platformLabel,
  sanitizeSelectedForFormat,
} from "./platform-chips";
import { VideoStyleReferenceField } from "./video-style-reference-field";
import type { InfographicRunPlan } from "./helpers/infographic-params";

type ApprovalMode = "auto" | "review" | "draft";

const WINDOW_LABELS: Record<30 | 90 | 180 | 365, string> = {
  30: "1 month",
  90: "90 days",
  180: "6 months",
  365: "12 months",
};

const MODE_DESCRIPTIONS: Record<ApprovalMode, string> = {
  auto: "Publish immediately after render. No human check.",
  review:
    "Park in the review queue after render. A human approves before publish.",
  draft:
    "Publish as a platform draft (YouTube private, TikTok draft, etc.). Spot-check before making public.",
};

const BATCH_DIALOG_THRESHOLD = 50;

function buildCreateFormatOptions(
  format: string,
  mode: WizardMode,
  formatOptions: WizardFormatOptions,
): CreateRunFormatOptions | undefined {
  const out: CreateRunFormatOptions = {};
  if (formatOptions.windowDays != null) {
    out.windowDays = formatOptions.windowDays;
  }
  if (formatOptions.styleReferenceId?.trim()) {
    out.styleReferenceId = formatOptions.styleReferenceId.trim();
  }
  if (
    format === "long_form_deep_dive" &&
    mode === "single" &&
    formatOptions.heroImageOptionId?.trim()
  ) {
    out.heroImageOptionId = formatOptions.heroImageOptionId.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function ConfirmStep({
  format,
  mode,
  market,
  batchMarkets,
  formatOptions,
  onFormatOptionsChange,
  infographicPlan,
  onBack,
  onCreatedSingle,
  onCreatedBatch,
}: {
  format: string;
  mode: WizardMode;
  market: string;
  batchMarkets: BatchMarket[];
  formatOptions: WizardFormatOptions;
  onFormatOptionsChange: (opts: WizardFormatOptions) => void;
  /** Present only for infographic runs — carries the one task and its labels. */
  infographicPlan?: InfographicRunPlan;
  onBack: () => void;
  onCreatedSingle: (runId: string) => void;
  onCreatedBatch: (batchId: string) => void;
}) {
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const { data: settings } = useQuery({
    queryKey: ["content-pipeline-settings"],
    queryFn: fetchSettings,
  });
  const { data: platforms = [] } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
  });

  const formatDefault = (settings?.formatDefaults ?? []).find(
    (f: {
      format: string;
      default_approval_mode?: string;
      default_platforms?: string[];
    }) => f.format === format,
  );
  const defaultMode = (formatDefault?.default_approval_mode ??
    "review") as ApprovalMode;
  const rawDefaultPlatforms = formatDefault?.default_platforms ?? [];
  const defaultPlatforms = sanitizeSelectedForFormat(
    format,
    rawDefaultPlatforms,
  );

  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(defaultMode);
  const [operatorPickedMode, setOperatorPickedMode] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] =
    useState<string[]>(defaultPlatforms);
  const [operatorPickedPlatforms, setOperatorPickedPlatforms] = useState(false);

  useEffect(() => {
    if (!operatorPickedMode && formatDefault) setApprovalMode(defaultMode);
    if (!operatorPickedPlatforms && formatDefault) {
      const raw = formatDefault.default_platforms ?? [];
      setSelectedPlatforms(sanitizeSelectedForFormat(format, raw));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formatDefault?.format,
    defaultMode,
    rawDefaultPlatforms.join("|"),
    format,
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformByKey = new Map<string, PlatformStatus>(
    platforms.map((p) => [p.platform, p]),
  );

  const batchCount = batchMarkets.length;

  // Infographics produce a still graphic reviewed by a human before it goes
  // anywhere, so the video-only controls (destinations, render style) are not
  // part of this run — and nothing is published straight off the render.
  const isInfographic = !!infographicPlan;
  const platformsForRun = isInfographic ? [] : selectedPlatforms;

  function togglePlatform(p: string) {
    setOperatorPickedPlatforms(true);
    setSelectedPlatforms((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  }

  const batchMutation = useCreateBatchRuns();

  async function submitSingle() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRun({
        format,
        marketQuery: infographicPlan?.runLabel ?? market,
        idempotencyKey,
        approvalMode,
        selectedPlatforms: platformsForRun,
        params: infographicPlan?.params,
        formatOptions: isInfographic
          ? undefined
          : buildCreateFormatOptions(format, mode, formatOptions),
      });
      onCreatedSingle(result.id);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  async function submitBatch() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await batchMutation.mutateAsync({
        format,
        markets: batchMarkets,
        approvalMode,
        platforms: selectedPlatforms,
        formatOptions: buildCreateFormatOptions(format, mode, formatOptions),
      });
      onCreatedBatch(result.batchId);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setShowBatchDialog(false);
    }
  }

  // Top movers produces N markets → N videos, same submit pipeline as batch.
  // The picker just changes how the markets list is built; downstream they're
  // identical. Treat top_movers as batch everywhere in this step.
  const isBatchLike = mode === "batch" || mode === "top_movers";

  function handleSubmitClick() {
    if (isBatchLike && batchCount >= BATCH_DIALOG_THRESHOLD) {
      setShowBatchDialog(true);
      return;
    }
    if (isBatchLike) void submitBatch();
    else void submitSingle();
  }

  const outcomeLine =
    approvalMode === "review"
      ? "Queue for your review before publishing"
      : approvalMode === "draft"
        ? "Publish as a platform draft (unlisted)"
        : "Publish immediately after render";

  const publishLine =
    selectedPlatforms.length === 0
      ? "Render only (no platforms selected — useful for previewing)"
      : `Post to ${selectedPlatforms.map(platformLabel).join(", ")}`;

  const windowLine =
    format === "score_mover" && formatOptions.windowDays
      ? `Window: ${WINDOW_LABELS[formatOptions.windowDays]}`
      : null;

  const submitLabel = isBatchLike
    ? batchCount >= BATCH_DIALOG_THRESHOLD
      ? `Review batch (${batchCount} runs)`
      : `Submit ${batchCount} run${batchCount === 1 ? "" : "s"}`
    : submitting
      ? "Creating..."
      : isInfographic
        ? "Generate graphic"
        : "Start Run";

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <div className="rounded-xl bg-surface-container-low p-8 shadow-sm">
        {infographicPlan ? (
          <InfographicSummary
            plan={infographicPlan}
            outcomeLine={outcomeLine}
          />
        ) : isBatchLike ? (
          <BatchConfirmBanner
            format={format}
            markets={batchMarkets}
            onChangeScope={onBack}
          />
        ) : (
          <SingleMarketSummary
            format={format}
            market={market}
            publishLine={publishLine}
            outcomeLine={outcomeLine}
          />
        )}

        {windowLine && (
          <p className="text-xs text-outline mt-2">{windowLine}</p>
        )}

        {!isInfographic && (
          <>
            <PlatformChips
              format={format}
              batchSize={isBatchLike ? batchCount : 1}
              selected={selectedPlatforms}
              defaultPlatforms={defaultPlatforms}
              operatorPicked={operatorPickedPlatforms}
              platformByKey={platformByKey}
              onToggle={togglePlatform}
            />

            <VideoStyleReferenceField
              value={formatOptions.styleReferenceId}
              onChange={(styleReferenceId) =>
                onFormatOptionsChange({ ...formatOptions, styleReferenceId })
              }
            />
          </>
        )}

        <fieldset className="mt-6">
          <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
            Approval mode
            {isBatchLike && ` for all ${batchCount} runs`}
          </legend>
          <div className="flex gap-2" role="radiogroup">
            {(["auto", "review", "draft"] as ApprovalMode[]).map((m) => {
              const active = approvalMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setApprovalMode(m);
                    setOperatorPickedMode(true);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-colors duration-200 ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {m}
                  {m === defaultMode && !operatorPickedMode && (
                    <span className="ml-1 text-[10px] opacity-70">default</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-outline mt-2">
            {MODE_DESCRIPTIONS[approvalMode]}
          </p>
        </fieldset>

        {error && <div className="mt-4 text-error">{error}</div>}
        <button
          onClick={handleSubmitClick}
          disabled={submitting}
          className="mt-6 bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>

      <BatchSubmitDialog
        open={showBatchDialog}
        count={batchCount}
        onCancel={() => setShowBatchDialog(false)}
        onConfirm={submitBatch}
        submitting={submitting}
      />
    </div>
  );
}
