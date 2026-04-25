"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchPlatforms } from "../lib/content-pipeline-api";
import { PlatformRow } from "./platform-row";

const ALL_PLATFORMS = [
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "facebook_reels",
  "linkedin",
  "youtube_long",
] as const;

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

export default function PlatformsPage() {
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
    const connected = searchParams.get("connected");
    const label = searchParams.get("label");
    const errorCode = searchParams.get("error");

    if (connected) {
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
    <div className="p-8 max-w-3xl space-y-3">
      <h1 className="text-2xl font-semibold mb-4 text-on-surface">
        Platform Credentials
      </h1>

      {isLoading && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-outline">
          Loading platforms...
        </div>
      )}

      {ALL_PLATFORMS.map((platform) => {
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
            onChange={() => refetch()}
          />
        );
      })}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 shadow-lg text-sm ${
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
