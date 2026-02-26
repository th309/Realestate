/**
 * Reusable JWT Authentication Guard
 *
 * Validates Bearer tokens via Supabase Auth and sets `request.userId`.
 * A valid Bearer token is REQUIRED — there is no fallback.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Check Bearer token (JWT from Supabase Auth) — preferred method
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const result = await this.validateSupabaseJwt(token);

      if (result.valid && result.userId) {
        request.userId = result.userId;
        return true;
      }

      throw new UnauthorizedException(result.error || 'Invalid token');
    }

    // No valid Bearer token provided
    throw new UnauthorizedException('Authentication required');
  }

  private async validateSupabaseJwt(
    token: string,
  ): Promise<{ valid: boolean; userId?: string; error?: string }> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        this.logger.debug(`[JwtAuth] JWT validation failed: ${error.message}`);
        return { valid: false, error: this.mapAuthError(error.message) };
      }

      if (!data.user) {
        return { valid: false, error: 'No user found for token' };
      }

      return { valid: true, userId: data.user.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`[JwtAuth] JWT validation error: ${message}`);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  private mapAuthError(errorMessage: string): string {
    const lower = errorMessage.toLowerCase();
    if (lower.includes('expired')) return 'Token has expired';
    if (lower.includes('invalid')) return 'Invalid token';
    if (lower.includes('malformed')) return 'Malformed token';
    return 'Authentication failed';
  }
}
