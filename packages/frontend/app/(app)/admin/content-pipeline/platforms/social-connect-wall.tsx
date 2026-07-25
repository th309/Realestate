"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
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
import { LATE_CONNECTED_PARAM, YOUTUBE_BRIDGE_PARAMS } from "./redirect-params";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [working, setWorking] = useState<WorkingMap>({});
  const [syncing, setSyncing] = useState(false);
  // One interval per platform so concurrent connects never clear each other.
  const pollRef = useRef<
    Map<SocialConnectPlatform, ReturnType<typeof setInterval>>
  >(new Map());
  // One-shot guard so the late_connected reconcile fires once per return, even
  // if the effect re-runs (Strict Mode double-invoke, or before replace lands).
  const handledLateConnect = useRef(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["social-connections"],
    queryFn: () => fetchSocialConnections(),
    // Admin surface — always revalidate on mount so a just-finished connect shows.
    staleTime: 0,
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
        // the refetch below reflects the true current state regardless.
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
          `late-connect-${platform}`,
          "width=600,height=760",
        );
        if (!popup) {
          // Popup blocked — full-page redirect; the page reconciles on return
          // via the late_connected marker (and the manual Sync button).
          window.location.assign(authUrl);
          return;
        }
        const existing = pollRef.current.get(platform);
        if (existing) clearInterval(existing);
        const startedAt = Date.now();
        const interval = setInterval(() => {
          const timedOut = Date.now() - startedAt > 5 * 60 * 1000;
          if (popup.closed || timedOut) {
            const iv = pollRef.current.get(platform);
            if (iv) clearInterval(iv);
            pollRef.current.delete(platform);
            if (timedOut && !popup.closed) popup.close();
            void finishConnect(platform);
          }
        }, 2500);
        pollRef.current.set(platform, interval);
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
    async (platform: SocialConnectPlatform, connection: SocialConnection) => {
      setBusy(platform, "disconnect");
      try {
        await disconnectSocialConnection(connection.id, connection.brandId);
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

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncSocialConnections();
      toast.success(
        `Synced ${result.synced} account${result.synced === 1 ? "" : "s"}`,
      );
      await refetch();
    } catch (err) {
      if (err instanceof SocialConnectNotConfiguredError) {
        toast.error("Late isn't configured yet — set LATE_API_KEY.");
      } else {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }, [refetch, toast]);

  // Reconcile on return from a popup-blocked full-page redirect, then strip the
  // marker so a reload doesn't re-sync. Once-guarded against effect re-runs.
  useEffect(() => {
    if (!searchParams.get(LATE_CONNECTED_PARAM)) return;
    if (handledLateConnect.current) return;
    handledLateConnect.current = true;
    void (async () => {
      try {
        await syncSocialConnections();
      } catch {
        /* ignore — refetch shows the true state */
      }
      await refetch();
    })();
    // Coordinator-wins: if the YouTube bridge params are also present, let
    // page.tsx's callback effect own the URL cleanup; otherwise strip our marker.
    const pageBridgeActive = YOUTUBE_BRIDGE_PARAMS.some((p) =>
      searchParams.get(p),
    );
    if (!pageBridgeActive) {
      router.replace("/admin/content-pipeline/platforms");
    }
  }, [searchParams, router, refetch]);

  // Stop any open poll intervals when the wall unmounts.
  useEffect(() => {
    const intervals = pollRef.current;
    return () => {
      intervals.forEach((iv) => clearInterval(iv));
      intervals.clear();
    };
  }, []);

  const realError =
    isError && !(error instanceof SocialConnectNotConfiguredError);

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-on-surface">
            One-click connect
          </h2>
          <p className="text-sm text-on-surface-variant">
            Connect a network once and PropertyIQ can publish to it. Login is
            hosted by Late — you approve access in a popup and land back here.
          </p>
        </div>
        {configured && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="shrink-0 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors duration-200 disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync accounts"}
          </button>
        )}
      </header>

      {realError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
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
                      connection && handleDisconnect(meta.id, connection)
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Real fetch failure — distinct from the not-configured banner. */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-error/30 bg-error/5 p-5">
      <h3 className="text-sm font-semibold text-on-surface">
        Couldn&apos;t load connections
      </h3>
      <p className="mt-1 text-sm text-on-surface-variant">
        The connections service didn&apos;t respond. This is a backend or
        network issue, not a missing key.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200"
      >
        Retry
      </button>
    </div>
  );
}
