"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createRun,
  fetchPlatforms,
  type PlatformStatus,
} from "../lib/content-pipeline-api";
import { fetchSettings } from "../lib/settings-api";
import { FORMAT_META } from "../lib/format-previews";

type ApprovalMode = "auto" | "review" | "draft";

const MODE_DESCRIPTIONS: Record<ApprovalMode, string> = {
  auto: "Publish immediately after render. No human check.",
  review:
    "Park in the review queue after render. A human approves before publish.",
  draft:
    "Publish as a platform draft (YouTube private, TikTok draft, etc.). Spot-check before making public.",
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube_shorts: "YouTube Shorts",
  youtube_long: "YouTube",
  tiktok: "TikTok",
  instagram_reels: "Instagram",
  facebook_reels: "Facebook",
  linkedin: "LinkedIn",
};

// Platforms the wizard offers per format. Mirror the Platform type
// order; greyed/disabled when not connected.
const ALL_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
] as const;

export function ConfirmStep({
  format,
  market,
  onBack,
  onCreated,
}: {
  format: string;
  market: string;
  onBack: () => void;
  onCreated: (runId: string) => void;
}) {
  const meta = FORMAT_META[format];
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
  const defaultPlatforms = formatDefault?.default_platforms ?? [];

  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(defaultMode);
  const [operatorPickedMode, setOperatorPickedMode] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] =
    useState<string[]>(defaultPlatforms);
  const [operatorPickedPlatforms, setOperatorPickedPlatforms] = useState(false);

  // Once settings load, snap state to the true defaults if the operator
  // hasn't overridden yet. Without this we'd pin to the initial-render
  // values forever.
  useEffect(() => {
    if (!operatorPickedMode && formatDefault) setApprovalMode(defaultMode);
    if (!operatorPickedPlatforms && formatDefault)
      setSelectedPlatforms(defaultPlatforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatDefault?.format, defaultMode, defaultPlatforms.join("|")]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformByKey = new Map<string, PlatformStatus>(
    platforms.map((p) => [p.platform, p]),
  );

  function togglePlatform(p: string) {
    setOperatorPickedPlatforms(true);
    setSelectedPlatforms((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRun({
        format,
        marketQuery: market,
        idempotencyKey,
        approvalMode,
        selectedPlatforms,
      });
      onCreated(result.id);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
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

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <div className="rounded-xl bg-surface-container-low p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">
          {meta.displayName} for {market}
        </h1>
        <p className="mb-3">We will:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            Write a {meta.duration}-second script ({meta.aspect}) with 1 hook
            variant
          </li>
          <li>Use the PropertyIQ voice (Edge TTS, free)</li>
          <li>{publishLine}</li>
          <li>{outcomeLine}</li>
        </ul>

        <PlatformChips
          format={format}
          selected={selectedPlatforms}
          defaultPlatforms={defaultPlatforms}
          operatorPicked={operatorPickedPlatforms}
          platformByKey={platformByKey}
          onToggle={togglePlatform}
        />

        <fieldset className="mt-6">
          <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
            Approval mode
          </legend>
          <div className="flex gap-2" role="radiogroup">
            {(["auto", "review", "draft"] as ApprovalMode[]).map((mode) => {
              const active = approvalMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setApprovalMode(mode);
                    setOperatorPickedMode(true);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-colors duration-200 ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {mode}
                  {mode === defaultMode && !operatorPickedMode && (
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
          onClick={submit}
          disabled={submitting}
          className="mt-6 bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Start Run"}
        </button>
      </div>
    </div>
  );
}

function PlatformChips({
  format,
  selected,
  defaultPlatforms,
  operatorPicked,
  platformByKey,
  onToggle,
}: {
  format: string;
  selected: string[];
  defaultPlatforms: string[];
  operatorPicked: boolean;
  platformByKey: Map<string, PlatformStatus>;
  onToggle: (p: string) => void;
}) {
  // Identify disconnected platforms in the desired set so we can hint at
  // the gap below the chip row instead of letting the operator pick a
  // platform that'll fail at publish time.
  const disconnectedSelected = selected.filter(
    (p) => !platformByKey.get(p)?.configured,
  );
  void format;
  return (
    <fieldset className="mt-6">
      <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
        Publish to
        {!operatorPicked && (
          <span className="ml-2 normal-case text-[10px] opacity-70">
            (using format defaults — click to override)
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {ALL_PLATFORMS.map((p) => {
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
      {selected.length === 0 && (
        <p className="text-[11px] text-on-surface-variant mt-2">
          No platforms selected — the run will render the video but skip
          publishing. Useful for preview / approval-mode draft testing.
        </p>
      )}
    </fieldset>
  );
}
