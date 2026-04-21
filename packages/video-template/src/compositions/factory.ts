import { FormatKey, FORMAT_CONFIGS } from "../types";

export interface CompositionRegistration {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/**
 * Build a Remotion Composition registration payload for a given format key.
 * Consumed by Root.tsx so new formats can be added by only extending
 * FORMAT_CONFIGS in types.ts.
 */
export function createComposition(format: FormatKey): CompositionRegistration {
  const config = FORMAT_CONFIGS[format];
  return {
    id: format,
    width: config.width,
    height: config.height,
    fps: config.fps,
    durationInFrames: config.durationInFrames,
  };
}
