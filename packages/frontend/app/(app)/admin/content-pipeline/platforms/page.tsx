"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchPlatforms } from "../lib/content-pipeline-api";
import { PlatformRow } from "./platform-row";
import { SocialConnectWall } from "./social-connect-wall";

/**
 * YouTube keeps its own direct OAuth integration (developer-app credentials +
 * the platform callback flow). Everything else connects through Late on the
 * one-click wall above. These are the only rows still rendered by the legacy
 * direct-OAuth path — the Meta / TikTok / LinkedIn / X rows moved to Late.
 */
const DIRECT_PLATFORMS = ["youtube_shorts", "youtube_long"] as const;

function errorMessage(code: string): string {
  // exchange_failed:<reason> — emitted by the per-platform handlers when
  // the code-for-token exchange fails. We pass the underlying error along.
  if (code.startsWith("exchange_failed:")) {
    return `Connect failed during token exchange — ${code.slice("exchange_failed:".length)}`;
  }
  switch (code) {
    case "state_invalid":
      return "Connect session expired. Click Connect and finish within 10 minutes.";
    case "state_expired":
      return "Connect session expired. Try again.";
    case "access_denied":
      return "You declined the platform's consent screen. Connect again to retry.";
    case "missing_code_or_state":
      return "Callback was missing required parameters. Connect again.";
    case "platform_not_supported":
      return "That platform's OAuth flow is not wired up.";
    default:
      return `Connect failed (${code}). Try again.`;
  }
}

function PlatformsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
  });

  useEffect(() => {
    // Bridges the YouTube direct-OAuth callback (?connected / ?error) into a
    // toast, then strips the params. This is a legitimate URL→state sync on
    // navigation return, not a render-driven update — the setState is gated by
    // the presence of callback params so it runs at most once per redirect.
    const connected = searchParams.get("connected");
    const label = searchParams.get("label");
    const errorCode = searchParams.get("error");

    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot OAuth callback bridge
      setToast({
        kind: "success",
        message: `Connected ${label ? label + " to " : ""}${connected.replaceAll("_", " ")}`,
      });
      refetch();
      router.replace("/admin/content-pipeline/platforms");
    } else if (errorCode) {
       
      setToast({ kind: "error", message: errorMessage(errorCode) });
      router.replace("/admin/content-pipeline/platforms");
    }
  }, [searchParams, router, refetch]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const byPlatform = new Map(data.map((p) => [p.platform, p]));

  return (
    <div className="max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="mb-1 text-2xl font-semibold text-on-surface">
          Platforms
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage where PropertyIQ publishes. Connect social networks in one
          click, or manage the direct YouTube integration below.
        </p>
      </div>

      <SocialConnectWall />

      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-on-surface">
            Direct integration
          </h2>
          <p className="text-sm text-on-surface-variant">
            YouTube uses its own Google OAuth app. Enter the developer
            credentials, then connect a channel.
          </p>
        </header>

        {isLoading && (
          <div className="rounded-xl bg-surface-container-low p-6 text-sm text-outline">
            Loading platforms…
          </div>
        )}

        {DIRECT_PLATFORMS.map((platform) => {
          const row = byPlatform.get(platform);
          return (
            <PlatformRow
              key={platform}
              platform={platform}
              configured={row?.configured ?? false}
              supported={row?.supported ?? false}
              accountLabel={row?.accountLabel ?? null}
              connectedAt={row?.connectedAt ?? null}
              lastPublishedAt={row?.lastPublishedAt ?? null}
              mirrorsPlatform={row?.mirrorsPlatform ?? null}
              appCredentials={
                row?.appCredentials ?? {
                  configured: false,
                  source: null,
                  lastFour: null,
                  updatedAt: null,
                  notes: null,
                  redirectUri: null,
                }
              }
              onChange={() => refetch()}
            />
          );
        })}
      </section>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg ${
            toast.kind === "success"
              ? "bg-primary text-on-primary"
              : "bg-error text-on-error"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default function PlatformsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl p-8 text-sm text-outline">Loading…</div>
      }
    >
      <PlatformsPageInner />
    </Suspense>
  );
}
