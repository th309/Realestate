/**
 * Gain staging for the PropertyIQ video mix — the ONLY place mix levels
 * may be defined. Every composition type uses these same constants, which
 * is what keeps loudness consistent across formats (narration itself is
 * loudnorm'd to -16 LUFS backend-side before it reaches the composition).
 */
export const AUDIO_LEVELS = {
  /** Narration is the reference level; everything else sits under it. */
  narration: 1.0,
  /** Music bed when nobody is speaking. */
  musicBed: 0.14,
  /** Music bed while narration is active (sidechain-style duck target). */
  musicDucked: 0.045,
  /** Constant ambient layer so silences never sound dead/cut-off. */
  roomTone: 0.04,
  /** Brand sting under the bumper. */
  sting: 0.8,
  /** UI sound effects (whoosh/tick/chime) on entrances. */
  sfx: 0.45,
} as const;

/** Duck envelope shape, in frames at 30fps. */
export const DUCK = {
  /** Music starts dipping this many frames BEFORE speech begins. */
  attackFrames: 8,
  /** Music recovers over this many frames after speech ends. */
  releaseFrames: 20,
  /** Word gaps shorter than this stay ducked (no pumping between words). */
  holdMs: 600,
} as const;

/** Static asset paths under public/ (see scripts/generate-audio-assets.mjs). */
export const AUDIO_ASSETS = {
  musicBed: "audio/music-bed.wav",
  roomTone: "audio/room-tone.wav",
  sfx: {
    whoosh: "audio/sfx-whoosh.wav",
    tick: "audio/sfx-tick.wav",
    chime: "audio/sfx-chime.wav",
  },
} as const;

export type SfxName = keyof typeof AUDIO_ASSETS.sfx;
