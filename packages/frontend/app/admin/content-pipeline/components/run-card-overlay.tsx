"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useDeleteRun,
  useRetryRun,
  useCancelRun,
} from "../lib/use-run-mutations";
import { DestructiveDialog } from "./destructive-dialog";
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

const TERMINAL_LIVE: ReadonlySet<PipelineStatus> = new Set([
  "published",
  "published_partial",
]);

/**
 * Hover overlay for dashboard RunCards. Appears on group-hover with M3
 * scrim + backdrop-blur, exposes Review (if waiting), Retry (if failed),
 * and Delete (always). Stops propagation so clicking an action doesn't
 * also navigate the wrapping <Link>.
 *
 * Delete is state-aware: in-flight → cancel, terminal → hard delete with
 * a destructive confirm that warns about already-published posts staying
 * live on the platforms.
 */
export function RunCardOverlay({
  runId,
  status,
  marketQuery,
}: {
  runId: string;
  status: PipelineStatus;
  marketQuery: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteMut = useDeleteRun();
  const cancelMut = useCancelRun();
  const retryMut = useRetryRun();

  const inFlight = IN_FLIGHT.has(status);
  const isPublishedLive = TERMINAL_LIVE.has(status);
  const showReview = status === "ready_for_review";
  const showRetry = status === "failed";

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleConfirmDestroy() {
    if (inFlight) {
      await cancelMut.mutateAsync({ id: runId, reason: "user_cancelled" });
    } else {
      await deleteMut.mutateAsync(runId);
    }
  }

  return (
    <>
      <div
        className="absolute inset-0 rounded-lg bg-on-surface/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto"
        aria-hidden
      >
        {showReview && (
          <IconButton
            label="Review"
            onClick={(e) => {
              stop(e);
              router.push(`/admin/content-pipeline/review`);
            }}
          >
            <PlayIcon />
          </IconButton>
        )}
        {showRetry && (
          <IconButton
            label="Retry"
            onClick={(e) => {
              stop(e);
              retryMut.mutate(runId);
            }}
          >
            <RetryIcon />
          </IconButton>
        )}
        <IconButton
          label={inFlight ? "Cancel" : "Delete"}
          variant="destructive"
          onClick={(e) => {
            stop(e);
            setConfirmOpen(true);
          }}
        >
          <TrashIcon />
        </IconButton>
      </div>

      <DestructiveDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDestroy}
        title={
          inFlight ? `Cancel "${marketQuery}"?` : `Delete "${marketQuery}"?`
        }
        body={
          inFlight ? (
            <p>
              The pipeline will stop. Any partial assets will be cleaned up. You
              can start over from the dashboard.
            </p>
          ) : isPublishedLive ? (
            <>
              <p className="mb-2">
                This deletes the run and all its assets from PropertyIQ.
              </p>
              <p className="mb-2">
                <strong>
                  Posts already published to TikTok, Instagram, Facebook,
                  LinkedIn, or YouTube will REMAIN LIVE on those platforms.
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
    </>
  );
}

function IconButton({
  label,
  onClick,
  variant = "default",
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
  children: React.ReactNode;
}) {
  const base =
    "w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const palette =
    variant === "destructive"
      ? "bg-error text-on-error hover:bg-error/90"
      : "bg-surface text-on-surface hover:bg-surface-container-high";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${base} ${palette}`}
    >
      {children}
    </button>
  );
}

// ── Inline icons (M3 outlined style, ~20px) ────────────────────────────────
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function RetryIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
