"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  FileVideo,
  ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";

/**
 * Drag-and-drop asset picker: one file, validated, previewed, uploaded.
 *
 * Generalised out of the org LogoUploader because this repo had grown three
 * near-identical hand-rolled dropzones (org logo, beta-test attachments, the
 * review queue's thumbnail override), each with its own copy of the same
 * dragActive/handleDrop/hidden-input dance and its own idea of how to report
 * a rejected file. Media slots would have been a fourth.
 *
 * Presentational: the caller owns the upload call and its progress, so this
 * works against any endpoint.
 */

export type AssetKind = "image" | "video";

const DEFAULT_ACCEPT: Record<AssetKind, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp"],
  video: ["video/mp4", "video/quicktime"],
};

export interface AssetDropzoneProps {
  kind: AssetKind;
  /** Existing asset to show instead of the empty state. */
  currentUrl?: string | null;
  /** MIME allowlist. Defaults by kind. */
  accept?: string[];
  maxBytes: number;
  /** Shown above the zone. */
  label: string;
  /** Guidance under the zone — dimensions, intent, anything format-specific. */
  helpText?: string;
  /** Marks the slot as needed for the run to render. */
  required?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear?: () => Promise<void> | void;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Why a file was rejected, in words an operator can act on.
 *
 * Exported and pure so the rules are testable without rendering — a
 * dropzone that rejects silently, or blames the wrong thing, is worse than
 * one that does not validate at all.
 */
export function validateAsset(
  file: File,
  accept: string[],
  maxBytes: number,
): string | null {
  if (!accept.includes(file.type)) {
    const friendly = accept
      .map((t) => t.split("/")[1].toUpperCase())
      .join(", ");
    return `That file is ${file.type || "an unknown type"}. Use ${friendly}.`;
  }
  if (file.size > maxBytes) {
    return `That file is ${formatFileSize(file.size)}. The limit is ${formatFileSize(maxBytes)}.`;
  }
  return null;
}

export function AssetDropzone({
  kind,
  currentUrl,
  accept,
  maxBytes,
  label,
  helpText,
  required = false,
  disabled = false,
  uploading = false,
  onUpload,
  onClear,
}: AssetDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);

  const allowed = useMemo(() => accept ?? DEFAULT_ACCEPT[kind], [accept, kind]);

  // Object URLs are a leak if not revoked; tie the lifetime to the file.
  const previewUrl = useMemo(
    () => (pending ? URL.createObjectURL(pending) : null),
    [pending],
  );
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const take = useCallback(
    async (file: File) => {
      const problem = validateAsset(file, allowed, maxBytes);
      if (problem) {
        setError(problem);
        setPending(null);
        return;
      }
      setError(null);
      setPending(file);
      try {
        await onUpload(file);
      } catch (err) {
        // Surface the real reason: a rejected upload the operator cannot
        // explain is the most frustrating possible outcome here.
        setError(err instanceof Error ? err.message : String(err));
        setPending(null);
      }
    },
    [allowed, maxBytes, onUpload],
  );

  const showing = previewUrl ?? currentUrl ?? null;
  const busy = uploading || disabled;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-on-surface">
          {label}
          {required && <span className="ml-1 text-error">*</span>}
        </label>
        {showing && onClear && !busy && (
          <button
            type="button"
            onClick={() => void onClear()}
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-error"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (busy) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void take(file);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={[
          "relative flex min-h-[9rem] cursor-pointer flex-col items-center justify-center gap-2",
          "rounded-xl border-2 border-dashed p-4 text-center transition-colors duration-200",
          dragActive
            ? "border-primary bg-primary-container"
            : "border-outline bg-surface-container-low hover:border-primary",
          busy && "pointer-events-none opacity-60",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showing ? (
          kind === "video" ? (
            <video
              src={showing}
              className="max-h-40 rounded-lg"
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={showing}
              alt={label}
              className="max-h-40 rounded-lg object-contain"
            />
          )
        ) : (
          <>
            {kind === "video" ? (
              <FileVideo className="h-7 w-7 text-on-surface-variant" />
            ) : (
              <ImageIcon className="h-7 w-7 text-on-surface-variant" />
            )}
            <span className="text-sm text-on-surface-variant">
              {uploading
                ? "Uploading…"
                : "Drop a file here, or click to browse"}
            </span>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={allowed.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void take(file);
            // Allow re-selecting the same file after a failure.
            e.target.value = "";
          }}
        />
      </div>

      {helpText && !error && (
        <p className="text-xs text-on-surface-variant">{helpText}</p>
      )}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {showing && !error && (
        <p className="flex items-center gap-1 text-xs text-on-surface-variant">
          <Upload className="h-3 w-3" />
          Drop a new file to replace it
        </p>
      )}
    </div>
  );
}
