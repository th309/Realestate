/**
 * API Key Authentication Guard
 *
 * Authenticates incoming Platform API requests using Bearer tokens
 * with the `piq_live_` prefix. On success, attaches a `ValidatedApiKey`
 * to `request.apiKeyOrg` with one of two shapes depending on key type:
 *
 *   - Org key:  { source: 'org',  orgId: string,  scopes, rateLimitRpm, keyId }
 *   - User key: { source: 'user', userId: string, scopes, rateLimitRpm, keyId }
 *
 * Usage:
 *   @UseGuards(ApiKeyAuthGuard)
 *   @Get('scores')
 *   async getScores(@Req() req) {
 *     req.apiKeyOrg.source  // 'org' | 'user'
 *     req.apiKeyOrg.orgId   // organization UUID (org keys only)
 *     req.apiKeyOrg.userId  // user UUID (user keys only)
 *     req.apiKeyOrg.scopes  // ['scores:read', ...]
 *   }
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyValidatorService } from './api-key-validator.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly validator: ApiKeyValidatorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;

    if (!authHeader?.startsWith('Bearer piq_live_')) {
      throw new UnauthorizedException(
        'Invalid API key. Expected: Authorization: Bearer piq_live_...',
      );
    }

    const rawKey = authHeader.substring(7); // Strip "Bearer "
    request.apiKeyOrg = await this.validator.validateKey(rawKey);
    return true;
  }
}
