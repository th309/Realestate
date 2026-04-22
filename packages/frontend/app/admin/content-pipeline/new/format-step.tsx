"use client";
import { useState } from "react";
import { FORMAT_META, FORMAT_PREVIEWS } from "../lib/format-previews";

const ENABLED_FORMATS = new Set(["grade_reveal"]);

export function FormatStep({ onPick }: { onPick: (format: string) => void }) {
  const enabledKeys = Object.keys(FORMAT_META).filter((k) =>
    ENABLED_FORMATS.has(k),
  );
  const upcomingKeys = Object.keys(FORMAT_META).filter(
    (k) => !ENABLED_FORMATS.has(k),
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Pick a format</h1>
      <div className="grid grid-cols-3 gap-6">
        {enabledKeys.map((key) => {
          const meta = FORMAT_META[key];
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              className="rounded-xl overflow-hidden bg-surface-container-low shadow-sm text-left hover:shadow-md"
            >
              <FormatPreview
                formatKey={key}
                enabled
                aspect={meta.aspect}
                displayName={meta.displayName}
              />
              <div className="p-4">
                <div className="font-semibold">{meta.displayName}</div>
                <div className="text-xs text-outline">
                  {meta.audience} {meta.duration}s {meta.aspect}
                </div>
                <div className="text-xs mt-2">{meta.purpose}</div>
              </div>
            </button>
          );
        })}
      </div>

      {upcomingKeys.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-outline mb-3">
            Coming in later phase
          </h2>
          <ul className="text-sm text-outline grid grid-cols-2 gap-x-8 gap-y-1">
            {upcomingKeys.map((key) => (
              <li key={key}>
                {FORMAT_META[key].displayName}{" "}
                <span className="text-xs">
                  ({FORMAT_META[key].audience} · {FORMAT_META[key].duration}s)
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
  aspect,
  displayName,
}: {
  formatKey: string;
  enabled: boolean;
  aspect: string;
  displayName: string;
}) {
  const [videoAvailable, setVideoAvailable] = useState(enabled);
  const previewPath = FORMAT_PREVIEWS[formatKey];
  return (
    <div
      className={`bg-gradient-to-br from-primary-container to-surface-container-high flex items-center justify-center ${aspect === "16:9" ? "aspect-video" : "aspect-[9/16]"}`}
    >
      {enabled && videoAvailable && previewPath ? (
        <video
          src={previewPath}
          autoPlay
          loop
          muted
          onError={() => setVideoAvailable(false)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-center px-4">
          <div className="text-on-primary-container font-semibold text-sm">
            {displayName}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {aspect === "16:9" ? "16:9 landscape" : "9:16 vertical"}
          </div>
        </div>
      )}
    </div>
  );
}
