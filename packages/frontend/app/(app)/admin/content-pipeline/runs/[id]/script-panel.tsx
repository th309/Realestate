"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { segmentNarration } from "@propertyiq/video-template/narration";
import {
  findScriptVariant,
  type PipelineStatus,
  type RunDetail,
} from "../../lib/content-pipeline-api";
import { computeScriptBudget } from "../../lib/script-budget";
import { useEditScript } from "../../lib/use-run-mutations";
import { ScriptBudgetMeter } from "./script-budget-meter";

/**
 * Stages at which the script can be replaced. Mirrors SCRIPT_EDITABLE_STATES in
 * the backend's run-actions.service.ts — the server is the authority, this list
 * exists so the UI does not offer an action the server will refuse.
 */
const EDITABLE_STATES: ReadonlySet<PipelineStatus> = new Set([
  "scripting",
  "verifying_data",
  "linting_voice",
  "rendering_voice",
  "timing_captions",
  "rendering_video",
  "ready_for_review",
  "failed",
]);

/** Why the script is read-only, in the operator's terms. */
function lockReason(status: PipelineStatus): string {
  if (status === "publishing")
    return "Posting to platforms — too late to edit.";
  if (status === "queued" || status === "fetching_data")
    return "The script hasn't been written yet.";
  return "This run has finished. Start a new one to change the script.";
}

/**
 * The script, editable at every stage where one exists.
 *
 * Previously the run page rendered the script as a read-only `<pre>` and the
 * only editor in the app lived in the review queue, which surfaces
 * `ready_for_review` runs exclusively — so a run that failed on audio length
 * (the one failure that lands in `failed` rather than review) could not be
 * fixed at all.
 *
 * Saving restarts the run at fact-check. That is stated on the button and in the
 * confirmation line rather than being discovered afterward.
 */
export function ScriptPanel({
  runId,
  data,
}: {
  runId: string;
  data: RunDetail;
}) {
  const found = findScriptVariant(data.assets);
  const status = data.run.status;
  const editable = EDITABLE_STATES.has(status);

  const [draft, setDraft] = useState<string | null>(null);
  const editScript = useEditScript();
  const qc = useQueryClient();

  // Raw `fullText`, never the display form: displayScriptText() rewrites
  // {{SHORT_LINK}} to a real URL for reading, and saving that back would
  // destroy the template the publisher depends on.
  const saved = found?.variant.fullText ?? "";
  const text = draft ?? saved;
  const dirty = draft !== null && draft !== saved;

  const budget = useMemo(() => {
    if (!data.scriptBudget || !text.trim()) return null;
    return computeScriptBudget(
      segmentNarration(text),
      data.scriptBudget.naturalWpm,
      data.scriptBudget.capSeconds,
    );
  }, [text, data.scriptBudget]);

  if (!found) {
    return (
      <Section>
        <p className="text-sm text-on-surface-variant">
          The script appears here once it&apos;s written.
        </p>
      </Section>
    );
  }

  function save() {
    // An empty script would pass the DTO's @IsNotEmpty only by accident of
    // whitespace, and restarting a run on a blank script is never intended.
    if (!dirty || !text.trim()) return;
    const saving = text;
    editScript.mutate(
      { id: runId, variantId: found!.variant.variantId, fullText: saving },
      {
        onSuccess: () => {
          // Patch the cached run before dropping the local draft. Invalidation
          // is async, so clearing `draft` first would fall back to the
          // pre-save `fullText` and flash the OLD script for a whole round
          // trip — including through the meter.
          qc.setQueryData<RunDetail>(["content-pipeline-run", runId], (prev) =>
            prev
              ? withScriptText(prev, found!.variant.variantId, saving)
              : prev,
          );
          setDraft(null);
        },
      },
    );
  }

  return (
    <Section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-on-surface">Script</h2>
        {!editable && (
          <p className="text-xs text-on-surface-variant">
            {lockReason(status)}
          </p>
        )}
      </div>

      {budget && data.scriptBudget && (
        <ScriptBudgetMeter
          budget={budget}
          durationSeconds={data.scriptBudget.durationSeconds}
        />
      )}

      <label htmlFor="script-text" className="sr-only">
        Voice-over script
      </label>
      <textarea
        id="script-text"
        value={text}
        readOnly={!editable}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDraft(null);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
        rows={12}
        className="w-full rounded-xl border border-outline-variant bg-surface p-4 font-serif text-base leading-relaxed text-on-surface transition-colors duration-200 read-only:bg-surface-container-low read-only:text-on-surface-variant focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      />

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || editScript.isPending}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {editScript.isPending ? "Saving…" : "Save and restart"}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-full px-4 py-2.5 text-sm font-medium text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high"
            >
              Discard changes
            </button>
          )}
          <p className="text-xs text-on-surface-variant">
            {dirty
              ? "Saving restarts this run at fact-check. Work already in progress is discarded."
              : "Cmd-Enter saves, Esc discards."}
          </p>
        </div>
      )}

      {editable && text.includes("{{SHORT_LINK}}") && (
        <p className="text-xs text-on-surface-variant">
          <code className="rounded bg-surface-container-high px-1 py-0.5 font-mono">
            {"{{SHORT_LINK}}"}
          </code>{" "}
          is a placeholder — keep it. The voice reads it as &ldquo;Property IQ
          dot app&rdquo; and captions show propertyiq.app.
        </p>
      )}
    </Section>
  );
}

/**
 * Cached RunDetail with one script variant's text replaced. Mirrors the server's
 * write in `RunActionsService.editScript`, which maps over `metadata.scripts`
 * and swaps `fullText` on the matching variant, leaving every other field alone.
 */
function withScriptText(
  detail: RunDetail,
  variantId: "A" | "B",
  fullText: string,
): RunDetail {
  return {
    ...detail,
    assets: detail.assets.map((asset) =>
      asset.kind === "script"
        ? {
            ...asset,
            metadata: {
              ...asset.metadata,
              scripts: (asset.metadata.scripts ?? []).map((s) =>
                s.variantId === variantId ? { ...s, fullText } : s,
              ),
            },
          }
        : asset,
    ),
  };
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-sm">
      {children}
    </section>
  );
}
