"use client";
import { useState } from "react";
import { M3Dialog } from "../components/m3-dialog";
import { useKeybindingScopeFrame } from "../lib/queue-navigator";
import { ThumbnailFramePicker } from "./thumbnail-frame-picker";
import { ThumbnailUploadPane } from "./thumbnail-upload-pane";

// Mirror of video-template/src/types.ts FORMAT_CONFIGS — the modal needs
// to know each format's frame count to clamp the scrubber. Inlining
// avoids pulling video-template into the frontend bundle just for two
// numbers per format.
const FORMAT_FRAMES: Record<string, { fps: number; total: number }> = {
  grade_reveal: { fps: 30, total: 900 },
  top_10_ranking: { fps: 30, total: 1800 },
  score_mover: { fps: 30, total: 900 },
  head_to_head: { fps: 30, total: 1800 },
  long_form_deep_dive: { fps: 30, total: 9000 },
  farm_area_spotlight: { fps: 30, total: 1800 },
  brokerage_market_share: { fps: 30, total: 2250 },
  recruitment_angle: { fps: 30, total: 2700 },
};

type Tab = "frame" | "upload";

/**
 * Two-tab modal for editing a run's thumbnail.
 *   Pick a frame   — scrubs the rendered video; submits the chosen frame
 *                    to RenderThumbnailHandler for a fresh Remotion render.
 *   Upload custom  — drag-drop a PNG/JPG that becomes a `variant='override'`
 *                    asset (preserved across regenerates).
 *
 * Pushes a 'modal' keybinding scope frame so the review page's global
 * shortcuts suspend while the editor is open.
 */
export function ThumbnailEditor({
  open,
  onClose,
  runId,
  format,
  videoUrl,
  currentThumbnailUrl,
}: {
  open: boolean;
  onClose: () => void;
  runId: string;
  format: string;
  videoUrl: string | null;
  currentThumbnailUrl: string | null;
}) {
  if (!open) return null;
  return (
    <ThumbnailEditorBody
      onClose={onClose}
      runId={runId}
      format={format}
      videoUrl={videoUrl}
      currentThumbnailUrl={currentThumbnailUrl}
    />
  );
}

function ThumbnailEditorBody({
  onClose,
  runId,
  format,
  videoUrl,
  currentThumbnailUrl,
}: {
  onClose: () => void;
  runId: string;
  format: string;
  videoUrl: string | null;
  currentThumbnailUrl: string | null;
}) {
  useKeybindingScopeFrame("modal");
  const cfg = FORMAT_FRAMES[format] ?? { fps: 30, total: 900 };
  const [tab, setTab] = useState<Tab>("frame");

  return (
    <M3Dialog
      open
      onClose={onClose}
      ariaLabel="Edit thumbnail"
      maxWidth="max-w-4xl"
      closeOnScrim={false}
    >
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="text-xl font-medium text-on-surface">Thumbnail</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-on-surface-variant hover:text-on-surface text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="px-6 pt-4">
        <div
          role="tablist"
          className="flex gap-1 border-b border-outline-variant"
        >
          <SegTab id="frame" tab={tab} onChange={setTab} label="Pick a frame" />
          <SegTab
            id="upload"
            tab={tab}
            onChange={setTab}
            label="Upload custom"
          />
        </div>
      </div>

      {tab === "frame" ? (
        <ThumbnailFramePicker
          runId={runId}
          videoUrl={videoUrl}
          fps={cfg.fps}
          totalFrames={cfg.total}
          onClose={onClose}
        />
      ) : (
        <ThumbnailUploadPane
          runId={runId}
          currentThumbnailUrl={currentThumbnailUrl}
          onClose={onClose}
        />
      )}
    </M3Dialog>
  );
}

function SegTab({
  id,
  tab,
  onChange,
  label,
}: {
  id: Tab;
  tab: Tab;
  onChange: (t: Tab) => void;
  label: string;
}) {
  const active = id === tab;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onChange(id)}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
        active
          ? "text-on-surface"
          : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      {label}
      {active && (
        <span
          className="absolute inset-x-3 bottom-0 h-0.5 bg-primary rounded-full"
          aria-hidden
        />
      )}
    </button>
  );
}
