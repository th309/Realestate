"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createSocialConnectLink,
  disconnectSocialConnection,
  fetchSocialConnections,
  syncSocialConnections,
  SocialConnectNotConfiguredError,
  type SocialConnectPlatform,
  type SocialConnection,
} from "@/lib/data";
import { useToast } from "../lib/toast";
import { SOCIAL_PLATFORM_META } from "./social-platform-meta";
import { SocialAccountCard } from "./social-account-card";
import { LateNotConfiguredBanner } from "./late-not-configured-banner";

/** Per-platform in-flight action so only the clicked card shows a spinner. */
type WorkingMap = Partial<
  Record<SocialConnectPlatform, "connect" | "disconnect">
>;

/**
 * The one-click connected-accounts wall for the five Late-managed networks.
 * Owns the fetch, the hosted-OAuth popup, and post-popup reconciliation. The
 * YouTube direct-OAuth card is rendered separately by the page and is untouched.
 */
export function SocialConnectWall() {
  const toast = useToast();
  const [working, setWorking] = useState<WorkingMap>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["social-connections"],
    queryFn: () => fetchSocialConnections(),
  });

  const configured = data?.configured ?? false;
  const byPlatform = new Map<string, SocialConnection>(
    (data?.connections ?? [])
      .filter((c) => c.status !== "disconnected")
      .map((c) => [c.platform, c]),
  );

  const setBusy = useCallback(
    (
      platform: SocialConnectPlatform,
      value: "connect" | "disconnect" | null,
    ) => {
      setWorking((prev) => {
        const next = { ...prev };
        if (value === null) delete next[platform];
        else next[platform] = value;
        return next;
      });
    },
    [],
  );

  /** After the popup closes, reconcile Late's accounts then refresh the wall. */
  const finishConnect = useCallback(
    async (platform: SocialConnectPlatform) => {
      try {
        await syncSocialConnections();
      } catch {
        // Sync may 400 until a brand is wired, or 503 if the key vanished —
        // either way the refetch below reflects the true current state.
      }
      await refetch();
      setBusy(platform, null);
    },
    [refetch, setBusy],
  );

  const handleConnect = useCallback(
    async (platform: SocialConnectPlatform) => {
      setBusy(platform, "connect");
      try {
        const { authUrl } = await createSocialConnectLink(platform);
        const popup = window.open(
          authUrl,
          "late-connect",
          "width=600,height=760,noopener=false",
        );
        if (!popup) {
          // Popup blocked — fall back to a full-page redirect.
          window.location.assign(authUrl);
          return;
        }
        if (pollRef.current) clearInterval(pollRef.current);
        const startedAt = Date.now();
        pollRef.current = setInterval(() => {
          const timedOut = Date.now() - startedAt > 5 * 60 * 1000;
          if (popup.closed || timedOut) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            if (timedOut && !popup.closed) popup.close();
            void finishConnect(platform);
          }
        }, 2500);
      } catch (err) {
        setBusy(platform, null);
        if (err instanceof SocialConnectNotConfiguredError) {
          toast.error(
            "Late isn't configured yet — set LATE_API_KEY on the backend.",
          );
          void refetch();
        } else {
          toast.error(err instanceof Error ? err.message : "Connect failed");
        }
      }
    },
    [finishConnect, refetch, setBusy, toast],
  );

  const handleDisconnect = useCallback(
    async (platform: SocialConnectPlatform, connectionId: string) => {
      setBusy(platform, "disconnect");
      try {
        await disconnectSocialConnection(connectionId);
        toast.success(`Disconnected ${platform}`);
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Disconnect failed");
      } finally {
        setBusy(platform, null);
      }
    },
    [refetch, setBusy, toast],
  );

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-on-surface">
          One-click connect
        </h2>
        <p className="text-sm text-on-surface-variant">
          Connect a network once and PropertyIQ can publish to it. Login is
          hosted by Late — you approve access in a popup and land back here.
        </p>
      </header>

      {!isLoading && !configured && (
        <LateNotConfiguredBanner setup={data?.setup} />
      )}

      {isLoading ? (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-outline">
          Loading connections…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SOCIAL_PLATFORM_META.map((meta) => {
            const connection = byPlatform.get(meta.id) ?? null;
            return (
              <SocialAccountCard
                key={meta.id}
                meta={meta}
                connection={connection}
                configured={configured}
                working={working[meta.id] ?? null}
                onConnect={() => handleConnect(meta.id)}
                onDisconnect={() =>
                  connection && handleDisconnect(meta.id, connection.id)
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
