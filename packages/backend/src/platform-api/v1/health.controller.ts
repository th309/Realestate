/**
 * Platform API v1 - Health Controller
 *
 * Validates an API key and returns the org's identity + key metadata.
 * Useful for verifying a key works without consuming a rate-limited endpoint.
 *
 * Endpoint:
 *   GET /api/v1/health
 *
 * No ApiThrottleGuard — this endpoint is intentionally free for debugging.
 */

import {
  Controller,
  Get,
  Req,
  UseGuards,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

@Controller('api/v1/health')
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
    const { orgId, scopes, rateLimitRpm, keyId } = request.apiKeyOrg;

    const { data: org } = await this.supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    return {
      status: 'ok',
      organization: org?.name ?? null,
      scopes,
      rate_limit_rpm: rateLimitRpm,
      expires_at: null,
    };
  }
}
