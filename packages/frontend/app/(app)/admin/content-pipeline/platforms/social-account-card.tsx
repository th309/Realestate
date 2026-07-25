"use client";

import Image from "next/image";
import type { SocialConnection } from "@/lib/data";
import type { SocialPlatformMeta } from "./social-platform-meta";

/**
 * One platform tile on the connected-accounts wall. Presentational only — all
 * fetching + popup logic lives in `social-connect-wall.tsx`. Shows either the
 * connected account (avatar, handle, status chip) or a Connect button.
 */
export function SocialAccountCard({
  meta,
  connection,
  configured,
  working,
  onConnect,
  onDisconnect,
}: {
  meta: SocialPlatformMeta;
  connection: SocialConnection | null;
  configured: boolean;
  working: "connect" | "disconnect" | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const { label, Glyph } = meta;
  const isConnected = connection?.status === "connected";
  const needsReauth = connection?.status === "needs_reauth";

  return (
    <div className="flex flex-col rounded-xl bg-surface-container-low p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
            <Glyph className="h-5 w-5" />
          </span>
          <div className="font-semibold text-on-surface">{label}</div>
        </div>
        {(isConnected || needsReauth) && (
          <StatusChip status={needsReauth ? "needs_reauth" : "connected"} />
        )}
      </div>

      {connection && (isConnected || needsReauth) ? (
        <div className="mt-4 flex items-center gap-3">
          <Avatar url={connection.avatarUrl} label={label} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-on-surface">
              {connection.handle ?? "Connected account"}
            </div>
            {connection.connectedAt && (
              <div className="text-xs text-outline">
                Connected{" "}
                {new Date(connection.connectedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-on-surface-variant">
          {configured
            ? "Connect an account to publish here."
            : "Available once the Late key is set."}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        {isConnected || needsReauth ? (
          <div className="flex gap-2">
            {needsReauth && (
              <button
                type="button"
                onClick={onConnect}
                disabled={!configured || working !== null}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 disabled:opacity-60"
              >
                {working === "connect" ? "Opening…" : "Reconnect"}
              </button>
            )}
            <button
              type="button"
              onClick={onDisconnect}
              disabled={working !== null}
              className="rounded-full bg-surface-container-high px-4 py-2 text-sm font-semibold text-on-surface transition-colors duration-200 disabled:opacity-60"
            >
              {working === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={!configured || working !== null}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 disabled:opacity-60"
            title={
              configured ? undefined : "Set LATE_API_KEY to enable connect"
            }
          >
            {working === "connect" ? "Opening…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: "connected" | "needs_reauth" }) {
  const connected = status === "connected";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        connected
          ? "bg-tertiary-container text-on-tertiary-container"
          : "bg-error-container text-on-error-container"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected ? "bg-tertiary" : "bg-error"
        }`}
        aria-hidden
      />
      {connected ? "Connected" : "Reconnect needed"}
    </span>
  );
}

function Avatar({ url, label }: { url: string | null; label: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={`${label} account avatar`}
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container"
      aria-hidden
    >
      {label.charAt(0)}
    </span>
  );
}
