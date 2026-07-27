"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FORMAT_META,
  FORMAT_PREVIEWS,
  formatSpecLine,
  type FormatMeta,
} from "../lib/format-previews";
import { fetchSettings } from "../lib/settings-api";
import {
  fetchFormatSampleVideos,
  type FormatSampleVideo,
} from "../lib/formats-api";

interface FormatDefault {
  format: string;
  enabled?: boolean;
}

export function FormatStep({ onPick }: { onPick: (format: string) => void }) {
  // Drive enabled formats from format_templates.enabled in the DB so the
  // Settings page's per-format switches are the single source of truth.
  // Falls back to grade_reveal-only when the settings fetch is in flight
  // or fails — better than rendering an empty picker.
  const { data: settings } = useQuery({
    queryKey: ["content-pipeline-settings"],
    queryFn: fetchSettings,
  });

  // Pull the most recent successful run's video for each format so the
  // preview reflects the CURRENT Remotion template, not the static MP4
  // from /public/format-previews/ (which was baked at P1 time and goes
  // stale every template change). Falls back to the static MP4 when no
  // successful run exists yet for that format.
  const { data: sampleVideos = {} } = useQuery({
    queryKey: ["content-pipeline-format-sample-videos"],
    queryFn: fetchFormatSampleVideos,
    staleTime: 5 * 60 * 1000, // 5 min — signed URLs valid for 1h
  });

  const enabledSet = new Set<string>();
  if (settings?.formatDefaults?.length) {
    for (const f of settings.formatDefaults as FormatDefault[]) {
      if (f.enabled) enabledSet.add(f.format);
    }
  } else {
    enabledSet.add("grade_reveal"); // fallback during initial load
  }

  // The per-format switch in Settings governs Remotion video templates. Still
  // graphics have no video template behind them, so they're always on offer.
  const isOffered = (key: string) =>
    FORMAT_META[key].medium === "image" || enabledSet.has(key);

  const enabledKeys = Object.keys(FORMAT_META).filter(isOffered);
  const upcomingKeys = Object.keys(FORMAT_META).filter((k) => !isOffered(k));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Pick a format</h1>
      <div className="flex flex-wrap gap-6">
        {enabledKeys.map((key) => {
          const meta = FORMAT_META[key];
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              className="w-[240px] rounded-xl overflow-hidden bg-surface-container-low shadow-sm text-left hover:shadow-md"
            >
              <FormatPreview
                formatKey={key}
                enabled
                meta={meta}
                sample={sampleVideos[key] ?? null}
              />
              <div className="p-4">
                <div className="font-semibold">{meta.displayName}</div>
                <div className="text-xs text-outline">
                  {formatSpecLine(meta)}
                </div>
                <div className="text-xs mt-2">{meta.purpose}</div>
                {sampleVideos[key]?.marketName && (
                  <div className="text-[11px] text-on-surface-variant mt-2 italic">
                    Preview: {sampleVideos[key].marketName}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {upcomingKeys.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-outline mb-3">
            Disabled —{" "}
            <a
              href="/admin/content-pipeline/settings"
              className="underline text-primary"
            >
              toggle on in Settings
            </a>{" "}
            to use here
          </h2>
          <ul className="text-sm text-outline grid grid-cols-2 gap-x-8 gap-y-1">
            {upcomingKeys.map((key) => (
              <li key={key}>
                {FORMAT_META[key].displayName}{" "}
                <span className="text-xs">
                  ({formatSpecLine(FORMAT_META[key])})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FormatPreview({
  formatKey,
  enabled,
  meta,
  sample,
}: {
  formatKey: string;
  enabled: boolean;
  meta: FormatMeta;
  sample: FormatSampleVideo | null;
}) {
  const { aspect, displayName } = meta;
  const isStillGraphic = meta.medium === "image";
  const [videoAvailable, setVideoAvailable] = useState(enabled);
  // Prefer the live signed URL from a recent successful run; fall back
  // to the static MP4 in /public; final fallback is the brand-card
  // placeholder if neither exists or the video tag errors.
  const liveUrl = sample?.videoUrl ?? null;
  const staticUrl = FORMAT_PREVIEWS[formatKey];
  const previewSrc = liveUrl ?? staticUrl ?? null;
  return (
    <div
      className={`bg-gradient-to-br from-primary-container to-surface-container-high flex items-center justify-center ${aspect === "16:9" ? "aspect-video" : "aspect-[9/16]"}`}
    >
      {enabled && !isStillGraphic && videoAvailable && previewSrc ? (
        <video
          // key={previewSrc} ensures React re-mounts the element when the
          // signed URL refreshes, otherwise the cached <video> keeps the
          // expired URL and silently fails on play.
          key={previewSrc}
          src={previewSrc}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoAvailable(false)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-center px-4">
          <div className="text-on-primary-container font-semibold text-sm">
            {displayName}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {isStillGraphic
              ? `Still graphic · ${aspect}`
              : aspect === "16:9"
                ? "16:9 landscape"
                : "9:16 vertical"}
          </div>
        </div>
      )}
    </div>
  );
}
