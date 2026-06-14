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
import { BatchConfirmBanner } from "./batch-confirm-banner";
import { BatchSubmitDialog } from "./batch-submit-dialog";
import type { WizardFormatOptions, WizardMode } from "./page";
import { fetchStyleReferences, type StyleReference } from "../lib/style-refs-api";

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

const PLATFORM_LABELS: Record<string, string> = {
  youtube_shorts: "YouTube Shorts",
  youtube_long: "YouTube (regular)",
  tiktok: "TikTok",
  instagram_reels: "Instagram",
  facebook_reels: "Facebook",
  linkedin: "LinkedIn",
};

/** Short-form destinations (9x16, etc.). */
const SHORT_FORM_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
] as const;

/** Long-form Deep Dive: 16x9 → standard YouTube upload + optional LinkedIn. */
const LONG_FORM_PLATFORMS = ["youtube_long", "linkedin"] as const;

/**
 * Ensures long-form runs target regular YouTube (not Shorts) and allowed
 * platforms only. Migrates mistaken Shorts defaults away.
 */
function sanitizeSelectedForFormat(format: string, platforms: string[]): string[] {
  if (format !== "long_form_deep_dive") return platforms;
  const allowed = new Set<string>(LONG_FORM_PLATFORMS);
  let next = platforms.filter((p) => allowed.has(p));
  if (!next.includes("youtube_long")) {
    next = ["youtube_long", ...next];
  }
  return Array.from(new Set(next));
}

function platformsForConfirmFormat(format: string): readonly string[] {
  if (format === "long_form_deep_dive") return LONG_FORM_PLATFORMS;
  return SHORT_FORM_PLATFORMS;
}

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
  const { data: styleRefs = [] } = useQuery({
    queryKey: ["content-pipeline-style-references"],
    queryFn: fetchStyleReferences,
  });

  const videoRefs = (styleRefs as StyleReference[]).filter(
    (r) => r.kind === "video",
  );

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
  const defaultPlatforms = sanitizeSelectedForFormat(format, rawDefaultPlatforms);

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
  }, [formatDefault?.format, defaultMode, rawDefaultPlatforms.join("|"), format]);

  const [submitting, setSubmitting] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformByKey = new Map<string, PlatformStatus>(
    platforms.map((p) => [p.platform, p]),
  );

  const batchCount = batchMarkets.length;

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
        marketQuery: market,
        idempotencyKey,
        approvalMode,
        selectedPlatforms,
        formatOptions: buildCreateFormatOptions(format, mode, formatOptions),
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
      : `Post to ${selectedPlatforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")}`;

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
      : "Start Run";

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <div className="rounded-xl bg-surface-container-low p-8 shadow-sm">
        {isBatchLike ? (
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

        <PlatformChips
          format={format}
          batchSize={isBatchLike ? batchCount : 1}
          selected={selectedPlatforms}
          defaultPlatforms={defaultPlatforms}
          operatorPicked={operatorPickedPlatforms}
          platformByKey={platformByKey}
          onToggle={togglePlatform}
        />

        <fieldset className="mt-6">
          <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
            Video style reference
          </legend>
          <p className="text-[11px] text-on-surface-variant mb-2">
            Optional. Uses Style Library (kind=video) to pick a render{" "}
            <span className="font-mono">styleVariant</span>.
          </p>
          <select
            value={formatOptions.styleReferenceId ?? ""}
            onChange={(e) => {
              const v = e.target.value || undefined;
              onFormatOptionsChange({ ...formatOptions, styleReferenceId: v });
            }}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          >
            <option value="">None (default)</option>
            {videoRefs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {videoRefs.length === 0 && (
            <p className="text-[11px] text-on-surface-variant mt-2">
              No video references yet. Add one on{" "}
              <a
                href="/admin/content-pipeline/style-references"
                className="text-primary underline"
              >
                Style Library
              </a>
              .
            </p>
          )}
        </fieldset>

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

function PlatformChips({
  format,
  batchSize,
  selected,
  defaultPlatforms,
  operatorPicked,
  platformByKey,
  onToggle,
}: {
  format: string;
  batchSize: number;
  selected: string[];
  defaultPlatforms: string[];
  operatorPicked: boolean;
  platformByKey: Map<string, PlatformStatus>;
  onToggle: (p: string) => void;
}) {
  const platformsShown = platformsForConfirmFormat(format);
  const disconnectedSelected = selected.filter(
    (p) => !platformByKey.get(p)?.configured,
  );
  return (
    <fieldset className="mt-6">
      <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
        Publish {batchSize > 1 ? `all ${batchSize} runs` : ""} to
        {!operatorPicked && (
          <span className="ml-2 normal-case text-[10px] opacity-70">
            (using format defaults — click to override)
          </span>
        )}
      </legend>
      {format === "long_form_deep_dive" && (
        <p className="text-[11px] text-on-surface-variant mb-2">
          Long-form uploads use standard YouTube videos (same Google connection as
          Shorts under Platforms).
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {platformsShown.map((p) => {
          const status = platformByKey.get(p);
          const connected = !!status?.configured;
          const active = selected.includes(p);
          const isDefault = defaultPlatforms.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => connected && onToggle(p)}
              disabled={!connected}
              title={
                connected
                  ? active
                    ? `Click to remove ${PLATFORM_LABELS[p]}`
                    : `Click to add ${PLATFORM_LABELS[p]}`
                  : `${PLATFORM_LABELS[p]} not connected — set up on /platforms first`
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 inline-flex items-center gap-1.5 ${
                !connected
                  ? "bg-surface-container-low text-on-surface-variant border-outline-variant opacity-60 cursor-not-allowed"
                  : active
                    ? "bg-secondary-container text-on-secondary-container border-transparent"
                    : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
              }`}
            >
              {active && connected && (
                <span className="text-[10px]" aria-hidden>
                  ✓
                </span>
              )}
              <span>{PLATFORM_LABELS[p] ?? p}</span>
              {isDefault && !operatorPicked && (
                <span className="text-[9px] opacity-60 font-mono">default</span>
              )}
            </button>
          );
        })}
      </div>
      {disconnectedSelected.length > 0 && (
        <p className="text-[11px] text-error mt-2">
          {disconnectedSelected.map((p) => PLATFORM_LABELS[p]).join(", ")} not
          connected — those publishes will fail. Connect on{" "}
          <a
            href="/admin/content-pipeline/platforms"
            className="text-primary underline"
          >
            Platforms
          </a>{" "}
          or remove them from this run.
        </p>
      )}
    </fieldset>
  );
}
