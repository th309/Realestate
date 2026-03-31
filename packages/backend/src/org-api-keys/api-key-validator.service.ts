/**
 * API Key Validator Service
 *
 * Validates Platform API keys from two sources:
 * 1. organization_api_keys — Enterprise orgs
 * 2. user_api_keys — Pro individual users
 *
 * Both use the same piq_live_ format. After key lookup, the owner's
 * subscription_tier is checked (cached in Redis for 5 minutes).
 */

import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';

export interface ValidatedApiKey {
  orgId?: string;
  userId?: string;
  scopes: string[];
  rateLimitRpm: number;
  keyId: string;
  source: 'org' | 'user';
}

const DEFAULT_RATE_LIMIT_RPM = 60;
const TIER_CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class ApiKeyValidatorService {
  private readonly logger = new Logger(ApiKeyValidatorService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redisService: RedisService,
  ) {}

  async validateKey(rawKey: string): Promise<ValidatedApiKey> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    // 1. Check organization_api_keys first
    const orgResult = await this.lookupOrgKey(keyHash);
    if (orgResult) {
      await this.requireOrgOwnerTier(orgResult.organization_id, 'enterprise');
      await this.touchLastUsed('organization_api_keys', orgResult.id);
      return {
        orgId: orgResult.organization_id,
        scopes: orgResult.scopes ?? [],
        rateLimitRpm: orgResult.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
        keyId: orgResult.id,
        source: 'org',
      };
    }

    // 2. Check user_api_keys
    const userResult = await this.lookupUserKey(keyHash);
    if (userResult) {
      await this.requireUserTier(userResult.user_id, [
        'pro',
        'enterprise',
        'admin',
      ]);
      await this.touchLastUsed('user_api_keys', userResult.id);
      return {
        userId: userResult.user_id,
        scopes: userResult.scopes ?? [],
        rateLimitRpm: userResult.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
        keyId: userResult.id,
        source: 'user',
      };
    }

    throw new UnauthorizedException('Invalid or revoked API key');
  }

  checkScope(scopes: string[], requiredScope: string): void {
    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_SCOPE',
        message: `This API key does not have the '${requiredScope}' scope. Required: ${requiredScope}. Granted: ${scopes.join(', ') || '(none)'}`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Key lookup helpers
  // ---------------------------------------------------------------------------

  private async lookupOrgKey(keyHash: string) {
    const { data, error } = await this.supabase
      .from('organization_api_keys')
      .select('id, organization_id, scopes, rate_limit_rpm, expires_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return data;
  }

  private async lookupUserKey(keyHash: string) {
    const { data, error } = await this.supabase
      .from('user_api_keys')
      .select('id, user_id, scopes, rate_limit_rpm, expires_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return data;
  }

  // ---------------------------------------------------------------------------
  // Tier checking with Redis cache
  // ---------------------------------------------------------------------------

  private async requireOrgOwnerTier(
    orgId: string,
    requiredTier: string,
  ): Promise<void> {
    const cacheKey = `tier:org-owner:${orgId}`;
    let tier = await this.getCachedTier(cacheKey);

    if (!tier) {
      const { data } = await this.supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', orgId)
        .single();

      if (!data?.owner_id) {
        throw new ForbiddenException('Organization has no owner');
      }

      tier = await this.fetchUserTier(data.owner_id);
      await this.cacheTier(cacheKey, tier);
    }

    if (tier !== requiredTier && tier !== 'admin') {
      throw new ForbiddenException(
        "Organization owner's subscription does not include API access",
      );
    }
  }

  private async requireUserTier(
    userId: string,
    allowedTiers: string[],
  ): Promise<void> {
    const cacheKey = `tier:user:${userId}`;
    let tier = await this.getCachedTier(cacheKey);

    if (!tier) {
      tier = await this.fetchUserTier(userId);
      await this.cacheTier(cacheKey, tier);
    }

    if (!allowedTiers.includes(tier)) {
      throw new ForbiddenException('Upgrade to Pro to restore API access');
    }
  }

  private async fetchUserTier(userId: string): Promise<string> {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    return data?.subscription_tier ?? 'free';
  }

  private async getCachedTier(key: string): Promise<string | null> {
    try {
      const cached = await this.redisService.getByKey(key);
      return cached as string | null;
    } catch {
      return null;
    }
  }

  private async cacheTier(key: string, tier: string): Promise<void> {
    try {
      await this.redisService.setByKey(key, tier, TIER_CACHE_TTL_SECONDS);
    } catch {
      // Redis unavailable — skip caching
    }
  }

  // ---------------------------------------------------------------------------
  // last_used_at debounce
  // ---------------------------------------------------------------------------

  private async touchLastUsed(table: string, keyId: string): Promise<void> {
    const redisKey = `apikey:lastused:${keyId}`;
    try {
      const cached = await this.redisService.getByKey(redisKey);
      if (cached) return;
      await this.redisService.setByKey(redisKey, true, 60);
      this.supabase
        .from(table)
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId)
        .then(({ error }) => {
          if (error)
            this.logger.warn(
              `Failed to update last_used_at for ${keyId}: ${error.message}`,
            );
        });
    } catch {
      // Redis unavailable
    }
  }
}
