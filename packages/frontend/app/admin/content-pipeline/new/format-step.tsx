"use client";
import { FORMAT_META, FORMAT_PREVIEWS } from "../lib/format-previews";

export function FormatStep({ onPick }: { onPick: (format: string) => void }) {
  const enabled = ["grade_reveal"];
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Pick a format</h1>
      <div className="grid grid-cols-3 gap-6">
        {Object.keys(FORMAT_META).map((key) => {
          const meta = FORMAT_META[key];
          const isEnabled = enabled.includes(key);
          return (
            <button
              key={key}
              disabled={!isEnabled}
              onClick={() => onPick(key)}
              className={`rounded-xl overflow-hidden bg-surface-container-low shadow-sm text-left ${isEnabled ? "hover:shadow-md" : "opacity-50 cursor-not-allowed"}`}
            >
              <div className="aspect-[9/16] bg-outline">
                {isEnabled && (
                  <video
                    src={FORMAT_PREVIEWS[key]}
                    autoPlay
                    loop
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-4">
                <div className="font-semibold">{meta.displayName}</div>
                <div className="text-xs text-outline">
                  {meta.audience} {meta.duration}s {meta.aspect}
                </div>
                <div className="text-xs mt-2">{meta.purpose}</div>
                {!isEnabled && (
                  <div className="text-xs mt-2 text-primary">
                    Coming in later phase
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
