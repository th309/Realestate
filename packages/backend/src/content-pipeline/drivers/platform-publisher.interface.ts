import { Platform, PostMode } from '../types';
import { DriverCost } from './driver-cost.types';

export interface PublishRequest {
  runId: string;
  videoPath: string;
  thumbnailPath?: string;
  title: string;
  description: string;
  tags: string[];
  captionsSrtPath?: string;
  postMode: PostMode;
  scheduledFor?: Date;
}

export interface PublishResult {
  externalId: string;
  externalUrl: string;
  cost: DriverCost;
  providerResponse: unknown;
}

export interface PlatformPublisher {
  readonly platform: Platform;
  isConfigured(): Promise<boolean>; // DB-backed credential check is async
  publish(req: PublishRequest): Promise<PublishResult>;
  refreshCredentials?(): Promise<void>;
}

export const PLATFORM_PUBLISHERS = Symbol('PLATFORM_PUBLISHERS');
