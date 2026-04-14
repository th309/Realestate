import { Injectable } from '@nestjs/common';
import { UserFeaturesService } from '../admin/features/user-features.service';
import { ServerEventEmitterService } from '../user-analytics/server-event-emitter.service';
import type { AccessCheck } from './entitlements.service';

/**
 * Emits `trial.pro_feature_used` events when a trial user is granted access
 * to a Pro-gated feature specifically because of their trial.
 *
 * Split out of EntitlementsService to keep that file focused on access
 * decisions; this module owns the analytics side-effect.
 *
 * Fire-and-forget semantics: callers should swallow any error this surfaces.
 */
@Injectable()
export class TrialFeatureUsageEmitterService {
  constructor(
    private readonly userFeatures: UserFeaturesService,
    private readonly eventEmitter: ServerEventEmitterService,
  ) {}

  /**
   * Fires one `trial.pro_feature_used` event per resource where the trial
   * actually unlocked access (i.e. the free tier would have been blocked).
   * Call only when the user is on an active trial AND their baseline
   * subscription tier is free — otherwise the trial isn't the reason access
   * was granted.
   */
  async emitForGrantedAccess(
    userId: string,
    access: Record<string, AccessCheck>,
  ): Promise<void> {
    // Compare against free-tier access to emit only for features that were
    // actually gated behind Pro (i.e. trial unlocked them).
    const freeFeatures = await this.userFeatures.getUserFeatures(
      userId,
      'free',
    );

    for (const [resource, check] of Object.entries(access)) {
      if (check.level === 'none') continue;

      const [type, id] = resource.split(':');
      const prefixedSlug = `${type}_${id}`;
      const freeAccess =
        freeFeatures.features[prefixedSlug] ?? freeFeatures.features[id];
      const freeHasFull = freeAccess === true || freeAccess === -1;
      // If free tier already has full access, the trial didn't unlock
      // anything — skip.
      if (freeHasFull) continue;

      await this.eventEmitter.emit('trial', 'pro_feature_used', userId, {
        feature_slug: prefixedSlug,
        resource,
        access_level: check.level,
      });
    }
  }
}
