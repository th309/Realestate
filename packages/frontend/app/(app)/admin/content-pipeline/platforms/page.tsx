"use client";

import { Suspense, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchPlatforms } from "../lib/content-pipeline-api";
import { useToast } from "../lib/toast";
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
  const toast = useToast();
  // One-shot guard so the callback bridge fires once per redirect even if the
  // effect re-runs (the shared toast api identity changes between renders).
  const handledCallback = useRef<string | null>(null);

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["content-pipeline-platforms"],
    queryFn: fetchPlatforms,
  });

  useEffect(() => {
    // Bridge the YouTube direct-OAuth callback (?connected / ?error) into the
    // shared toast, then strip the params. Errors use the shared error variant,
    // which is manual-dismiss (ttl:0) so the operator can read exchange_failed
    // reasons — the old bespoke pill auto-dismissed at 5s.
    const connected = searchParams.get("connected");
    const label = searchParams.get("label");
    const errorCode = searchParams.get("error");
    const key = connected
      ? `c:${connected}`
      : errorCode
        ? `e:${errorCode}`
        : null;
    if (!key || handledCallback.current === key) return;
    handledCallback.current = key;

    if (connected) {
      toast.success(
        `Connected ${label ? label + " to " : ""}${connected.replaceAll("_", " ")}`,
      );
      refetch();
    } else if (errorCode) {
      toast.error(errorMessage(errorCode));
    }
    router.replace("/admin/content-pipeline/platforms");
  }, [searchParams, router, refetch, toast]);

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

        {isError ? (
          <div className="rounded-xl border border-error/30 bg-error/5 p-5">
            <h3 className="text-sm font-semibold text-on-surface">
              Couldn&apos;t load the YouTube integration
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              The platforms service didn&apos;t respond. This is a backend or
              network issue.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </section>
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
