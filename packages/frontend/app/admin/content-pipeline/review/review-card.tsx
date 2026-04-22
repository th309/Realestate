"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  approveRun,
  rejectRun,
  fetchAssetSignedUrl,
} from "../lib/content-pipeline-api";
import { useReviewShortcuts } from "./shortcuts";
import { DiffViewer } from "./diff-viewer";
import { ScriptEditor } from "./script-editor";

export function ReviewCard({ run, onNext }: { run: any; onNext: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [editing, setEditing] = useState(false);

  const gateAFail = run.gates?.find(
    (g: any) => g.gate === "data_verifier" && g.result === "failed",
  );
  const gateBFail = run.gates?.find(
    (g: any) => g.gate === "brand_voice_linter" && g.result === "failed",
  );
  const script = run.assets?.find((a: any) => a.kind === "script")?.metadata
    ?.scripts?.[0];

  const handleApprove = async () => {
    await approveRun(run.run.id);
    onNext();
  };
  const handleReject = async () => {
    const reason = window.prompt("Why are we rejecting?") ?? "no reason given";
    await rejectRun(run.run.id, reason);
    onNext();
  };
  const handleEdit = () => setEditing(true);
  const handleMute = () => {
    setMuted((m) => !m);
    if (videoRef.current) videoRef.current.muted = !muted;
  };
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  useReviewShortcuts({
    onApprove: handleApprove,
    onReject: handleReject,
    onNext: onNext,
    onEdit: handleEdit,
    onMute: handleMute,
    onPlayPause: handlePlayPause,
  });

  const videoAsset = run.assets?.find((a: any) => a.kind === "video_master");
  const { data: videoUrl } = useQuery({
    queryKey: ["content-pipeline-asset-url", run.run.id, "video_master"],
    queryFn: () => fetchAssetSignedUrl(run.run.id, "video_master"),
    enabled: Boolean(videoAsset),
    staleTime: 50 * 60 * 1000,
  });

  return (
    <div className="p-4 max-w-[900px] mx-auto space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">
            {run.run.market_query}
          </h2>
          <div className="text-xs text-outline">
            {run.run.format} · {run.run.status_reason ?? "ready for review"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            className="bg-primary text-on-primary rounded-full px-4 py-1.5 font-mono text-xs hover:opacity-90 transition-opacity"
          >
            <kbd className="font-bold mr-1">L</kbd> Approve
          </button>
          <button
            type="button"
            onClick={handleEdit}
            className="bg-surface-container-high rounded-full px-3 py-1.5 font-mono text-xs hover:bg-surface-container-highest transition-colors"
          >
            <kbd className="font-bold mr-1">E</kbd> Edit
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="bg-surface-container-high rounded-full px-3 py-1.5 font-mono text-xs hover:bg-surface-container-highest transition-colors"
          >
            <kbd className="font-bold mr-1">J</kbd> Reject
          </button>
          <button
            type="button"
            onClick={onNext}
            className="bg-surface-container-high rounded-full px-3 py-1.5 font-mono text-xs hover:bg-surface-container-highest transition-colors"
          >
            <kbd className="font-bold mr-1">K</kbd> Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-4 items-start">
        <div className="bg-black rounded-xl overflow-hidden aspect-[9/16] w-[240px]">
          {videoAsset && videoUrl?.url ? (
            <video
              ref={videoRef}
              src={videoUrl.url}
              controls
              autoPlay
              muted={muted}
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-xs px-3 text-center">
              {videoAsset ? "Loading video…" : "No video rendered"}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-surface-container-low p-4 shadow-sm space-y-3">
          {gateAFail && (
            <DiffViewer violations={gateAFail.details?.violations ?? []} />
          )}
          {gateBFail && (
            <div className="rounded-lg border border-warning bg-warning/5 p-3">
              <h4 className="font-semibold text-warning mb-1 text-xs">
                Brand voice flagged:
              </h4>
              <ul className="text-xs space-y-0.5">
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

          <div>
            <h4 className="font-semibold mb-1 text-xs text-on-surface uppercase tracking-wide">
              Script
            </h4>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-on-surface">
              {script?.fullText ?? "(no script)"}
            </p>
          </div>
        </div>
      </div>

      {editing && script && (
        <ScriptEditor
          runId={run.run.id}
          variantId={script.variantId}
          initial={script.fullText}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onNext();
          }}
        />
      )}
    </div>
  );
}
