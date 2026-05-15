/**
 * AnalyzerTierGate — shared Pro-tier guard logic for analyzer controllers.
 *
 * Resolves the caller's effective tier via `EntitlementsService` (which itself
 * delegates to `TierResolverService` for trial / org-tier / admin-fallback
 * resolution) and throws 403 if the user isn't on Pro/Enterprise/Admin.
 *
 * Extracted from `AnalyzerController` so the AI sub-controller can reuse the
 * exact same gating without re-implementing it. A `null` tier (auth user with
 * no `user_profiles` row) is logged at warn level and treated as `free` —
 * surfaces orphaned auth users in production logs without crashing requests.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { EntitlementsService } from '../entitlements/entitlements.service';

const PRO_ALLOWED_TIERS = ['pro', 'enterprise', 'admin'];

@Injectable()
export class AnalyzerTierGate {
  private readonly logger = new Logger(AnalyzerTierGate.name);

  constructor(private readonly entitlements: EntitlementsService) {}

  async requirePro(userId: string): Promise<void> {
    const resolved = await this.entitlements.getUserTier(userId);

    if (resolved == null) {
      this.logger.warn(
        `[Analyzer] requirePro: no tier resolved for userId=${userId.substring(0, 8)}… — missing user_profiles row?`,
      );
    }

    const tier = resolved ?? 'free';
    if (!PRO_ALLOWED_TIERS.includes(tier)) {
      throw new ForbiddenException(
        `This feature requires a Pro or Enterprise subscription. Current tier: ${tier}`,
      );
    }
  }
}
