import { Injectable, Inject } from '@nestjs/common';
import {
  PlatformPublisher,
  PLATFORM_PUBLISHERS,
} from './platform-publisher.interface';
import { Platform } from '../types';

/**
 * PlatformPublisherRegistry — typed query API over the PLATFORM_PUBLISHERS array.
 *
 * `isConfigured()` on the publisher interface is async because it queries the
 * platform_credentials DB row in addition to checking env vars. So the
 * registry's filter methods are also async — `listConfigured()` runs all 5
 * checks in parallel via Promise.all rather than sequentially. `listAll()`
 * stays synchronous since it just returns the injected array.
 *
 * Currently consumed by: nothing yet. Wired up so the admin Platforms page
 * (Task 2.22) and the eventual queue-routing rewrite (Task 2.18+) can replace
 * the hardcoded PLATFORM_TO_QUEUE map in publish.handler.ts.
 */
@Injectable()
export class PlatformPublisherRegistry {
  constructor(
    @Inject(PLATFORM_PUBLISHERS)
    private readonly all: PlatformPublisher[],
  ) {}

  listAll(): PlatformPublisher[] {
    return this.all;
  }

  async listConfigured(): Promise<PlatformPublisher[]> {
    const checks = await Promise.all(this.all.map((p) => p.isConfigured()));
    return this.all.filter((_, i) => checks[i]);
  }

  async forPlatform(platform: Platform): Promise<PlatformPublisher | null> {
    const candidate = this.all.find((p) => p.platform === platform);
    if (!candidate) return null;
    return (await candidate.isConfigured()) ? candidate : null;
  }
}
