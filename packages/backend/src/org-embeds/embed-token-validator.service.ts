/**
 * Embed Token Validator Service
 *
 * Handles token validation for widget requests: checks token status,
 * org embed_enabled flag, origin allowlist (with wildcard and global
 * wildcard support), and widget type permissions.
 */

import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import { EmbedValidationResult } from './embed-token.types';

@Injectable()
export class EmbedTokenValidatorService {
  private readonly logger = new Logger(EmbedTokenValidatorService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redisService: RedisService,
  ) {}

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

    await this.requireEnterpriseTier(tokenRow.organization_id);

    const allowedOrigins = tokenRow.allowed_origins as string[];
    if (origin && !this.matchOrigin(origin, allowedOrigins)) {
      throw new ForbiddenException('ORIGIN_NOT_ALLOWED');
    }

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
   * Verify the org owner holds an enterprise or admin subscription tier.
   * Uses Redis cache (key: `tier:org-owner:{orgId}`, TTL: 5 min) to avoid
   * repeated DB lookups per request. Falls through to DB if Redis is down.
   */
  private async requireEnterpriseTier(orgId: string): Promise<void> {
    const cacheKey = `tier:org-owner:${orgId}`;

    try {
      const cached = await this.redisService.getByKey(cacheKey);
      if (cached && (cached === 'enterprise' || cached === 'admin')) return;
      if (cached) {
        throw new ForbiddenException(
          'Embeds require an Enterprise subscription',
        );
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      // Redis unavailable — fall through to DB check
    }

    const { data: org } = await this.supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', orgId)
      .single();

    if (!org?.owner_id) {
      throw new ForbiddenException('Organization has no owner');
    }

    const { data: profile } = await this.supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', org.owner_id)
      .single();

    const tier = profile?.subscription_tier ?? 'free';

    try {
      await this.redisService.setByKey(cacheKey, tier, 300);
    } catch {
      // Redis unavailable
    }

    if (tier !== 'enterprise' && tier !== 'admin') {
      throw new ForbiddenException('Embeds require an Enterprise subscription');
    }
  }

  /**
   * Match a request origin against the allowed origins list.
   * Supports `*` (allow all) and wildcard patterns like `*.example.com`.
   */
  private matchOrigin(origin: string, allowedOrigins: string[]): boolean {
    if (allowedOrigins.includes('*')) return true;
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
