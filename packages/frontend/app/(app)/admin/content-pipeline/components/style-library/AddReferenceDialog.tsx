"use client";

import { useState } from "react";
import { M3Dialog } from "../m3-dialog";

const KIND_OPTIONS = ["thumbnail", "video", "pdf", "general"] as const;
type ReferenceKind = (typeof KIND_OPTIONS)[number];

/**
 * Add a reference by image URL, video URL, or video upload. The "video" kind
 * routes to the dedicated ingest endpoints, which sample frames before running
 * Vision analysis.
 */
export function AddReferenceDialog({
  open,
  onClose,
  onSubmit,
  onIngestVideoUrl,
  onUploadVideo,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: {
    label: string;
    kind: ReferenceKind;
    source_url: string;
  }) => Promise<unknown>;
  onIngestVideoUrl: (body: { label: string; url: string }) => Promise<unknown>;
  onUploadVideo: (body: { label: string; file: File }) => Promise<unknown>;
  busy: boolean;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ReferenceKind>("thumbnail");
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  return (
    <M3Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      ariaLabel="Add reference"
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label.trim()) return;

          if (kind === "video") {
            if (tab === "url") {
              if (!url.trim()) return;
              await onIngestVideoUrl({ label: label.trim(), url: url.trim() });
            } else {
              if (!file) return;
              await onUploadVideo({ label: label.trim(), file });
            }
          } else {
            if (!url.trim()) return;
            await onSubmit({
              label: label.trim(),
              kind,
              source_url: url.trim(),
            });
          }
          setLabel("");
          setUrl("");
          setFile(null);
        }}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-medium text-on-surface">
            Add a reference
          </h2>
          <Field label="Label">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Doom-Data Alarm (Graham Stephan thumbnail)"
              required
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Kind">
            <div className="flex gap-2">
              {KIND_OPTIONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${
                    kind === k
                      ? "bg-secondary-container text-on-secondary-container border-transparent"
                      : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </Field>
          {kind === "video" ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab("url")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${
                    tab === "url"
                      ? "bg-secondary-container text-on-secondary-container border-transparent"
                      : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
                  }`}
                >
                  Video URL
                </button>
                <button
                  type="button"
                  onClick={() => setTab("upload")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${
                    tab === "upload"
                      ? "bg-secondary-container text-on-secondary-container border-transparent"
                      : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
                  }`}
                >
                  Upload file
                </button>
              </div>
              {tab === "url" ? (
                <Field label="Video URL">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://… (YouTube/TikTok/IG/FB/X)"
                    required
                    className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </Field>
              ) : (
                <Field label="Video file">
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    required
                    className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </Field>
              )}
            </div>
          ) : (
            <Field label="Image URL">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://… (PNG/JPG)"
                required
                className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </Field>
          )}
          <p className="text-[11px] text-on-surface-variant">
            {kind === "video"
              ? "Video ingest downloads/samples frames and runs Vision analysis. This can take a bit longer than image references."
              : "Vision extraction runs synchronously on submit (~1 second). The extracted palette appears on the card right after."}
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              busy ||
              !label.trim() ||
              (kind === "video"
                ? tab === "url"
                  ? !url.trim()
                  : !file
                : !url.trim())
            }
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
          >
            {busy && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin"
                aria-hidden
              />
            )}
            Add + extract
          </button>
        </div>
      </form>
    </M3Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
