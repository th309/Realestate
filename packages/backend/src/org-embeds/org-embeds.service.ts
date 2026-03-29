/**
 * Organization Embeds Service
 *
 * Manages embed token lifecycle: creation, validation, updating, and revocation.
 * Tokens follow the format `emb_<48-hex-chars>` and are shown in full only once
 * at creation time. Token validation is delegated to EmbedTokenValidatorService.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { CreateEmbedTokenDto } from './dto/create-embed-token.dto';
import { UpdateEmbedTokenDto } from './dto/update-embed-token.dto';
import { EmbedTokenValidatorService } from './embed-token-validator.service';
import { EmbedTokenRecord, EmbedValidationResult } from './embed-token.types';

export type { EmbedTokenRecord, EmbedValidationResult };

@Injectable()
export class OrgEmbedsService {
  private readonly logger = new Logger(OrgEmbedsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
    private readonly tokenValidator: EmbedTokenValidatorService,
  ) {}

  /**
   * List all active, published (non-draft) embed tokens for an organization.
   * Token values are masked — only the first 12 characters are shown.
   */
  async listTokens(orgId: string): Promise<Omit<EmbedTokenRecord, 'token'>[]> {
    const { data, error } = await this.supabase
      .from('organization_embed_tokens')
      .select(
        'id, organization_id, name, token, allowed_origins, widget_types, created_by, is_active, is_draft, embed_config, created_at',
      )
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .eq('is_draft', false)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list embed tokens for org ${orgId}: ${error.message}`,
      );
      return [];
    }

    // Mask tokens — show only the prefix for identification
    return (data ?? []).map((row) => ({
      ...row,
      token: `${row.token.substring(0, 12)}...`,
    }));
  }

  /**
   * Create a new embed token. The full token value is returned ONCE.
   * Subsequent list calls will show a masked version.
   */
  async createToken(
    orgId: string,
    dto: CreateEmbedTokenDto,
    createdBy: string,
  ): Promise<EmbedTokenRecord> {
    const tokenValue = `emb_${randomBytes(24).toString('hex')}`;

    const { data, error } = await this.supabase
      .from('organization_embed_tokens')
      .insert({
        organization_id: orgId,
        name: dto.name,
        token: tokenValue,
        allowed_origins: dto.allowed_origins,
        widget_types: dto.widget_types,
        created_by: createdBy,
        is_active: true,
        is_draft: dto.is_draft ?? false,
        embed_config: dto.embed_config ?? null,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(
        `Failed to create embed token for org ${orgId}: ${error.message}`,
      );
      throw new Error(`Failed to create embed token: ${error.message}`);
    }

    // Audit log (fire-and-forget)
    this.auditService.log({
      organizationId: orgId,
      actorId: createdBy,
      action: 'embed_token_created',
      targetType: 'embed_token',
      targetId: data.id,
      details: {
        name: dto.name,
        allowed_origins: dto.allowed_origins,
        widget_types: dto.widget_types,
      },
    });

    return data as EmbedTokenRecord;
  }

  /**
   * Update an existing embed token's name, allowed origins, widget types,
   * draft status, or embed config.
   */
  async updateToken(
    orgId: string,
    tokenId: string,
    dto: UpdateEmbedTokenDto,
  ): Promise<EmbedTokenRecord> {
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.allowed_origins !== undefined)
      updatePayload.allowed_origins = dto.allowed_origins;
    if (dto.widget_types !== undefined)
      updatePayload.widget_types = dto.widget_types;
    if (dto.is_draft !== undefined) updatePayload.is_draft = dto.is_draft;
    if (dto.embed_config !== undefined)
      updatePayload.embed_config = dto.embed_config;

    const { data, error } = await this.supabase
      .from('organization_embed_tokens')
      .update(updatePayload)
      .eq('id', tokenId)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .select('*')
      .single();

    if (error) {
      this.logger.error(
        `Failed to update embed token ${tokenId}: ${error.message}`,
      );
      throw new Error(`Failed to update embed token: ${error.message}`);
    }

    // Mask token in the response
    return {
      ...data,
      token: `${data.token.substring(0, 12)}...`,
    } as EmbedTokenRecord;
  }

  /**
   * Revoke (soft-delete) an embed token. Sets is_active = false.
   */
  async revokeToken(
    orgId: string,
    tokenId: string,
    actorId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('organization_embed_tokens')
      .update({ is_active: false })
      .eq('id', tokenId)
      .eq('organization_id', orgId);

    if (error) {
      this.logger.error(
        `Failed to revoke embed token ${tokenId}: ${error.message}`,
      );
      throw new Error(`Failed to revoke embed token: ${error.message}`);
    }

    // Audit log (fire-and-forget)
    this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'embed_token_revoked',
      targetType: 'embed_token',
      targetId: tokenId,
    });
  }

  /**
   * Validate an embed token for a widget request. Delegates to
   * EmbedTokenValidatorService which handles origin and widget-type checks.
   */
  async validateToken(
    tokenValue: string,
    origin: string,
    widgetType: string,
  ): Promise<EmbedValidationResult> {
    return this.tokenValidator.validateToken(tokenValue, origin, widgetType);
  }
}
