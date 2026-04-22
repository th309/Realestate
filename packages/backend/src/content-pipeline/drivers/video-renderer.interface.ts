import { ContentFormat } from '../types';
import { DriverCost } from './driver-cost.types';

export interface VideoRenderRequest {
  format: ContentFormat;
  props: unknown;
  outputPath: string;
  audioPath: string;
  thumbnailOutputPath?: string;
  captionsPath?: string;
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
