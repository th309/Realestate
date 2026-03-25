/**
 * Organizations Service
 *
 * Handles CRUD operations for organizations, including creation,
 * retrieval by slug, updates, and ownership transfer.
 *
 * All mutations are audit-logged via OrgAuditService.
 */

import {
  Injectable,
  Inject,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * Create a new organization. The caller becomes the owner and first admin member.
   * Throws ConflictException if the slug is already taken.
   */
  async create(dto: CreateOrganizationDto, ownerId: string) {
    // Reject reserved slugs that conflict with platform routes
    const RESERVED_SLUGS = [
      'billing',
      'invite',
      'api',
      'admin',
      'settings',
      'embed',
      'v1',
    ];
    if (RESERVED_SLUGS.includes(dto.slug)) {
      throw new BadRequestException('This slug is reserved and cannot be used');
    }

    // Check slug uniqueness
    const { data: existing } = await this.supabase
      .from('organizations')
      .select('id')
      .eq('slug', dto.slug)
      .maybeSingle();

    if (existing) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: `The slug "${dto.slug}" is already in use`,
      });
    }

    // Insert the organization
    const { data: org, error: orgError } = await this.supabase
      .from('organizations')
      .insert({
        name: dto.name,
        slug: dto.slug,
        owner_id: ownerId,
      })
      .select('*')
      .single();

    if (orgError) {
      if (orgError.code === '23505') {
        throw new ConflictException('SLUG_TAKEN');
      }
      this.logger.error(`Failed to create organization: ${orgError.message}`);
      throw new BadRequestException('Failed to create organization');
    }

    if (!org) {
      this.logger.error('Failed to create organization: no data returned');
      throw new BadRequestException('Failed to create organization');
    }

    // Insert the owner as an active admin member
    const { error: memberError } = await this.supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: ownerId,
        role: 'admin',
        status: 'active',
      });

    if (memberError) {
      this.logger.error(
        `Failed to add owner as admin member: ${memberError.message}`,
      );
    }

    // Audit log (never throws)
    await this.auditService.log({
      organizationId: org.id,
      actorId: ownerId,
      action: 'org_created',
      targetType: 'organization',
      targetId: org.id,
      details: { name: dto.name, slug: dto.slug },
    });

    return org;
  }

  /**
   * Find the organization a user belongs to (returns the first active membership).
   * Returns null if the user has no organization membership.
   */
  async findByUserId(userId: string) {
    const { data: membership, error } = await this.supabase
      .from('organization_members')
      .select('organization_id, role, organizations(id, name, slug)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !membership) {
      return null;
    }

    const org = (membership as any).organizations;
    return org
      ? { slug: org.slug, name: org.name, role: membership.role }
      : null;
  }

  /**
   * Retrieve an organization by its slug.
   * Throws NotFoundException if no organization matches.
   */
  async getBySlug(slug: string) {
    const { data: org, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Get the authenticated user's role in a specific organization.
   * Returns 'admin' | 'member' | null.
   */
  async getMemberRole(orgId: string, userId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return data?.role ?? null;
  }

  /**
   * Update an organization's mutable fields.
   * Only provided fields are updated; omitted fields remain unchanged.
   */
  async update(orgId: string, dto: UpdateOrganizationDto, actorId: string) {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) {
      updatePayload.name = dto.name;
    }
    if (dto.website_url !== undefined) {
      updatePayload.website_url = dto.website_url;
    }

    const { data: updated, error } = await this.supabase
      .from('organizations')
      .update(updatePayload)
      .eq('id', orgId)
      .select('*')
      .single();

    if (error || !updated) {
      this.logger.error(
        `Failed to update organization ${orgId}: ${error?.message ?? 'no data returned'}`,
      );
      throw new Error('Failed to update organization');
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'org_updated',
      targetType: 'organization',
      targetId: orgId,
      details: {
        updatedFields: Object.keys(dto).filter((k) => dto[k] !== undefined),
      },
    });

    return updated;
  }

  /**
   * Transfer organization ownership to another user.
   * The new owner must be an active admin member of the organization.
   */
  async transferOwnership(
    orgId: string,
    newOwnerId: string,
    currentOwnerId: string,
  ) {
    // Verify the caller is the actual owner
    const { data: org } = await this.supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', orgId)
      .single();

    if (!org || org.owner_id !== currentOwnerId) {
      throw new ForbiddenException(
        'Only the organization owner can transfer ownership',
      );
    }

    // Verify the new owner is an active admin member
    const { data: membership } = await this.supabase
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', orgId)
      .eq('user_id', newOwnerId)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership || membership.role !== 'admin') {
      throw new BadRequestException(
        'New owner must be an active admin member of the organization',
      );
    }

    // Update the owner
    const { error } = await this.supabase
      .from('organizations')
      .update({
        owner_id: newOwnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    if (error) {
      this.logger.error(
        `Failed to transfer ownership for org ${orgId}: ${error.message}`,
      );
      throw new Error('Failed to transfer ownership');
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId: currentOwnerId,
      action: 'ownership_transferred',
      targetType: 'organization',
      targetId: orgId,
      details: {
        previousOwnerId: currentOwnerId,
        newOwnerId,
      },
    });
  }
}
