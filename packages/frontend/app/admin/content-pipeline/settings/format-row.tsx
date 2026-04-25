"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchVoices } from "../lib/content-pipeline-api";
import { useUpdateFormatDefault } from "../lib/use-format-mutations";
import { M3Switch } from "../components/m3-switch";
import { FormatDetailPanel } from "./format-detail-panel";

export interface FormatRowData {
  format: string;
  display_name?: string;
  default_approval_mode?: string;
  default_tts_voice_id?: string | null;
  default_platforms?: string[];
  enabled?: boolean;
}

const PLATFORM_ICONS: Record<string, string> = {
  youtube_shorts: "▶",
  youtube_long: "▶",
  tiktok: "♪",
  instagram_reels: "◉",
  facebook_reels: "ƒ",
  linkedin: "in",
};

const APPROVAL_MODES = ["auto", "review", "draft"] as const;

/**
 * Master row + inline expand. Click anywhere on the row body (NOT the
 * switch/select) toggles expansion. Approval mode + enabled stay
 * inline-editable in the master row since they're the most-changed fields.
 */
export function FormatRow({
  row,
  expanded,
  onExpand,
  saving,
}: {
  row: FormatRowData;
  expanded: boolean;
  onExpand: () => void;
  saving: boolean;
}) {
  const { data: voices = [] } = useQuery({
    queryKey: ["content-pipeline-voices"],
    queryFn: fetchVoices,
    staleTime: 5 * 60 * 1000,
  });
  const updateMut = useUpdateFormatDefault();
  const voice = voices.find((v) => v.id === row.default_tts_voice_id);
  const platforms = row.default_platforms ?? [];
  const isEnabled = row.enabled ?? false;

  return (
    <div
      className={`border-b border-outline-variant last:border-b-0 transition-opacity duration-200 ${
        isEnabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <M3Switch
          checked={isEnabled}
          ariaLabel={`Enable ${row.display_name ?? row.format}`}
          onChange={(next) =>
            updateMut.mutate({
              format: row.format,
              patch: { enabled: next },
            })
          }
        />
        <button
          type="button"
          onClick={onExpand}
          className="flex-1 flex items-center gap-3 text-left"
        >
          <span className="text-sm font-medium text-on-surface min-w-[14rem]">
            {row.display_name ?? row.format}
          </span>
          <select
            value={row.default_approval_mode ?? "review"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              updateMut.mutate({
                format: row.format,
                patch: {
                  default_approval_mode: e.target
                    .value as (typeof APPROVAL_MODES)[number],
                },
              })
            }
            className="bg-surface-container text-on-surface text-xs font-medium rounded-full px-3 py-1 border border-outline focus:outline-none focus:border-primary cursor-pointer"
          >
            {APPROVAL_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-xs text-on-surface-variant truncate flex-1 min-w-[6rem]">
            {voice?.display_name ?? "(no voice)"}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-on-surface-variant">
            {platforms.length === 0 ? (
              <span className="italic">no platforms</span>
            ) : (
              platforms.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center justify-center w-5 h-5 rounded bg-primary-container text-on-primary-container"
                  title={p}
                >
                  {PLATFORM_ICONS[p] ?? "•"}
                </span>
              ))
            )}
          </span>
          <SaveDot saving={saving} />
          <span
            className={`text-on-surface-variant text-xs transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ›
          </span>
        </button>
      </div>
      {expanded && (
        <FormatDetailPanel
          format={row.format}
          voiceId={row.default_tts_voice_id ?? null}
          platforms={platforms}
        />
      )}
    </div>
  );
}

function SaveDot({ saving }: { saving: boolean }) {
  if (!saving) return null;
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
      aria-label="Saving"
    />
  );
}
