"use client";

import { useState } from "react";
import { AlertCircle, Copy, Check } from "lucide-react";

interface KeyRevealDialogProps {
  isOpen: boolean;
  onClose: () => void;
  keyValue: string;
}

/**
 * Displays the full API key value exactly once after creation.
 * Includes a copy button, a one-time warning, and a What's Next guide.
 */
export function KeyRevealDialog({
  isOpen,
  onClose,
  keyValue,
}: KeyRevealDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API fallback — silent
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" aria-hidden />

      <div className="relative bg-surface rounded-[28px] shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-medium text-on-surface mb-2">
          API Key Created
        </h2>

        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-950/20 mb-4">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Copy this key now. It will never be shown again. If you lose it,
            you&apos;ll need to create a new one.
          </p>
        </div>

        <div className="relative">
          <pre className="rounded-xl bg-surface-container p-4 text-xs leading-relaxed text-on-surface break-all whitespace-pre-wrap font-mono">
            {keyValue}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Copy API key"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-surface-container-low p-4 space-y-2">
          <p className="text-sm font-medium text-on-surface">
            What&apos;s next?
          </p>
          <div className="space-y-1.5">
            <a
              href="/docs/api#getting-started"
              className="block text-sm text-primary hover:underline"
            >
              1. Verify your key works →
            </a>
            <a
              href="/docs/api#use-cases"
              className="block text-sm text-primary hover:underline"
            >
              2. See what you can build →
            </a>
            <a
              href="/docs/api#reference"
              className="block text-sm text-primary hover:underline"
            >
              3. Full endpoint reference →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
