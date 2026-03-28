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
import { EmbedValidationResult } from './embed-token.types';

@Injectable()
export class EmbedTokenValidatorService {
  private readonly logger = new Logger(EmbedTokenValidatorService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
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
