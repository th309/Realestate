"use client";

import { useState } from "react";
import {
  connectPlatform,
  disconnectPlatform,
  type AppCredentialStatus,
} from "../lib/content-pipeline-api";
import { ConfigureAppDialog } from "./configure-app-dialog";

interface PlatformRowProps {
  platform: string;
  configured: boolean;
  supported: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPublishedAt: string | null;
  /** When set, OAuth is managed on the mirrored platform row only. */
  mirrorsPlatform: string | null;
  appCredentials: AppCredentialStatus;
  onChange: () => void;
}

export function PlatformRow({
  platform,
  configured,
  supported,
  accountLabel,
  connectedAt,
  lastPublishedAt,
  mirrorsPlatform,
  appCredentials,
  onChange,
}: PlatformRowProps) {
  const [working, setWorking] = useState<"connect" | "disconnect" | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = platform.replaceAll("_", " ");

  void connectedAt;

  async function handleConnect() {
    setError(null);
    if (!appCredentials.configured) {
      setConfigureOpen(true);
      return;
    }
    setWorking("connect");
    try {
      const result = await connectPlatform(platform);
      if (result?.authUrl) {
        window.location.assign(result.authUrl);
        return;
      }
      setError("Backend did not return an auth URL — check the server logs.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connect failed";
      // Backend throws "app credentials not configured for X — open the
      // Configure dialog" when neither DB nor env vars have the keys.
      // Surface that explicitly with a Configure prompt.
      if (/app credentials not configured/i.test(msg)) {
        setError(
          "App credentials not set. Click Configure to enter them — no Railway trip needed.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setWorking(null);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setWorking("disconnect");
    try {
      await disconnectPlatform(platform);
      setConfirmDisconnect(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setWorking(null);
    }
  }

  const mirrorLabel = mirrorsPlatform?.replaceAll("_", " ");

  const statusLine = !supported
    ? "Available in a later phase"
    : mirrorsPlatform && configured && mirrorLabel
      ? `Connected · ${accountLabel ?? "channel"} (same OAuth as ${mirrorLabel})`
      : mirrorsPlatform && !configured && mirrorLabel
        ? `Uses the same Google connection as ${mirrorLabel} — connect there first`
      : configured
        ? accountLabel
          ? `Connected · ${accountLabel}`
          : "Connected"
        : appCredentials.configured
          ? "App ready · click Connect to authorize an account"
          : "App credentials not configured";

  return (
    <div className="rounded-xl bg-surface-container-low shadow-sm">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-3 h-3 rounded-full ${
              configured
                ? "bg-tertiary"
                : supported
                  ? appCredentials.configured
                    ? "bg-primary"
                    : "bg-outline"
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
            {configured && lastPublishedAt && (
              <div className="text-xs text-outline mt-0.5">
                Last publish {new Date(lastPublishedAt).toLocaleDateString()}
              </div>
            )}
            {supported && appCredentials.configured && !configured && (
              <div className="text-[11px] text-on-surface-variant mt-0.5">
                App credentials via {appCredentials.source}
                {appCredentials.lastFour
                  ? ` · ends ${appCredentials.lastFour}`
                  : ""}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {supported && !mirrorsPlatform && (
            <button
              type="button"
              onClick={() => setConfigureOpen(true)}
              className="text-xs font-medium text-primary hover:bg-primary/8 rounded-full px-3 py-1.5 transition-colors duration-200"
            >
              Configure
            </button>
          )}
          {supported && !configured && !mirrorsPlatform && (
            <button
              type="button"
              disabled={working === "connect"}
              onClick={handleConnect}
              className="bg-primary text-on-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {working === "connect" ? "Opening…" : "Connect"}
            </button>
          )}
          {supported && configured && !mirrorsPlatform && (
            <button
              type="button"
              disabled={working === "disconnect"}
              onClick={() => setConfirmDisconnect(true)}
              className="bg-surface-container-high text-on-surface rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Disconnect
            </button>
          )}
          {!supported && (
            <button
              type="button"
              disabled
              title="Available in a later phase"
              className="rounded-full px-5 py-2 text-sm font-semibold bg-surface-container-high text-outline opacity-60 cursor-not-allowed"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {error && <div className="px-4 pb-3 text-sm text-error">{error}</div>}

      {confirmDisconnect && (
        <div className="p-4 border-t border-outline-variant bg-surface-container space-y-3">
          <p className="text-sm">
            Disconnecting will stop publishing to{" "}
            <span className="font-semibold">{accountLabel ?? platform}</span>{" "}
            until you reconnect. Continue?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setConfirmDisconnect(false)}
              className="rounded-full px-4 py-1.5 text-sm bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={working === "disconnect"}
              onClick={handleDisconnect}
              className="rounded-full px-4 py-1.5 text-sm bg-error text-on-error font-semibold disabled:opacity-60"
            >
              {working === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      )}

      <ConfigureAppDialog
        open={configureOpen}
        platform={platform}
        status={appCredentials}
        onClose={() => setConfigureOpen(false)}
        onSaved={() => {
          setConfigureOpen(false);
          onChange();
        }}
      />
    </div>
  );
}
