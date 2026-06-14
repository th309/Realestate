"use client";
import { useEffect, useRef, useState } from "react";
import { useReplaceThumbnail } from "../lib/use-run-mutations";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * "Upload custom" pane of the thumbnail editor. Drag-drop OR click to
 * pick a PNG/JPG ≤5MB. Shows the current auto-generated thumbnail at
 * 50% opacity behind the drop zone when there's no selected file, so
 * the operator can see what they're replacing.
 *
 * Successful upload inserts a `variant='override'` content_assets row;
 * the auto-render path's idempotent delete preserves overrides, so a
 * subsequent regenerate-from-frame won't clobber it.
 */
export function ThumbnailUploadPane({
  runId,
  currentThumbnailUrl,
  onClose,
}: {
  runId: string;
  currentThumbnailUrl: string | null;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceMut = useReplaceThumbnail();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "image/png" && f.type !== "image/jpeg") {
      setError(`Unsupported file type "${f.type}". PNG or JPG only.`);
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError(`File is ${(f.size / 1024 / 1024).toFixed(1)}MB. Max is 5MB.`);
      return;
    }
    setFile(f);
  }

  function handleSubmit() {
    if (!file) return;
    replaceMut.mutate({ id: runId, file }, { onSuccess: () => onClose() });
  }

  return (
    <div className="px-6 py-5 space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-colors duration-200 ${
          file
            ? "border-primary bg-primary-container/30"
            : "border-outline-variant bg-surface-container-low hover:border-primary"
        }`}
        style={{ minHeight: "320px" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected thumbnail preview"
            className="max-h-[55vh] max-w-full mx-auto rounded-xl object-contain my-3"
          />
        ) : currentThumbnailUrl ? (
          <div className="flex flex-col items-center justify-center py-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentThumbnailUrl}
              alt="Current thumbnail"
              className="max-h-48 rounded-xl mb-4 opacity-50"
            />
            <p className="text-sm text-on-surface mb-1">
              Drop a PNG or JPG to replace
            </p>
            <p className="text-xs text-on-surface-variant">
              Or click to browse · 1080×1920 recommended · ≤5MB
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-4xl mb-3 text-on-surface-variant" aria-hidden>
              ⬆
            </div>
            <p className="text-sm text-on-surface mb-1">
              Drop a PNG or JPG here
            </p>
            <p className="text-xs text-on-surface-variant">
              Or click to browse · 1080×1920 recommended · ≤5MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {file && !error && (
        <p className="text-xs text-on-surface-variant">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={replaceMut.isPending}
          className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!file || replaceMut.isPending}
          className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
        >
          {replaceMut.isPending && (
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin"
              aria-hidden
            />
          )}
          Upload
        </button>
      </div>
    </div>
  );
}
