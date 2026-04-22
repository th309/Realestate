"use client";

import { useState } from "react";
import { connectPlatform } from "../lib/content-pipeline-api";

interface PlatformRowProps {
  platform: string;
  configured: boolean;
  lastPublishedAt: string | null;
  onChange: () => void;
}

/**
 * One row on the Platforms admin page. Shows status dot, platform label,
 * last-publish line, and a Connect button that launches the OAuth flow
 * when the platform is not yet configured.
 */
export function PlatformRow({
  platform,
  configured,
  lastPublishedAt,
  onChange: _onChange,
}: PlatformRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const label = platform.replaceAll("_", " ");
  const docSlug = platform.split("_")[0];

  async function handleConnect() {
    try {
      setConnecting(true);
      const result = await connectPlatform(platform);
      if (result?.authUrl) {
        window.location.href = result.authUrl;
        return;
      }
    } catch (err) {
      console.error("connectPlatform failed", err);
      setConnecting(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface-container-low shadow-sm">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-3 h-3 rounded-full ${
              configured ? "bg-accent" : "bg-outline"
            }`}
            aria-label={configured ? "Connected" : "Not connected"}
          />
          <div>
            <div className="font-semibold capitalize">{label}</div>
            <div className="text-xs text-outline">
              {configured
                ? lastPublishedAt
                  ? `Last publish ${new Date(lastPublishedAt).toLocaleDateString()}`
                  : "Ready"
                : "Not connected"}
            </div>
          </div>
        </div>
        {!configured && (
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
      </div>
      {expanded && !configured && (
        <div className="p-4 border-t border-outline-variant">
          <p className="text-sm mb-1">
            See the setup walkthrough at{" "}
            <code className="bg-surface-container rounded px-1 py-0.5 text-xs">
              docs/content-pipeline/platform-setup/{docSlug}.md
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
