import React, { useMemo } from "react";
import {
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { AUDIO_ASSETS, AUDIO_LEVELS, SfxName } from "./levels";
import { buildSpeechRegions, musicVolumeAt } from "./ducking";

export interface SfxCue {
  /** Absolute frame the effect fires — same frame as the visual entrance. */
  frame: number;
  sound: SfxName;
  volume?: number;
}

interface CaptionWordLike {
  startMs: number;
  endMs: number;
  word: string;
}

export interface AudioMixProps {
  /** Signed narration URL (absent on silent previews/smoke renders). */
  audioUrl?: string;
  /** Word timings driving the sidechain duck. */
  captionWords?: readonly CaptionWordLike[];
  /** Frame the narration <Sequence> starts at (after the brand bumper). */
  narrationStartFrame: number;
  /** UI sounds tied to the same frames as visual entrances. */
  cues?: readonly SfxCue[];
}

/**
 * The full program mix for every composition: narration + ducked music bed
 * + room tone + entrance SFX. Mounted once per video (PropertyIQVideo);
 * compositions never mount their own <Audio> outside this and the bumper
 * sting. Levels come from AUDIO_LEVELS only.
 */
export const AudioMix: React.FC<AudioMixProps> = ({
  audioUrl,
  captionWords,
  narrationStartFrame,
  cues,
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const speechRegions = useMemo(() => {
    if (captionWords && captionWords.length > 0) {
      return buildSpeechRegions(captionWords, fps, narrationStartFrame);
    }
    // Narration exists but no timings (OpenAI fallback before Whisper):
    // duck conservatively for the whole possible narration span.
    if (audioUrl) {
      return [{ startFrame: narrationStartFrame, endFrame: durationInFrames }];
    }
    return [];
  }, [captionWords, audioUrl, fps, narrationStartFrame, durationInFrames]);

  const tailStart = durationInFrames - 45;

  return (
    <>
      {/* Music bed: sidechain-ducked under speech, eased out at the tail. */}
      <Audio
        loop
        src={staticFile(AUDIO_ASSETS.musicBed)}
        volume={(f) =>
          musicVolumeAt(f, speechRegions) *
          interpolate(
            f,
            [0, 15, tailStart, durationInFrames - 5],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          )
        }
      />

      {/* Room tone: constant low ambience so silences never sound dead. */}
      <Audio
        loop
        src={staticFile(AUDIO_ASSETS.roomTone)}
        volume={(f) =>
          AUDIO_LEVELS.roomTone *
          interpolate(f, [tailStart, durationInFrames - 5], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* Narration: reference level, click-guard fade-in. */}
      {audioUrl && (
        <Sequence from={narrationStartFrame}>
          <Audio
            src={audioUrl}
            volume={(f) =>
              AUDIO_LEVELS.narration *
              interpolate(f, [0, 4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            }
          />
        </Sequence>
      )}

      {/* Entrance SFX, frame-locked to the visual triggers. */}
      {cues?.map((cue, i) => (
        <Sequence
          key={`${cue.sound}-${cue.frame}-${i}`}
          from={cue.frame}
          durationInFrames={45}
        >
          <Audio
            src={staticFile(AUDIO_ASSETS.sfx[cue.sound])}
            volume={cue.volume ?? AUDIO_LEVELS.sfx}
          />
        </Sequence>
      ))}
    </>
  );
};
