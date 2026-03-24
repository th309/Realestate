/**
 * Organization API Keys Service
 *
 * CRUD operations for Platform API keys: creation with SHA-256 hashing,
 * listing (prefix-only), updating, and revocation. The raw key is returned
 * exactly once at creation time and is never stored or retrievable afterward.
 *
 * Runtime validation and scope checking are handled by ApiKeyValidatorService.
 *
 * Depends on:
 *   - Supabase `organization_api_keys` table
 *   - OrgAuditService for action logging
 */

import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

/** Fields returned when listing keys (never includes hash or full key). */
export interface ApiKeyListItem {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_RATE_LIMIT_RPM = 60;

const TABLE = 'organization_api_keys';

/** Columns selected for list/create/update responses (no key_hash). */
const LIST_COLUMNS =
  'id, organization_id, name, key_prefix, scopes, rate_limit_rpm, last_used_at, expires_at, created_by, is_active, created_at';

@Injectable()
export class OrgApiKeysService {
  private readonly logger = new Logger(OrgApiKeysService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
  ) {}

  /** List all active API keys for an organization (prefix only, no hashes). */
  async listKeys(orgId: string): Promise<ApiKeyListItem[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(LIST_COLUMNS)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list API keys for org ${orgId}: ${error.message}`,
      );
      return [];
    }

    return (data ?? []) as ApiKeyListItem[];
  }

  /**
   * Create a new API key. Returns the full key ONCE — callers must display
   * it to the user immediately; it cannot be retrieved later.
   */
  async createKey(
    orgId: string,
    dto: CreateApiKeyDto,
    createdBy: string,
  ): Promise<ApiKeyListItem & { key: string }> {
    const fullKey = `piq_live_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(fullKey).digest('hex');
    const keyPrefix = fullKey.substring(0, 12);

    const row = {
      organization_id: orgId,
      name: dto.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: dto.scopes,
      rate_limit_rpm: dto.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM,
      created_by: createdBy,
      is_active: true,
    };

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(row)
      .select(LIST_COLUMNS)
      .single();

    if (error) {
      this.logger.error(
        `Failed to create API key for org ${orgId}: ${error.message}`,
      );
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    // Audit (fire-and-forget — OrgAuditService never throws)
    this.auditService.log({
      organizationId: orgId,
      actorId: createdBy,
      action: 'api_key_created',
      targetType: 'api_key',
      targetId: data.id,
      details: { name: dto.name, scopes: dto.scopes },
    });

    return { ...(data as ApiKeyListItem), key: fullKey };
  }

  /** Update mutable fields (name, scopes, rate_limit_rpm) on an active key. */
  async updateKey(
    orgId: string,
    keyId: string,
    dto: UpdateApiKeyDto,
  ): Promise<ApiKeyListItem> {
    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.scopes !== undefined) updates.scopes = dto.scopes;
    if (dto.rate_limit_rpm !== undefined)
      updates.rate_limit_rpm = dto.rate_limit_rpm;

    if (Object.keys(updates).length === 0) {
      throw new NotFoundException('No fields to update');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('id', keyId)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .select(LIST_COLUMNS)
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update API key ${keyId} for org ${orgId}: ${error?.message ?? 'not found'}`,
      );
      throw new NotFoundException('API key not found or already revoked');
    }

    return data as ApiKeyListItem;
  }

  /** Soft-delete an API key by setting is_active = false. */
  async revokeKey(
    orgId: string,
    keyId: string,
    actorId: string,
  ): Promise<void> {
    const { error, count } = await this.supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('organization_id', orgId)
      .eq('is_active', true);

    if (error) {
      this.logger.error(
        `Failed to revoke API key ${keyId} for org ${orgId}: ${error.message}`,
      );
      throw new NotFoundException('API key not found or already revoked');
    }

    if (count === 0) {
      throw new NotFoundException('API key not found or already revoked');
    }

    // Audit (fire-and-forget)
    this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'api_key_revoked',
      targetType: 'api_key',
      targetId: keyId,
    });
  }
}
