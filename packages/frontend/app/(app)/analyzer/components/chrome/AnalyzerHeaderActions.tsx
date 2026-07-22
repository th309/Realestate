"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShareButton } from "./ShareButton";
import { PdfButton } from "./PdfButton";
import { ShareAnalysisModal } from "./ShareAnalysisModal";
import {
  downloadAnalysisPdf,
  saveAnalysis,
} from "@/lib/data/fetchers/analyzer";
import { fetchBatchedAiInsights, type AiInsightPayload } from "@/lib/data";
import {
  buildAnalyzerSnapshot,
  type AnalyzerSnapshotDerived,
  type AnalyzerSnapshotExtras,
  type AnalyzerSnapshotState,
} from "../../lib/build-analyzer-snapshot";
import { emitAnalyzerEvent } from "../../lib/analyzer-telemetry";

interface Props {
  /** True if the caller is Pro+ (save endpoint requires Pro). */
  isPro: boolean;
  state: AnalyzerSnapshotState;
  derived: AnalyzerSnapshotDerived;
  /** Rich data captured at save time (projection, sensitivity, grading, etc.). */
  extras?: AnalyzerSnapshotExtras;
  /** AI payload for pre-awaiting batched narratives before save. */
  aiPayload?: AiInsightPayload | null;
  /** Used for the PDF filename and the modal heading. */
  headingLabel: string;
  /**
   * Publishes a "save now" function up to the parent so the NotesSection
   * "Save" button (which lives in a different subtree) can persist the
   * current snapshot — notes included — without re-implementing the save
   * flow. Resolves `true`/`false` so the caller can tell success from a
   * guarded/failed save (e.g. no resolved address) instead of assuming
   * success. Called with `null` on unmount to clear the reference.
   */
  onRegisterSave?: (saveNow: (() => Promise<boolean>) | null) => void;
}

/**
 * Header pills that replace the old Pro/Present/PDF mode toolbar. Owns the
 * share token, save state, and modal state so the parent (`AnalyzerClient`)
 * stays under the React-component line limit. Both buttons funnel through
 * the same auto-save then differ only in what they do with the token: open
 * the modal vs. download the PDF directly.
 *
 * AI narratives are pre-awaited via the batched-insights endpoint before
 * the save call resolves, so the saved snapshot captures real prose
 * instead of "Generating verdict…" placeholders. The batched call is
 * already cached on the analyzer page (24h backend TTL + react-query
 * cache), so this normally short-circuits without a new network call.
 */
export function AnalyzerHeaderActions({
  isPro,
  state,
  derived,
  extras,
  aiPayload,
  headingLabel,
  onRegisterSave,
}: Props) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pdfInProgress, setPdfInProgress] = useState(false);

  // Live refs avoid stale closures + bypass useCallback dep churn from the
  // many fields inside state/derived/extras.
  const stateRef = useRef(state);
  stateRef.current = state;
  const derivedRef = useRef(derived);
  derivedRef.current = derived;
  const extrasRef = useRef<AnalyzerSnapshotExtras | undefined>(extras);
  extrasRef.current = extras;
  const aiPayloadRef = useRef<AiInsightPayload | null | undefined>(aiPayload);
  aiPayloadRef.current = aiPayload;

  // Builds the snapshot (pre-awaiting AI narratives) and persists it, returning
  // the fresh share token. Upserts by (owner, property address) server-side —
  // repeat saves of the same property update the existing row rather than
  // creating a new one. Requires a resolved address: manual/numbers-only
  // analyses (no address entered, RentCast unresolved) have no property to
  // key the save on, so the backend now rejects address_full being blank —
  // guard against that here with a friendly message instead of a raw 400.
  const saveSnapshot = useCallback(async (): Promise<string | null> => {
    if (!derivedRef.current.displayAddress?.trim()) {
      setSaveError(
        "Enter a property address before saving — this analysis has no property to save it against.",
      );
      return null;
    }
    setSaveInProgress(true);
    setSaveError(null);
    try {
      // Pre-await AI narratives so the saved snapshot captures real prose.
      // Failures are non-fatal — we still save without narratives.
      let narratives: AnalyzerSnapshotExtras["aiNarratives"] = undefined;
      const payload = aiPayloadRef.current;
      if (payload) {
        try {
          const batch = await fetchBatchedAiInsights(payload);
          narratives = {
            recommendation_analysis:
              batch?.recommendation_analysis?.text ?? null,
            projection: batch?.projection?.text ?? null,
            expense_waterfall: batch?.expense_waterfall?.text ?? null,
            sensitivity: batch?.sensitivity?.text ?? null,
            comps: batch?.comps?.text ?? null,
            after_tax: batch?.after_tax?.text ?? null,
          };
        } catch {
          // Narratives are best-effort. Snapshot saves regardless.
        }
      }

      const merged: AnalyzerSnapshotExtras = {
        ...(extrasRef.current ?? {}),
        aiNarratives: narratives ?? extrasRef.current?.aiNarratives,
      };
      const result = await saveAnalysis(
        buildAnalyzerSnapshot(stateRef.current, derivedRef.current, merged),
      );
      setShareToken(result.share_token);
      return result.share_token;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to prepare share link";
      setSaveError(msg);
      return null;
    } finally {
      setSaveInProgress(false);
    }
  }, []);

  // Share/PDF reuse an existing token (same link) once one exists.
  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (shareToken) return shareToken;
    return saveSnapshot();
  }, [shareToken, saveSnapshot]);

  // Publish a "save now" handle so the NotesSection Save button (different
  // subtree) can persist the current snapshot — notes included. It always
  // re-saves so freshly typed notes land even after a share link was created.
  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(async () => (await saveSnapshot()) != null);
    return () => onRegisterSave(null);
  }, [onRegisterSave, saveSnapshot]);

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
        // ensureToken()/saveSnapshot() already set saveError (e.g. the
        // no-address guard) — surface it via the modal instead of silently
        // reverting the button with no explanation.
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

  return (
    <>
      <div className="flex items-center gap-2">
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
