/**
 * Platform API v1 - Liveness Controller (PUBLIC)
 *
 * A truly unauthenticated liveness/ping endpoint so integrators can verify
 * connectivity to the Platform API BEFORE they have configured an API key.
 *
 * Endpoint:
 *   GET /api/v1/health/live
 *
 * NO AUTH (by design): this returns a fixed minimal body and leaks ZERO
 * identity (no org, user, scopes, or key metadata). It is deliberately a
 * SEPARATE controller from `HealthV1Controller` so that the authenticated
 * "verify my key" probe at `GET /api/v1/health` keeps its controller-level
 * `ApiKeyAuthGuard` untouched — this controller simply omits that guard.
 *
 * The only global guard (APP_GUARD) is the rate-limiting ThrottlerGuard, which
 * does not authenticate, so omitting `ApiKeyAuthGuard` here makes the route
 * public while still applying the standard v1 response envelope + error filter.
 */

import { Controller, Get, UseInterceptors, UseFilters } from '@nestjs/common';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { PlatformApiExceptionFilter } from '../platform-api-exception.filter';

@Controller('api/v1/health')
@UseFilters(PlatformApiExceptionFilter)
@UseInterceptors(ApiResponseInterceptor)
export class HealthLivenessV1Controller {
  /**
   * GET /api/v1/health/live
   *
   * Public liveness probe. Returns a fixed `{ status: 'ok' }` payload (wrapped
   * in the standard v1 `{ data, meta }` envelope by ApiResponseInterceptor).
   * No API key required and no caller identity is exposed.
   */
  @Get('live')
  getLiveness() {
    return { status: 'ok' };
  }
}
