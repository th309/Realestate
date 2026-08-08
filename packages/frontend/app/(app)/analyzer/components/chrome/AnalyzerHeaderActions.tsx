"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShareButton } from "./ShareButton";
import { PdfButton } from "./PdfButton";
import { SaveButton } from "./SaveButton";
import { ShareAnalysisModal } from "./ShareAnalysisModal";
import {
  downloadAnalysisPdf,
  saveDealState,
  publishAnalysis,
} from "@/lib/data/fetchers/analyzer";
import type { AiInsightPayload } from "@/lib/data";
import {
  buildDealStatePayload,
  buildPublishedArtifact,
  type AnalyzerSnapshotDerived,
  type AnalyzerSnapshotExtras,
  type AnalyzerSnapshotState,
} from "../../lib/build-analyzer-snapshot";
import { preAwaitAiNarratives } from "../../lib/pre-await-ai-narratives";
import { emitAnalyzerEvent } from "../../lib/analyzer-telemetry";
import { SAVED_ANALYSES_QUERY_KEY } from "../SavedAnalysesPanel";
import type { DealStateV2 } from "../../lib/deal-state-types";
import type { SaveStatus } from "../../lib/use-deal-autosave";

interface Props {
  /** True if the caller is Pro+ (save endpoint requires Pro). */
  isPro: boolean;
  state: AnalyzerSnapshotState;
  derived: AnalyzerSnapshotDerived;
  /**
   * The deal's complete resumable state — what lands in `input_snapshot`.
   * Built once by `useCurrentDealState` so the explicit-save paths here and
   * the debounced autosave write byte-identical state. Carries the deal's
   * `label`, which is why there is no separate label prop.
   */
  dealState: DealStateV2;
  /** Rich data captured at Share time (projection, sensitivity, grading, …). */
  extras?: AnalyzerSnapshotExtras;
  /** AI payload for pre-awaiting batched narratives before PUBLISHING. */
  aiPayload?: AiInsightPayload | null;
  /** Used for the PDF filename and the modal heading. */
  headingLabel: string;
  /**
   * Publishes a "save now" function up to the parent so the NotesSection
   * "Save" button (which lives in a different subtree) can persist the
   * current deal state — notes included — without re-implementing the save
   * flow. Resolves `true`/`false` so the caller can tell success from a
   * guarded/failed save (e.g. no resolved address) instead of assuming
   * success. Called with `null` on unmount to clear the reference.
   *
   * Notes ride in `DealStateV2`, so this is a state save, not a publish: a
   * note edited after sharing does not rewrite the link's frozen artifact.
   */
  onRegisterSave?: (saveNow: (() => Promise<boolean>) | null) => void;
  /**
   * Existing saved-deal id, once one exists. Determines whether the Save
   * button reads "Save deal" (first save) or "Saved" (re-save), whether the
   * write creates or updates the row, and — because only the creating save
   * captures `market_context` — which columns it may touch.
   */
  dealId?: string | null;
  /**
   * Debounced-autosave status (`useDealAutosave`), threaded down so the
   * Save button can report it.
   */
  saveStatus?: SaveStatus;
  /**
   * Explicit Save-button click handler. Defaults to the deal-state save
   * below; `AnalyzerClient` supplies autosave's retry when it has errored.
   */
  onSaveClick?: () => void;
  /**
   * Fires with the saved row's id after a successful write, so the parent
   * can capture it and enable autosave for a previously-unsaved deal.
   */
  onSaved?: (dealId: string) => void;
}

/**
 * Header pills that replace the old Pro/Present/PDF mode toolbar. Owns the
 * share token, save state, and modal state so the parent (`AnalyzerClient`)
 * stays under the React-component line limit.
 *
 * The three buttons split across TWO write paths, and the split is the
 * point (spec §4.2):
 *
 * - **Save** (and the Notes "Save") → `persistDealState`. Writes
 *   `input_snapshot` and the identity columns. Never touches
 *   `result_snapshot`, and never fires an LLM call — `DealStatePayload` has
 *   no field for a narrative to go in.
 * - **Share / PDF** → `publish`. Writes the frozen render artifact as well,
 *   pre-awaiting the batched AI narratives so the artifact captures real
 *   prose instead of "Generating verdict…" placeholders. That batched call
 *   is already cached on the analyzer page (24h backend TTL + react-query),
 *   so it normally short-circuits without a new network call.
 */
