import { ContentFormat } from '../types';
import { DriverCost } from './driver-cost.types';

/** Forwarded from Remotion `renderMedia` stderr (`REMOTION_PROGRESS` lines). */
export type RenderVideoProgressPayload = {
  progress?: number;
  renderedFrames: number;
  encodedFrames: number;
  stitchStage?: string | null;
  durationInFrames: number;
  wallMs: number;
};

export interface VideoRenderRequest {
  format: ContentFormat;
  props: unknown;
  outputPath: string;
  thumbnailOutputPath?: string;
  captionsPath?: string;
  /** Optional hook when the CLI emits progress (long renders — updates admin event log). */
  onRenderProgress?: (p: RenderVideoProgressPayload) => void | Promise<void>;
}

export interface VideoRenderResult {
  videoPath: string;
  thumbnailPath?: string;
  durationMs: number;
  renderWallMs: number;
  cost: DriverCost;
}

export interface VideoRenderer {
  render(req: VideoRenderRequest): Promise<VideoRenderResult>;
}

export const VIDEO_RENDERER = Symbol('VideoRenderer');
