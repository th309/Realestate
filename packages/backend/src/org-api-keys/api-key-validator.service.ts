/**
 * API Key Validator Service
 *
 * Handles runtime validation of Platform API keys: SHA-256 hash lookup,
 * expiration checking, scope enforcement, and debounced last_used_at
 * updates via Redis.
 *
 * Separated from OrgApiKeysService (CRUD) per file-size limits and
 * single-responsibility principle.
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

/** Result of a successful key validation at request time. */
export interface ValidatedApiKey {
  orgId: string;
  scopes: string[];
  rateLimitRpm: number;
  keyId: string;
}

const DEFAULT_RATE_LIMIT_RPM = 60;

/** Debounce window (seconds) for updating last_used_at in the database. */
const LAST_USED_DEBOUNCE_SECONDS = 60;

const TABLE = 'organization_api_keys';

@Injectable()
export class ApiKeyValidatorService {
  private readonly logger = new Logger(ApiKeyValidatorService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Validate a raw API key. Hashes it with SHA-256, looks up the active
   * record, checks expiration, and debounces the last_used_at timestamp
   * update via Redis to avoid write-per-request load.
   */
  async validateKey(rawKey: string): Promise<ValidatedApiKey> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const { data, error } = await this.supabase
      .from(TABLE)
      .select('id, organization_id, scopes, rate_limit_rpm, expires_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Debounce last_used_at update: only write to DB once per 60 seconds
    await this.touchLastUsed(data.id);

    return {
      orgId: data.organization_id,
      scopes: data.scopes ?? [],
      rateLimitRpm: data.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
      keyId: data.id,
    };
  }

  /**
   * Verify that the key's scopes include the required scope.
   * Throws ForbiddenException with a structured error if not.
   */
  checkScope(scopes: string[], requiredScope: string): void {
    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_SCOPE',
        message: `This API key does not have the '${requiredScope}' scope. Required: ${requiredScope}. Granted: ${scopes.join(', ') || '(none)'}`,
      });
    }
  }

  /**
   * Debounced last_used_at update. Uses a Redis key with a 60-second TTL
   * so the database is only updated at most once per minute per key.
   */
  private async touchLastUsed(keyId: string): Promise<void> {
    const redisKey = `apikey:lastused:${keyId}`;

    try {
      const cached = await this.redisService.getByKey(redisKey);
      if (cached) return; // Already touched within the debounce window

      // Set Redis marker before DB write to avoid races
      await this.redisService.setByKey(
        redisKey,
        true,
        LAST_USED_DEBOUNCE_SECONDS,
      );

      // Fire-and-forget DB update
      this.supabase
        .from(TABLE)
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId)
        .then(({ error }) => {
          if (error) {
            this.logger.warn(
              `Failed to update last_used_at for key ${keyId}: ${error.message}`,
            );
          }
        });
    } catch (err) {
      // Redis unavailable — skip debounce, still do the DB update
      this.logger.debug(`Redis unavailable for lastused debounce: ${err}`);
    }
  }
}
