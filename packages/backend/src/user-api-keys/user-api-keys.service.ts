/**
 * User API Keys Service
 *
 * CRUD for personal API keys (Pro tier). Mirrors OrgApiKeysService
 * but keyed on user_id instead of organization_id.
 */

import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { CreateUserApiKeyDto } from './dto/create-user-api-key.dto';

export interface UserApiKeyListItem {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_RATE_LIMIT_RPM = 60;
const TABLE = 'user_api_keys';
const LIST_COLUMNS =
  'id, user_id, name, key_prefix, scopes, rate_limit_rpm, last_used_at, expires_at, is_active, created_at';

@Injectable()
export class UserApiKeysService {
  private readonly logger = new Logger(UserApiKeysService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** List all active API keys for a user (prefix only, no hashes). */
  async listKeys(userId: string): Promise<UserApiKeyListItem[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(LIST_COLUMNS)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list keys for user ${userId}: ${error.message}`,
      );
      return [];
    }

    return (data ?? []) as UserApiKeyListItem[];
  }

  /**
   * Create a new personal API key. Returns the full key ONCE — callers must
   * display it to the user immediately; it cannot be retrieved later.
   */
  async createKey(
    userId: string,
    dto: CreateUserApiKeyDto,
  ): Promise<UserApiKeyListItem & { key: string }> {
    const fullKey = `piq_live_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(fullKey).digest('hex');
    const keyPrefix = fullKey.substring(0, 12);

    const row = {
      user_id: userId,
      name: dto.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: dto.scopes,
      rate_limit_rpm: dto.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
      is_active: true,
    };

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(row)
      .select(LIST_COLUMNS)
      .single();

    if (error) {
      this.logger.error(
        `Failed to create key for user ${userId}: ${error.message}`,
      );
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    return { ...(data as UserApiKeyListItem), key: fullKey };
  }

  /** Soft-delete a personal API key by setting is_active = false. */
  async revokeKey(userId: string, keyId: string): Promise<void> {
    const { error, count } = await this.supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      this.logger.error(
        `Failed to revoke key ${keyId} for user ${userId}: ${error.message}`,
      );
      throw new NotFoundException('API key not found or already revoked');
    }

    if (count === 0) {
      throw new NotFoundException('API key not found or already revoked');
    }
  }
}
