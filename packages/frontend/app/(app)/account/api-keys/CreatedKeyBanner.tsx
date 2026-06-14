"use client";

import { useState } from "react";
import { AlertCircle, X, Copy, Check } from "lucide-react";

interface CreatedKeyBannerProps {
  keyValue: string;
  onDismiss: () => void;
}

/**
 * Shown once after a personal API key is created.
 * Displays the full secret key with a copy button and a one-time warning.
 * Once dismissed, the key can never be retrieved again.
 */
export function CreatedKeyBanner({
  keyValue,
  onDismiss,
}: CreatedKeyBannerProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silent
    }
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20 p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Copy this key now — it will not be shown again. If you lose it,
            create a new one.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Dismiss key banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        <pre className="rounded-xl bg-white dark:bg-surface-container p-4 text-xs leading-relaxed text-on-surface break-all whitespace-pre-wrap font-mono border border-outline-variant/50">
          {keyValue}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Copy API key to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-accent" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {copied && (
        <p className="text-xs text-accent mt-2 font-medium">
          Copied to clipboard!
        </p>
      )}
    </div>
  );
}
