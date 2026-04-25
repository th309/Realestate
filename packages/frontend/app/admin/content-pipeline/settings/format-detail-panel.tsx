"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVoices, type TtsVoice } from "../lib/content-pipeline-api";
import { PlatformChips } from "./platform-chips";
import { VoicePickerPopover } from "./voice-picker-popover";

/**
 * Inline expand panel for a format row. Two cards side-by-side: voice
 * (with inline preview + Change ›) and platforms (chip multi-select).
 *
 * The voice ▶ here previews the *currently selected* voice without
 * opening the picker — the picker is only for changing. Operators
 * commonly want to "hear what Davis sounds like for this format" and
 * then move on.
 */
export function FormatDetailPanel({
  format,
  voiceId,
  platforms,
}: {
  format: string;
  voiceId: string | null;
  platforms: string[];
}) {
  const { data: voices = [] } = useQuery({
    queryKey: ["content-pipeline-voices"],
    queryFn: fetchVoices,
    staleTime: 5 * 60 * 1000,
  });
  const voice = voices.find((v) => v.id === voiceId) ?? null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const changeBtnRef = useRef<HTMLButtonElement>(null);

  function togglePreview() {
    if (!voice?.sample_url) return;
    if (previewing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPreviewing(false);
      return;
    }
    const audio = new Audio(voice.sample_url);
    audio.onended = () => setPreviewing(false);
    audio.onerror = () => setPreviewing(false);
    audio.play().catch(() => setPreviewing(false));
    audioRef.current = audio;
    setPreviewing(true);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-container/50 border-t border-outline-variant">
      <VoiceCard
        voice={voice}
        previewing={previewing}
        onTogglePreview={togglePreview}
        changeBtnRef={changeBtnRef}
        onOpenPicker={() => setPickerOpen(true)}
      />
      <div>
        <h4 className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant mb-2">
          Platforms
        </h4>
        <PlatformChips format={format} selected={platforms} />
      </div>
      <VoicePickerPopover
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        anchorRef={changeBtnRef}
        format={format}
        selectedVoiceId={voiceId}
      />
    </div>
  );
}

function VoiceCard({
  voice,
  previewing,
  onTogglePreview,
  changeBtnRef,
  onOpenPicker,
}: {
  voice: TtsVoice | null;
  previewing: boolean;
  onTogglePreview: () => void;
  changeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onOpenPicker: () => void;
}) {
  return (
    <div>
      <h4 className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant mb-2">
        Voice
      </h4>
      <div className="rounded-xl bg-surface-container-low p-3 border border-outline-variant">
        {voice ? (
          <>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-on-surface">
                {voice.display_name}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant">
                {voice.provider} ·{" "}
                {voice.cost_per_1k_chars > 0
                  ? `$${voice.cost_per_1k_chars}/1k`
                  : "free"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePreview}
                disabled={!voice.sample_url}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1 ${
                  voice.sample_url
                    ? previewing
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface border border-outline hover:bg-surface-container"
                    : "bg-surface-container-low text-on-surface-variant cursor-not-allowed opacity-60"
                }`}
              >
                <span aria-hidden>{previewing ? "⏸" : "▶"}</span>
                <span>Preview</span>
              </button>
              <button
                ref={changeBtnRef}
                type="button"
                onClick={onOpenPicker}
                className="px-3 py-1 rounded-full text-xs font-medium text-primary hover:bg-primary/8 transition-colors duration-150"
              >
                Change ›
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-variant italic">
              No voice configured
            </span>
            <button
              ref={changeBtnRef}
              type="button"
              onClick={onOpenPicker}
              className="px-3 py-1 rounded-full text-xs font-medium text-primary hover:bg-primary/8 transition-colors duration-150"
            >
              Pick one ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
