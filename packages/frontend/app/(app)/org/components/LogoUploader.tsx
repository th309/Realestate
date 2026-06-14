"use client";

import React, { useRef, useState, useCallback } from "react";
import { Upload, Trash2, ImageIcon, AlertCircle } from "lucide-react";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

interface LogoUploaderProps {
  currentLogoUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  uploading: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop logo upload zone with preview, validation, and removal.
 * Accepts PNG, JPEG, and WebP images up to 2 MB.
 */
export function LogoUploader({
  currentLogoUrl,
  onUpload,
  onDelete,
  uploading,
}: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Invalid file type. Please upload a PNG, JPEG, or WebP image.";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File is too large (${formatFileSize(file.size)}). Maximum size is 2 MB.`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        setSelectedFile(null);
        return;
      }
      setValidationError(null);
      setSelectedFile(file);
    },
    [validateFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedFile, onUpload]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }, [onDelete]);

  const handleClearSelection = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-on-surface tracking-wide">
        Logo
      </label>

      {/* Current logo preview */}
      {currentLogoUrl && !selectedFile && (
        <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-container border border-outline-variant">
          <img
            src={currentLogoUrl}
            alt="Organization logo"
            className="w-16 h-16 object-contain rounded-lg bg-white"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface font-medium">Current logo</p>
          </div>
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
            aria-label="Remove logo"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "Removing..." : "Remove"}
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors
          ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-outline-variant hover:border-primary/50 hover:bg-surface-container"
          }
        `}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload logo — click or drag and drop"
      >
        {selectedFile ? (
          <ImageIcon className="w-8 h-8 text-primary" />
        ) : (
          <Upload className="w-8 h-8 text-on-surface-variant" />
        )}
        <p className="text-sm text-on-surface-variant text-center">
          {selectedFile
            ? "File selected — click Upload below"
            : "Drag and drop an image, or click to browse"}
        </p>
        <p className="text-xs text-on-surface-variant/60">
          PNG, JPEG, or WebP — max 2 MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden
        />
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-400">
            {validationError}
          </p>
        </div>
      )}

      {/* Selected file info + actions */}
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant">
          <ImageIcon className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-on-surface-variant">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleUpload();
            }}
            disabled={uploading}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearSelection();
            }}
            disabled={uploading}
            className="text-xs text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
