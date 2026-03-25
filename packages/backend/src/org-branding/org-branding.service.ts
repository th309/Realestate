/**
 * Organization Branding Service
 *
 * Manages accent color, website URL, phone, address, managing broker,
 * and public branding for organization-branded shared reports and embeds.
 *
 * Database: `organizations` table columns.
 * Logo operations are handled by OrgLogoService.
 */

import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

const BRANDING_SELECT =
  'logo_url, accent_color, name, website_url, phone, address, managing_broker';

export interface BrandingResponse {
  logo_url: string | null;
  accent_color: string | null;
  org_name: string;
  website_url: string | null;
  phone: string | null;
  address: Record<string, string> | null;
  managing_broker: string | null;
}

/** Map a raw DB row to the public BrandingResponse shape. */
function toBrandingResponse(row: Record<string, any>): BrandingResponse {
  return {
    logo_url: row.logo_url,
    accent_color: row.accent_color,
    org_name: row.name,
    website_url: row.website_url,
    phone: row.phone,
    address: row.address,
    managing_broker: row.managing_broker,
  };
}

@Injectable()
export class OrgBrandingService {
  private readonly logger = new Logger(OrgBrandingService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * Get branding for an organization (authenticated, admin-only).
   */
  async getBranding(orgId: string): Promise<BrandingResponse> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select(BRANDING_SELECT)
      .eq('id', orgId)
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to fetch branding for org ${orgId}: ${error?.message}`,
      );
      throw new NotFoundException('Organization not found');
    }

    return toBrandingResponse(data);
  }

  /**
   * Get branding for public consumption (shared reports, embeds).
   * No auth required — returns only publicly-safe fields.
   */
  async getBrandingPublic(orgId: string): Promise<BrandingResponse> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select(BRANDING_SELECT)
      .eq('id', orgId)
      .single();

    if (error || !data) {
      this.logger.warn(
        `Public branding lookup failed for org ${orgId}: ${error?.message}`,
      );
      throw new NotFoundException('Organization not found');
    }

    return toBrandingResponse(data);
  }

  /**
   * Update branding fields (accent color, website URL, phone, address,
   * managing broker).
   */
  async updateBranding(
    orgId: string,
    dto: UpdateBrandingDto,
    actorId: string,
  ): Promise<BrandingResponse> {
    const updateFields: Record<string, unknown> = {};

    if (dto.accent_color !== undefined) {
      updateFields.accent_color = dto.accent_color;
    }
    if (dto.website_url !== undefined) {
      updateFields.website_url = dto.website_url;
    }
    if (dto.phone !== undefined) {
      updateFields.phone = dto.phone;
    }
    if (dto.address !== undefined) {
      updateFields.address = dto.address;
    }
    if (dto.managing_broker !== undefined) {
      updateFields.managing_broker = dto.managing_broker;
    }

    if (Object.keys(updateFields).length === 0) {
      return this.getBranding(orgId);
    }

    const { data, error } = await this.supabase
      .from('organizations')
      .update(updateFields)
      .eq('id', orgId)
      .select(BRANDING_SELECT)
      .single();

    if (error) {
      this.logger.error(
        `Failed to update branding for org ${orgId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to update branding');
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'branding_updated',
      targetType: 'branding',
      details: updateFields,
    });

    return toBrandingResponse(data);
  }
}
