/**
 * Admin Authentication Guard
 *
 * Validates the JWT via the existing JwtAuthGuard logic, then checks that
 * the authenticated user has an admin or super_admin role in the
 * `admin_users` table.  Attaches `request.adminRole` on success.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SupabaseService } from '../../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

const ALLOWED_ADMIN_ROLES = ['admin', 'super_admin'] as const;

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);
  private readonly jwtAuthGuard: JwtAuthGuard;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    // Reuse the existing JWT validation by composing with JwtAuthGuard
    this.jwtAuthGuard = new JwtAuthGuard(configService, supabaseService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Step 1: Validate the JWT and set request.userId
    await this.jwtAuthGuard.canActivate(context);

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.userId;

    if (!userId) {
      throw new ForbiddenException('Admin access denied: no authenticated user');
    }

    // Step 2: Check the admin_users table for this user
    const supabase = this.supabaseService.getClient();
    const { data: adminRow, error } = await supabase
      .from('admin_users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !adminRow) {
      this.logger.warn(
        `[AdminGuard] Access denied for user ${userId.substring(0, 8)}... — no admin_users row`,
      );
      throw new ForbiddenException('Admin access denied: user is not an admin');
    }

    if (!ALLOWED_ADMIN_ROLES.includes(adminRow.role)) {
      this.logger.warn(
        `[AdminGuard] Access denied for user ${userId.substring(0, 8)}... — role "${adminRow.role}" is not permitted`,
      );
      throw new ForbiddenException('Admin access denied: insufficient admin role');
    }

    // Step 3: Attach admin role to request for downstream use
    request.adminRole = adminRow.role;

    this.logger.debug(
      `[AdminGuard] Granted ${adminRow.role} access to user ${userId.substring(0, 8)}...`,
    );

    return true;
  }
}
