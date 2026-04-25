"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVoices, type TtsVoice } from "../lib/content-pipeline-api";
import { useUpdateFormatDefault } from "../lib/use-format-mutations";
import { M3Popover } from "../components/m3-popover";

const AUDIENCE_LABELS: Record<string, string> = {
  short_form: "Short-form",
  long_form: "Long-form",
};

/**
 * Anchored popover with voice search + grouped list + audio preview.
 *
 * One audio plays at a time — clicking ▶ on another row stops the
 * first. Selection happens on click of the voice row (mutation fires
 * immediately), popover stays open so operators can A/B test by
 * picking another voice. Esc / click outside closes.
 */
export function VoicePickerPopover({
  open,
  onClose,
  anchorRef,
  format,
  selectedVoiceId,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  format: string;
  selectedVoiceId: string | null;
}) {
  const {
    data: voices = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["content-pipeline-voices"],
    queryFn: fetchVoices,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const updateMut = useUpdateFormatDefault();
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset search and stop playback when popover opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      setPlaying(null);
    } else {
      audioRef.current?.pause();
      audioRef.current = null;
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return voices.filter((v) => !q || v.display_name.toLowerCase().includes(q));
  }, [voices, search]);

  const groups = useMemo(() => {
    const byTag = new Map<string, TtsVoice[]>();
    for (const v of filtered) {
      const tag = v.audience_tag || "other";
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(v);
    }
    return Array.from(byTag.entries());
  }, [filtered]);

  function togglePlay(voice: TtsVoice) {
    if (!voice.sample_url) return;
    if (playing === voice.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(voice.sample_url);
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    audio.play().catch(() => setPlaying(null));
    audioRef.current = audio;
    setPlaying(voice.id);
  }

  function selectVoice(voice: TtsVoice) {
    updateMut.mutate({
      format,
      patch: { default_tts_voice_id: voice.id },
    });
  }

  return (
    <M3Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      ariaLabel="Pick a voice"
      width={380}
    >
      <div className="p-3 border-b border-outline-variant">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voices…"
          className="w-full bg-surface text-on-surface rounded-full px-4 py-2 text-sm border border-outline focus:outline-none focus:border-primary"
        />
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading && (
          <p className="text-xs text-on-surface-variant px-4 py-6 text-center">
            Loading voices…
          </p>
        )}
        {error && (
          <p className="text-xs text-error px-4 py-6 text-center">
            Couldn&apos;t load voices.
          </p>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-xs text-on-surface-variant px-4 py-6 text-center">
            No voices match.
          </p>
        )}
        {groups.map(([tag, list]) => (
          <section key={tag} className="py-2">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant px-4 mb-1">
              {AUDIENCE_LABELS[tag] ?? tag}
            </h3>
            <ul>
              {list.map((v) => {
                const active = v.id === selectedVoiceId;
                const isPlaying = playing === v.id;
                return (
                  <li key={v.id}>
                    <div
                      className={`flex items-center gap-3 px-4 py-2 hover:bg-on-surface/5 transition-colors duration-150 ${
                        active ? "bg-primary-container/30" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => togglePlay(v)}
                        disabled={!v.sample_url}
                        aria-label={isPlaying ? "Stop preview" : "Play preview"}
                        className={`flex-shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center text-sm transition-colors duration-150 ${
                          v.sample_url
                            ? isPlaying
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-highest text-on-surface hover:bg-primary hover:text-on-primary"
                            : "bg-surface-container-low text-on-surface-variant cursor-not-allowed opacity-50"
                        }`}
                      >
                        {isPlaying ? "⏸" : "▶"}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectVoice(v)}
                        className="flex-1 text-left flex items-center justify-between gap-2"
                      >
                        <span className="text-sm text-on-surface">
                          {v.display_name}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-on-surface-variant">
                            {v.provider}
                          </span>
                          <span className="text-[10px] font-mono text-on-surface-variant">
                            {v.cost_per_1k_chars > 0
                              ? `$${v.cost_per_1k_chars}/1k`
                              : "free"}
                          </span>
                          {active && (
                            <span className="text-primary text-sm" aria-hidden>
                              ✓
                            </span>
                          )}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </M3Popover>
  );
}
