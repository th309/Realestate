/**
 * Organization Embeds Service
 *
 * Manages embed token lifecycle: creation, validation, updating, and revocation.
 * Tokens follow the format `emb_<48-hex-chars>` and are shown in full only once
 * at creation time. Validation checks token status, org embed_enabled flag,
 * origin allowlist (with wildcard support), and widget type permissions.
 */

import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { CreateEmbedTokenDto } from './dto/create-embed-token.dto';
import { UpdateEmbedTokenDto } from './dto/update-embed-token.dto';

export interface EmbedTokenRecord {
  id: string;
  organization_id: string;
  name: string;
  token: string;
  allowed_origins: string[];
  widget_types: string[];
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface EmbedValidationResult {
  orgId: string;
  branding: {
    logo_url: string | null;
    accent_color: string | null;
    org_name: string;
    website_url: string | null;
  };
}

@Injectable()
export class OrgEmbedsService {
  private readonly logger = new Logger(OrgEmbedsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * List all active embed tokens for an organization.
   * Token values are masked — only the first 8 characters are shown.
   */
  async listTokens(orgId: string): Promise<Omit<EmbedTokenRecord, 'token'>[]> {
    const { data, error } = await this.supabase
      .from('organization_embed_tokens')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
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
   * Update an existing embed token's name, allowed origins, or widget types.
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
   * Validate an embed token for a widget request.
   *
   * Checks:
   * 1. Token exists and is active
   * 2. Organization has embeds enabled
   * 3. Request origin matches allowed_origins (supports wildcards)
   * 4. Widget type is permitted for this token
   *
   * Returns org branding info on success.
   */
  async validateToken(
    tokenValue: string,
    origin: string,
    widgetType: string,
  ): Promise<EmbedValidationResult> {
    // Look up token and join with organization data
    const { data: tokenRow, error } = await this.supabase
      .from('organization_embed_tokens')
      .select(
        `
        id,
        organization_id,
        allowed_origins,
        widget_types,
        organizations!inner (
          id,
          name,
          embed_enabled,
          logo_url,
          accent_color,
          website_url
        )
      `,
      )
      .eq('token', tokenValue)
      .eq('is_active', true)
      .single();

    if (error || !tokenRow) {
      throw new UnauthorizedException('Invalid or expired embed token');
    }

    // Extract org data from the join (Supabase returns as object for !inner)
    const org = tokenRow.organizations as any;

    if (!org?.embed_enabled) {
      throw new ForbiddenException(
        'Embeds are not enabled for this organization',
      );
    }

    // Check origin against allowed_origins
    const allowedOrigins = tokenRow.allowed_origins as string[];
    if (origin && !this.matchOrigin(origin, allowedOrigins)) {
      throw new ForbiddenException('ORIGIN_NOT_ALLOWED');
    }

    // Check widget type
    const allowedWidgets = tokenRow.widget_types as string[];
    if (
      widgetType &&
      widgetType !== 'unknown' &&
      !allowedWidgets.includes(widgetType)
    ) {
      throw new ForbiddenException('WIDGET_TYPE_NOT_ALLOWED');
    }

    return {
      orgId: tokenRow.organization_id,
      branding: {
        logo_url: org.logo_url ?? null,
        accent_color: org.accent_color ?? null,
        org_name: org.name,
        website_url: org.website_url ?? null,
      },
    };
  }

  /**
   * Match a request origin against the allowed origins list.
   * Supports wildcard patterns like `*.example.com`.
   */
  private matchOrigin(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.some((allowed) => {
      if (allowed === origin) return true;
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return (
          origin.endsWith(domain) &&
          (origin === domain ||
            origin.charAt(origin.length - domain.length - 1) === '.')
        );
      }
      return false;
    });
  }
}
