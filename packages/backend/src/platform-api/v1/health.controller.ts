/**
 * Platform API v1 - Health Controller
 *
 * Validates an API key and returns the org's identity + key metadata.
 * Useful for verifying a key works without consuming a rate-limited endpoint.
 *
 * Endpoint:
 *   GET /api/v1/health
 *
 * AUTH REQUIRED (by design): this is a "verify my key" probe, not an anonymous
 * liveness check — it returns the caller's org/user identity and active scopes,
 * so it must authenticate (401 without a valid key). It is NOT rate-throttled.
 * If a truly public, key-less liveness/ping is ever needed, add a separate
 * unauthenticated endpoint rather than weakening this one.
 */

import {
  Controller,
  Get,
  Req,
  UseGuards,
  UseInterceptors,
  UseFilters,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { PlatformApiExceptionFilter } from '../platform-api-exception.filter';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

@Controller('api/v1/health')
@UseFilters(PlatformApiExceptionFilter)
@UseGuards(ApiKeyAuthGuard)
@UseInterceptors(ApiResponseInterceptor)
export class HealthV1Controller {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * GET /api/v1/health
   *
   * Returns org name, active scopes, rate limit, and key expiry.
   */
  @Get()
  async getHealth(@Req() request: any) {
    const { orgId, userId, scopes, rateLimitRpm, source } = request.apiKeyOrg;

    let ownerName: string | null = null;

    if (source === 'org' && orgId) {
      const { data: org } = await this.supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      ownerName = org?.name ?? null;
    } else if (source === 'user' && userId) {
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();
      ownerName = profile?.full_name || profile?.email || null;
    }

    return {
      status: 'ok',
      key_type: source,
      organization: source === 'org' ? ownerName : undefined,
      user: source === 'user' ? ownerName : undefined,
      scopes,
      rate_limit_rpm: rateLimitRpm,
      expires_at: null,
    };
  }
}
