/**
 * Optional JWT guard — for endpoints that serve BOTH anonymous and
 * authenticated callers from a single route (e.g. analyzer prefill).
 *
 * If a valid Bearer token is present it sets `request.userId`; otherwise the
 * request proceeds anonymously. It NEVER throws — an invalid/expired token is
 * treated as anonymous, not a 401. (Mirrors JwtAuthGuard's validation, minus
 * the hard requirement.)
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return true; // anonymous
    }

    const token = authHeader.substring(7);
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        request.userId = data.user.id;
      } else {
        this.logger.debug(
          '[OptionalJwtAuth] token present but invalid — proceeding anonymously',
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.debug(
        `[OptionalJwtAuth] validation error, proceeding anonymously: ${message}`,
      );
    }
    return true;
  }
}
