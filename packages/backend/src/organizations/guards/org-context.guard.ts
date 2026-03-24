/**
 * Organization Context Guard
 *
 * Runs AFTER JwtAuthGuard in the guard chain. Extracts the org slug from
 * the URL path, loads the organization record, and resolves the
 * authenticated user's membership role within that org.
 *
 * Sets on the request:
 *   - request.org   — the organization row (or undefined if no slug in path)
 *   - request.orgRole — the user's role string ('admin' | 'member' | 'viewer') or null
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class OrgContextGuard implements CanActivate {
  private readonly logger = new Logger(OrgContextGuard.name);

  /** Path segments under /api/org/ that are NOT org slugs. */
  private static readonly SKIP_PATHS = ['billing', 'invite'];

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.userId;

    // Extract slug from /api/org/:slug/...
    const slugMatch = request.path.match(/^\/api\/org\/([^/]+)/);
    if (!slugMatch) return true;

    const slug = slugMatch[1];
    if (OrgContextGuard.SKIP_PATHS.includes(slug)) return true;

    const client = this.supabaseService.getClient();

    const { data: org, error: orgError } = await client
      .from('organizations')
      .select(
        'id, name, slug, owner_id, seat_limit, extra_seats, billing_status, api_enabled, embed_enabled',
      )
      .eq('slug', slug)
      .single();

    if (orgError || !org) {
      this.logger.debug(
        `Organization not found for slug "${slug}": ${orgError?.message ?? 'no rows'}`,
      );
      throw new NotFoundException('Organization not found');
    }

    request.org = org;

    // Resolve membership if the user is authenticated
    if (userId) {
      const { data: membership } = await client
        .from('organization_members')
        .select('role, status')
        .eq('organization_id', org.id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      request.orgRole = membership?.role || null;
    }

    return true;
  }
}
