"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Copy, Check, Pencil, CheckCircle } from "lucide-react";
import { EmbedPreview } from "../configurator/EmbedPreview";

interface StepGetCodeProps {
  embedUrl: string;
  token: string;
  width: number;
  height: number;
  name: string;
  onNameChange: (name: string) => void;
  onCreateAnother: () => void;
  onDone: () => void;
}

const PRODUCTION_HOST = "https://www.propertyiq.app";

export function StepGetCode({
  embedUrl,
  token,
  width,
  height,
  name,
  onNameChange,
  onCreateAnother,
  onDone,
}: StepGetCodeProps) {
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);

  const separator = embedUrl.includes("?") ? "&" : "?";
  const productionSrc = `${PRODUCTION_HOST}${embedUrl}${separator}token=${token}`;

  const snippet = useMemo(
    () =>
      `<iframe\n  src="${productionSrc}"\n  width="${width}"\n  height="${height}"\n  frameborder="0"\n  style="border-radius: 8px;"\n></iframe>`,
    [productionSrc, width, height],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: user can manually select and copy
    }
  }, [snippet]);

  const handleNameSave = useCallback(() => {
    onNameChange(nameInput.trim() || name);
    setEditingName(false);
  }, [nameInput, name, onNameChange]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Success Header */}
      <div className="flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-500" />
        <h3 className="text-lg font-medium text-on-surface">
          Your embed is ready!
        </h3>
      </div>

      {/* Code Block */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <pre className="p-4 text-sm font-mono text-on-surface overflow-x-auto whitespace-pre">
          {snippet}
        </pre>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              copied
                ? "bg-green-600 text-white"
                : "bg-primary text-on-primary hover:bg-primary/90"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Helper Text */}
      <p className="text-sm text-on-surface-variant text-center">
        Paste this into your website&apos;s HTML where you want the widget to
        appear.
      </p>

      {/* Live Preview */}
      <div className="flex justify-center">
        <EmbedPreview
          embedUrl={embedUrl}
          width={width}
          height={height}
          token={token}
        />
      </div>

      {/* Name (editable) */}
      <div className="flex items-center gap-2 justify-center">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              className="h-9 px-3 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              type="button"
              onClick={handleNameSave}
              className="text-primary hover:text-primary/80"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameInput(name);
              setEditingName(true);
            }}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span>{name}</span>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          type="button"
          onClick={onCreateAnother}
          className="px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors duration-200"
        >
          Create Another
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-5 py-2.5 text-sm font-medium bg-surface-container text-on-surface hover:bg-surface-container-high rounded-xl transition-colors duration-200"
        >
          Done
        </button>
      </div>
    </div>
  );
}
