"use client";

import { useState } from "react";
import { connectPlatform } from "../lib/content-pipeline-api";

interface PlatformRowProps {
  platform: string;
  configured: boolean;
  lastPublishedAt: string | null;
  supported?: boolean;
  onChange: () => void;
}

export function PlatformRow({
  platform,
  configured,
  lastPublishedAt,
  supported = true,
  onChange: _onChange,
}: PlatformRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const label = platform.replaceAll("_", " ");
  const docSlug = platform.split("_")[0];

  async function handleConnect() {
    setConnectError(null);
    try {
      setConnecting(true);
      const result = await connectPlatform(platform);
      if (result?.authUrl) {
        window.location.href = result.authUrl;
        return;
      }
      setConnectError("Backend returned no auth URL");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setConnecting(false);
    }
  }

  const statusLine = !supported
    ? "Not yet available"
    : configured
      ? lastPublishedAt
        ? `Last publish ${new Date(lastPublishedAt).toLocaleDateString()}`
        : "Ready"
      : "Not connected";

  return (
    <div className="rounded-xl bg-surface-container-low shadow-sm">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-3 h-3 rounded-full ${
              configured
                ? "bg-accent"
                : supported
                  ? "bg-outline"
                  : "bg-surface-container-high"
            }`}
            aria-label={configured ? "Connected" : "Not connected"}
          />
          <div>
            <div
              className={`font-semibold capitalize ${!supported ? "text-outline" : ""}`}
            >
              {label}
            </div>
            <div className="text-xs text-outline">{statusLine}</div>
          </div>
        </div>
        {supported && !configured && (
          <button
            type="button"
            disabled={connecting}
            onClick={(e) => {
              e.stopPropagation();
              handleConnect();
            }}
            className="bg-primary text-on-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>
        )}
        {!supported && (
          <span className="text-xs text-outline font-semibold">
            Coming soon
          </span>
        )}
      </div>
      {expanded && (
        <div className="p-4 border-t border-outline-variant space-y-2">
          {connectError && <p className="text-sm text-error">{connectError}</p>}
          <p className="text-sm">
            Setup walkthrough:{" "}
            <code className="bg-surface-container rounded px-1 py-0.5 text-xs">
              docs/content-pipeline/platform-setup/{docSlug}.md
            </code>
          </p>
          {configured && lastPublishedAt && (
            <p className="text-xs text-outline">
              Last successful publish:{" "}
              {new Date(lastPublishedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
