"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createRun } from "../lib/content-pipeline-api";
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

  // Pre-select the operator's current format default so the wizard reflects
  // whatever they set on Settings. Falls back to 'review' while loading —
  // Settings seed every format to 'review' so the fallback matches reality.
  const { data: settings } = useQuery({
    queryKey: ["content-pipeline-settings"],
    queryFn: fetchSettings,
  });
  const formatDefault = (settings?.formatDefaults ?? []).find(
    (f: { format: string; default_approval_mode?: string }) =>
      f.format === format,
  );
  const defaultMode = (formatDefault?.default_approval_mode ??
    "review") as ApprovalMode;

  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(defaultMode);
  // Once settings load, snap to the true default (state init ran before query
  // resolved). Tracked by a separate state so operator overrides stick.
  const [operatorPicked, setOperatorPicked] = useState(false);
  if (!operatorPicked && formatDefault && approvalMode !== defaultMode) {
    setApprovalMode(defaultMode);
  }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    try {
      const result = await createRun({
        format,
        marketQuery: market,
        idempotencyKey,
        approvalMode,
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
          <li>Write a {meta.duration}-second script with 1 hook variant</li>
          <li>Use the PropertyIQ voice (Edge TTS, free)</li>
          <li>Post to YouTube Shorts</li>
          <li>{outcomeLine}</li>
        </ul>

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
                    setOperatorPicked(true);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-colors duration-200 ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {mode}
                  {mode === defaultMode && !operatorPicked && (
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