export function AnalyzerHeaderActions({
  isPro,
  state,
  derived,
  dealState,
  extras,
  aiPayload,
  headingLabel,
  onRegisterSave,
  dealId = null,
  saveStatus = "idle",
  onSaveClick,
  onSaved,
}: Props) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pdfInProgress, setPdfInProgress] = useState(false);
  const queryClient = useQueryClient();

  // Live refs avoid stale closures + bypass useCallback dep churn from the
  // many fields inside state/derived/extras/dealState.
  const stateRef = useRef(state);
  stateRef.current = state;
  const derivedRef = useRef(derived);
  derivedRef.current = derived;
  const dealStateRef = useRef(dealState);
  dealStateRef.current = dealState;
  const extrasRef = useRef<AnalyzerSnapshotExtras | undefined>(extras);
  extrasRef.current = extras;
  const aiPayloadRef = useRef<AiInsightPayload | null | undefined>(aiPayload);
  aiPayloadRef.current = aiPayload;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const dealIdRef = useRef(dealId);
  dealIdRef.current = dealId;

  /**
   * Shared shell for both write paths: the address guard, the in-progress
   * flag, error surfacing, and the post-write bookkeeping. `write` decides
   * WHAT is persisted; this decides how persisting behaves.
   *
   * Requires a resolved address: manual/numbers-only analyses (no address
   * entered, RentCast unresolved) have no property to key the save on, so
   * the backend rejects a blank `address_full` — guard against that here
   * with a friendly message instead of a raw 400.
   */
  const runWrite = useCallback(
    async (
      write: () => Promise<{ id: string; share_token: string }>,
    ): Promise<{ id: string; share_token: string } | null> => {
      if (!derivedRef.current.displayAddress?.trim()) {
        setSaveError(
          "Enter a property address before saving — this analysis has no property to save it against.",
        );
        return null;
      }
      setSaveInProgress(true);
      setSaveError(null);
      try {
        const result = await write();
        // Refresh the "Saved analyses" panel so a re-save (which updates the
        // same row rather than inserting a new one) or a brand-new save shows
        // up without a page reload.
        queryClient.invalidateQueries({ queryKey: SAVED_ANALYSES_QUERY_KEY });
        // Lets the parent capture the row id — e.g. to enable autosave for a
        // deal that previously had none.
        onSavedRef.current?.(result.id);
        return result;
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Failed to save this analysis",
        );
        return null;
      } finally {
        setSaveInProgress(false);
      }
    },
    [queryClient],
  );

  // Save / Notes-Save. Deal state only — cannot reach `result_snapshot`.
  const persistDealState = useCallback(async (): Promise<boolean> => {
    const result = await runWrite(() =>
      saveDealState(
        buildDealStatePayload(
          dealStateRef.current,
          stateRef.current,
          derivedRef.current,
          { id: dealIdRef.current ?? undefined },
        ),
      ),
    );
    return result != null;
  }, [runWrite]);

  // Share / PDF. Publishes the frozen render artifact and yields the token.
  const publish = useCallback(async (): Promise<string | null> => {
    const result = await runWrite(async () => {
      const merged = await preAwaitAiNarratives(
        extrasRef.current,
        aiPayloadRef.current,
      );
      return publishAnalysis(
        buildPublishedArtifact(
          dealStateRef.current,
          stateRef.current,
          derivedRef.current,
          merged,
          { id: dealIdRef.current ?? undefined },
        ),
      );
    });
    if (result) setShareToken(result.share_token);
    return result?.share_token ?? null;
  }, [runWrite]);

  // Share/PDF reuse an existing token (same link) once one exists.
  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (shareToken) return shareToken;
    return publish();
  }, [shareToken, publish]);

  // Publish a "save now" handle so the NotesSection Save button (different
  // subtree) can persist the current deal state — notes included.
  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(persistDealState);
    return () => onRegisterSave(null);
  }, [onRegisterSave, persistDealState]);

  const handleShareClick = useCallback(async () => {
    emitAnalyzerEvent("analyzer_share_button_clicked", { is_signed_in: isPro });
    if (!isPro) {
      emitAnalyzerEvent("analyzer_share_anonymous_signin_prompt_shown");
      setSaveError("Sign in with a Pro account to share this analysis.");
      setModalOpen(true);
      return;
    }
    setModalOpen(true);
    await ensureToken();
  }, [isPro, ensureToken]);

  const handlePdfClick = useCallback(async () => {
    emitAnalyzerEvent("analyzer_pdf_button_clicked", { is_signed_in: isPro });
    if (!isPro) {
      emitAnalyzerEvent("analyzer_share_anonymous_signin_prompt_shown");
      setSaveError("Sign in with a Pro account to download the PDF.");
      setModalOpen(true);
      return;
    }
    setPdfInProgress(true);
    try {
      const token = await ensureToken();
      if (!token) {
        // ensureToken()/publish() already set saveError (e.g. the no-address
        // guard) — surface it via the modal instead of silently reverting
        // the button with no explanation.
        setModalOpen(true);
        return;
      }
      const blob = await downloadAnalysisPdf(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DealAnalysis-${headingLabel.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      emitAnalyzerEvent("analyzer_pdf_downloaded", { token, from: "toolbar" });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "PDF render failed");
      setModalOpen(true);
    } finally {
      setPdfInProgress(false);
    }
  }, [isPro, ensureToken, headingLabel]);

  // `onSaveClick` is autosave's retry, supplied by the parent only while
  // autosave is in its error state. Otherwise Save is a plain state save.
  const handleSaveClick = useCallback(() => {
    if (onSaveClick) {
      onSaveClick();
      return;
    }
    void persistDealState();
  }, [onSaveClick, persistDealState]);

  return (
    <>
      <div className="flex items-center gap-2">
        <SaveButton
          status={saveStatus}
          hasRow={Boolean(dealId)}
          canSave={isPro}
          onClick={handleSaveClick}
        />
        <PdfButton onClick={handlePdfClick} loading={pdfInProgress} />
        <ShareButton onClick={handleShareClick} />
      </div>
      <ShareAnalysisModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        shareToken={shareToken}
        saveInProgress={saveInProgress}
        saveError={saveError}
        headingLabel={headingLabel}
      />
    </>
  );
}
