"use client";

import React, { useState, useCallback } from "react";
import {
  Key,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  LogIn,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createUserApiKey } from "@/lib/data";
import { Warning } from "./setup-helpers";

interface GenerateApiKeyStepProps {
  onKeyGenerated: (key: string) => void;
}

/**
 * Step 3 of the MCP setup flow — generate a personal API key inline.
 *
 * States: not logged in → sign-in CTA, logged in → generate button,
 * generated → key display with copy + one-time warning.
 */
export function GenerateApiKeyStep({
  onKeyGenerated,
}: GenerateApiKeyStepProps) {
  const { user } = useAuth();
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createUserApiKey({
        name: "MCP Server",
        scopes: [
          "scores:read",
          "metrics:read",
          "rankings:read",
          "reports:read",
          "watchlist:read",
        ],
      });
      if (result.key) {
        setGeneratedKey(result.key);
        onKeyGenerated(result.key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }, [onKeyGenerated]);

  const handleCopy = useCallback(async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }, [generatedKey]);

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-6 text-center">
        <LogIn className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
        <p className="text-base font-medium text-on-surface">
          Sign in to generate your API key
        </p>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
          You need a Pro or Enterprise account to use the MCP server.
        </p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <a
            href="/auth/sign-in?next=/docs/mcp"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Sign In
          </a>
          <a
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View Plans
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // ── Key already generated ──
  if (generatedKey) {
    return (
      <div className="space-y-4">
        <Warning>
          <strong>Copy this key now — it will not be shown again.</strong> If
          you lose it, you can generate a new one from your{" "}
          <a
            href="/account/api-keys"
            className="text-primary hover:underline font-medium"
          >
            account settings
          </a>
          .
        </Warning>

        <div className="relative rounded-xl bg-surface-container border border-outline-variant/50 p-4">
          <pre className="text-xs leading-relaxed text-on-surface break-all whitespace-pre-wrap font-mono pr-10">
            {generatedKey}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface-container-high"
            aria-label="Copy API key to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#00C853]" />
                <span className="text-[#00C853]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-on-surface-variant" />
                <span className="text-on-surface-variant">Copy</span>
              </>
            )}
          </button>
        </div>

        <p className="text-sm text-[#00C853] font-medium">
          Your API key has been populated into the configuration examples below.
        </p>
      </div>
    );
  }

  // ── Ready to generate ──
  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
          <Key className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-on-surface">
            Generate an API key for the MCP server
          </p>
          <p className="text-sm text-on-surface-variant mt-1">
            This creates a key with all read scopes (scores, metrics, rankings,
            reports, watchlist). You can manage keys anytime from{" "}
            <a
              href="/account/api-keys"
              className="text-primary hover:underline font-medium"
            >
              account settings
            </a>
            .
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/20 p-3 mt-3">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={creating}
            className="mt-4 flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Generate API Key
              </>
            )}
          </button>
        </div>
      </div>

      <p className="text-xs text-on-surface-variant mt-4">
        Already have a key? Skip this step and paste it into the configuration
        in the next step.
      </p>
    </div>
  );
}
