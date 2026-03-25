/**
 * Organization Slug Service
 *
 * Handles slug validation, uniqueness checks, redirect management,
 * and slug resolution for organization renames.
 *
 * When an org slug changes, old URLs continue to resolve for 30 days
 * via the `organization_slug_redirects` table.
 */

import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

/** Slugs that conflict with platform routes and cannot be used by orgs. */
export const RESERVED_SLUGS = [
  'billing',
  'invite',
  'api',
  'admin',
  'settings',
  'embed',
  'v1',
];

/** How many days old-slug redirects stay active. */
const REDIRECT_TTL_DAYS = 30;

@Injectable()
export class OrgSlugService {
  private readonly logger = new Logger(OrgSlugService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Validate that a slug is not reserved and not already taken
   * by another organization or an active redirect.
   * Throws ConflictException / BadRequestException on failure.
   */
  async validateSlugAvailability(slug: string): Promise<void> {
    if (RESERVED_SLUGS.includes(slug)) {
      throw new BadRequestException('This slug is reserved and cannot be used');
    }

    // Check uniqueness against existing organizations
    const { data: existingOrg } = await this.supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingOrg) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: `The slug "${slug}" is already in use`,
      });
    }

    // Check no active redirect already points to the new slug
    const { data: existingRedirect } = await this.supabase
      .from('organization_slug_redirects')
      .select('id')
      .eq('new_slug', slug)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingRedirect) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: `The slug "${slug}" is reserved by an active redirect`,
      });
    }
  }

  /**
   * Record a slug change: expire old redirects for the previous slug,
   * then insert a new redirect from oldSlug → newSlug with a 30-day TTL.
   */
  async recordSlugChange(
    orgId: string,
    oldSlug: string,
    newSlug: string,
  ): Promise<void> {
    // Expire any existing active redirects for the OLD slug
    await this.supabase
      .from('organization_slug_redirects')
      .update({ expires_at: new Date().toISOString() })
      .eq('old_slug', oldSlug)
      .gt('expires_at', new Date().toISOString());

    // Insert a redirect from old slug → new slug
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REDIRECT_TTL_DAYS);

    const { error } = await this.supabase
      .from('organization_slug_redirects')
      .insert({
        organization_id: orgId,
        old_slug: oldSlug,
        new_slug: newSlug,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      this.logger.error(
        `Failed to create slug redirect for org ${orgId}: ${error.message}`,
      );
      throw new Error('Failed to create slug redirect');
    }
  }

  /**
   * Resolve an old slug to its current replacement via the redirect table.
   * Returns the new slug if an active (non-expired) redirect exists, null otherwise.
   */
  async resolveSlug(slug: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('organization_slug_redirects')
      .select('new_slug')
      .eq('old_slug', slug)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data?.new_slug ?? null;
  }
}
