"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAssetSignedUrl,
  displayScriptText,
} from "../lib/content-pipeline-api";
import {
  useApproveRun,
  useRejectRun,
  useDeleteRun,
  useCancelRun,
} from "../lib/use-run-mutations";
import { useQueueNavigator } from "../lib/queue-navigator";
import { useReviewShortcuts } from "./shortcuts";
import { KEYBINDINGS } from "./keybindings";
import { DiffViewer } from "./diff-viewer";
import { ScriptEditor } from "./script-editor";
import { RejectDialog } from "./reject-dialog";
import { ShortcutCheatsheet } from "./shortcut-cheatsheet";
import { ThumbnailEditor } from "./thumbnail-editor";
import { DestructiveDialog } from "../components/destructive-dialog";
import { ActionBar } from "./action-bar";
import { ReviewTabs, type ReviewTab } from "./review-tabs";
import type { PipelineStatus } from "../lib/content-pipeline-api";

const IN_FLIGHT: ReadonlySet<PipelineStatus> = new Set([
  "queued",
  "fetching_data",
  "scripting",
  "verifying_data",
  "linting_voice",
  "rendering_voice",
  "timing_captions",
  "rendering_video",
  "publishing",
]);

export function ReviewCard({ run }: { run: any }) {
  const nav = useQueueNavigator();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [tab, setTab] = useState<ReviewTab>("script");
  const [editingScript, setEditingScript] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingThumbnail, setEditingThumbnail] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const approveMut = useApproveRun();
  const rejectMut = useRejectRun();
  const deleteMut = useDeleteRun();
  const cancelMut = useCancelRun();

  // Reset tab when switching to a different run.
  useEffect(() => setTab("script"), [run.run.id]);

  const status = run.run.status as PipelineStatus;
  const inFlight = IN_FLIGHT.has(status);

  const gateAFail = run.gates?.find(
    (g: any) => g.gate === "data_verifier" && g.result === "failed",
  );
  const gateBFail = run.gates?.find(
    (g: any) => g.gate === "brand_voice_linter" && g.result === "failed",
  );
  const hasGateFails = !!(gateAFail || gateBFail);
  const script = run.assets?.find((a: any) => a.kind === "script")?.metadata
    ?.scripts?.[0];

  const videoAsset = run.assets?.find((a: any) => a.kind === "video_master");
  const { data: videoUrl } = useQuery({
    queryKey: ["content-pipeline-asset-url", run.run.id, "video_master"],
    queryFn: () => fetchAssetSignedUrl(run.run.id, "video_master"),
    enabled: Boolean(videoAsset),
    staleTime: 50 * 60 * 1000,
  });
  const thumbnailAsset = run.assets?.find((a: any) => a.kind === "thumbnail");
  const { data: thumbnailUrl } = useQuery({
    queryKey: ["content-pipeline-asset-url", run.run.id, "thumbnail"],
    queryFn: () => fetchAssetSignedUrl(run.run.id, "thumbnail"),
    enabled: Boolean(thumbnailAsset),
    staleTime: 50 * 60 * 1000,
  });

  // ── action handlers ───────────────────────────────────────────────────
  const handleApprove = () => {
    nav.removeCurrent();
    approveMut.mutate(run.run.id);
  };
  const handleRejectConfirm = async (reason: string) => {
    nav.removeCurrent();
    await rejectMut.mutateAsync({ id: run.run.id, reason });
  };
  const handleDeleteConfirm = async () => {
    nav.removeCurrent();
    if (inFlight) {
      await cancelMut.mutateAsync({
        id: run.run.id,
        reason: "user_cancelled",
      });
    } else {
      await deleteMut.mutateAsync(run.run.id);
    }
  };
  const handleMute = () => {
    setMuted((m) => !m);
    if (videoRef.current) videoRef.current.muted = !muted;
  };
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  };

  useReviewShortcuts({
    onApprove: handleApprove,
    onReject: () => setRejecting(true),
    onEdit: () => setEditingScript(true),
    onThumbnail: () => setEditingThumbnail(true),
    onDelete: () => setDeleting(true),
    onNext: nav.next,
    onPrev: nav.prev,
    onSkip: nav.skip,
    onMute: handleMute,
    onPlayPause: handlePlayPause,
    onCheatsheet: () => setCheatsheetOpen((o) => !o),
  });

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 8rem)" }}>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(360px,40vw)_1fr] gap-6 p-6 pb-24">
        {/* Video pane */}
        <div className="bg-on-surface rounded-2xl overflow-hidden aspect-[9/16] max-h-[78vh] mx-auto w-full">
          {videoAsset && videoUrl?.url ? (
            <video
              ref={videoRef}
              key={videoUrl.url}
              src={videoUrl.url}
              controls
              autoPlay
              muted={muted}
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-error-container/80 text-sm px-6 text-center">
              {videoAsset ? "Loading video…" : "No video rendered"}
            </div>
          )}
        </div>

        {/* Right pane */}
        <div className="rounded-2xl bg-surface-container-low shadow-sm flex flex-col min-h-[60vh]">
          <ReviewTabs
            tab={tab}
            onChange={setTab}
            badges={{ gates: hasGateFails ? "!" : undefined }}
          />
          <div className="flex-1 p-5 overflow-y-auto">
            {tab === "script" && (
              <div className="space-y-3">
                <p className="text-base whitespace-pre-wrap leading-relaxed text-on-surface font-serif">
                  {displayScriptText(script?.fullText)}
                </p>
              </div>
            )}
            {tab === "gates" && (
              <div className="space-y-3">
                {!hasGateFails && (
                  <p className="text-sm text-on-surface-variant">
                    Both gates passed — no flagged claims or brand-voice issues.
                  </p>
                )}
                {gateAFail && (
                  <DiffViewer
                    violations={gateAFail.details?.violations ?? []}
                  />
                )}
                {gateBFail && (
                  <div className="rounded-xl border border-error bg-error/5 p-4">
                    <h4 className="font-medium text-error mb-2 text-sm">
                      Brand voice flagged
                    </h4>
                    <ul className="text-sm space-y-1 text-on-surface">
                      {(gateBFail.details?.violations ?? []).map(
                        (v: any, i: number) => (
                          <li key={i}>
                            &quot;{v.claim?.quote}&quot; ({v.claim?.subject})
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {tab === "thumbnail" && (
              <ThumbnailTab
                thumbnailUrl={thumbnailUrl?.url ?? null}
                onEdit={() => setEditingThumbnail(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <ActionBar
        approving={approveMut.isPending}
        onApprove={handleApprove}
        onEdit={() => setEditingScript(true)}
        onThumbnail={() => setEditingThumbnail(true)}
        onReject={() => setRejecting(true)}
        onSkip={nav.skip}
        onDelete={() => setDeleting(true)}
        onCheatsheet={() => setCheatsheetOpen(true)}
        deleteLabel={inFlight ? "Cancel" : "Delete"}
      />

      {/* Modals */}
      {editingScript && script && (
        <ScriptEditor
          runId={run.run.id}
          variantId={script.variantId}
          initial={script.fullText}
          onClose={() => setEditingScript(false)}
          onSaved={() => {
            setEditingScript(false);
            nav.next();
          }}
        />
      )}
      <RejectDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        onConfirm={handleRejectConfirm}
      />
      <DestructiveDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={handleDeleteConfirm}
        title={
          inFlight
            ? `Cancel "${run.run.market_query}"?`
            : `Delete "${run.run.market_query}"?`
        }
        body={
          inFlight ? (
            <p>
              The pipeline will stop. Any partial assets will be cleaned up. You
              can start over from the dashboard.
            </p>
          ) : status === "published" || status === "published_partial" ? (
            <>
              <p className="mb-2">
                This deletes the run and all its assets from PropertyIQ.
              </p>
              <p className="mb-2">
                <strong>
                  Posts already published to social platforms will REMAIN LIVE.
                </strong>{" "}
                Use each platform&apos;s own tools to take them down.
              </p>
              <p>This cannot be undone.</p>
            </>
          ) : (
            <p>
              This deletes the run and all its assets. This cannot be undone.
            </p>
          )
        }
        confirmLabel={inFlight ? "Cancel run" : "Delete run"}
      />
      <ThumbnailEditor
        open={editingThumbnail}
        onClose={() => setEditingThumbnail(false)}
        runId={run.run.id}
        format={run.run.format}
        videoUrl={videoUrl?.url ?? null}
        currentThumbnailUrl={thumbnailUrl?.url ?? null}
      />
      <ShortcutCheatsheet
        open={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
      />
    </div>
  );
}

function ThumbnailTab({
  thumbnailUrl,
  onEdit,
}: {
  thumbnailUrl: string | null;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-on-surface/95 aspect-[9/16] max-h-[60vh] mx-auto overflow-hidden flex items-center justify-center">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt="Thumbnail preview"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <span className="text-on-error-container/70 text-sm">
            No thumbnail yet
          </span>
        )}
      </div>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onEdit}
          className="px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2 transition-colors duration-200"
        >
          <kbd className="font-mono text-[10px] opacity-80">
            {KEYBINDINGS.thumbnail.display}
          </kbd>
          <span>Edit thumbnail</span>
        </button>
      </div>
    </div>
  );
}
