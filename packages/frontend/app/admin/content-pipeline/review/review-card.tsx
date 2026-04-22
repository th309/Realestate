"use client";
import { useRef, useState } from "react";
import { approveRun, rejectRun } from "../lib/content-pipeline-api";
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

  useReviewShortcuts({
    onApprove: async () => {
      await approveRun(run.run.id);
      onNext();
    },
    onApproveSchedule: async () => {
      await approveRun(run.run.id);
      onNext();
    },
    onReject: async () => {
      const reason =
        window.prompt("Why are we rejecting?") ?? "no reason given";
      await rejectRun(run.run.id, reason);
      onNext();
    },
    onNext: onNext,
    onEdit: () => setEditing(true),
    onMute: () => {
      setMuted((m) => !m);
      if (videoRef.current) videoRef.current.muted = !muted;
    },
    onPlayPause: () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    },
  });

  const videoAsset = run.assets?.find((a: any) => a.kind === "video_master");

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="rounded-xl bg-surface-container-low shadow-sm overflow-hidden">
        <div className="aspect-[9/16] bg-black max-h-[60vh] mx-auto">
          {videoAsset && (
            <video
              ref={videoRef}
              src={publicUrl(videoAsset.storage_url)}
              autoPlay
              muted={muted}
              loop
              className="w-full h-full object-contain"
            />
          )}
        </div>

        <div className="p-6">
          <div className="mb-2 text-sm text-outline">{run.run.format}</div>
          <h2 className="text-xl font-semibold mb-4">{run.run.market_query}</h2>
          {gateAFail && (
            <DiffViewer violations={gateAFail.details?.violations ?? []} />
          )}
          {gateBFail && (
            <div className="rounded-xl border border-warning bg-warning/5 p-4 mb-4">
              <h4 className="font-semibold text-warning mb-2">
                Brand voice flagged:
              </h4>
              <ul className="text-sm">
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
            <h4 className="font-semibold mb-2 text-sm">Script</h4>
            <pre className="bg-surface-container rounded-lg p-4 text-sm whitespace-pre-wrap">
              {script?.fullText}
            </pre>
          </div>
        </div>

        <div className="border-t border-outline-variant p-4 flex gap-3 justify-center">
          <kbd className="bg-primary text-on-primary rounded-full px-4 py-2 font-mono text-sm">
            L Approve and Publish
          </kbd>
          <kbd className="bg-surface-container-high rounded-full px-4 py-2 font-mono text-sm">
            E Edit
          </kbd>
          <kbd className="bg-surface-container-high rounded-full px-4 py-2 font-mono text-sm">
            J Reject
          </kbd>
          <kbd className="bg-surface-container-high rounded-full px-4 py-2 font-mono text-sm">
            K Next
          </kbd>
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

function publicUrl(storageUrl: string): string {
  const match = storageUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) return storageUrl;
  const [, bucket, path] = match;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
