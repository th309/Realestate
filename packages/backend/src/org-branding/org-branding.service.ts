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

const BRANDING_SELECT = [
  'logo_url',
  'accent_color',
  'name',
  'website_url',
  'phone',
  'address',
  'managing_broker',
  'report_header_text',
  'report_footer_text',
  'report_disclaimer',
  'powered_by_visible',
  'support_email',
  'email_from_name',
  'email_reply_to',
  'custom_subdomain',
  'custom_domain_status',
  'custom_domain_verified_at',
  'favicon_url',
  'tab_title_format',
  'primary_font',
  'secondary_font',
  'welcome_message',
  'custom_tos_url',
  'custom_privacy_url',
  'display_name',
  'department_label',
  'default_member_role',
].join(', ');

export interface BrandingResponse {
  logo_url: string | null;
  accent_color: string | null;
  org_name: string;
  website_url: string | null;
  phone: string | null;
  address: Record<string, string> | null;
  managing_broker: string | null;
  report_header_text: string | null;
  report_footer_text: string | null;
  report_disclaimer: string | null;
  powered_by_visible: boolean;
  support_email: string | null;
  email_from_name: string | null;
  email_reply_to: string | null;
  custom_subdomain: string | null;
  custom_domain_status: string | null;
  custom_domain_verified_at: string | null;
  favicon_url: string | null;
  tab_title_format: string | null;
  primary_font: string;
  secondary_font: string;
  welcome_message: string | null;
  custom_tos_url: string | null;
  custom_privacy_url: string | null;
  display_name: string | null;
  department_label: string | null;
  default_member_role: string;
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
    report_header_text: row.report_header_text,
    report_footer_text: row.report_footer_text,
    report_disclaimer: row.report_disclaimer,
    powered_by_visible: row.powered_by_visible ?? true,
    support_email: row.support_email,
    email_from_name: row.email_from_name,
    email_reply_to: row.email_reply_to,
    custom_subdomain: row.custom_subdomain,
    custom_domain_status: row.custom_domain_status ?? 'pending',
    custom_domain_verified_at: row.custom_domain_verified_at,
    favicon_url: row.favicon_url,
    tab_title_format: row.tab_title_format,
    primary_font: row.primary_font ?? 'Roboto',
    secondary_font: row.secondary_font ?? 'Roboto',
    welcome_message: row.welcome_message,
    custom_tos_url: row.custom_tos_url,
    custom_privacy_url: row.custom_privacy_url,
    display_name: row.display_name,
    department_label: row.department_label,
    default_member_role: row.default_member_role ?? 'member',
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
   * managing broker, reports, email, subdomain, fonts, and more).
   */
  async updateBranding(
    orgId: string,
    dto: UpdateBrandingDto,
    actorId: string,
  ): Promise<BrandingResponse> {
    const updateFields: Record<string, unknown> = {};

    const directFields: (keyof UpdateBrandingDto)[] = [
      'accent_color',
      'website_url',
      'phone',
      'address',
      'managing_broker',
      'report_header_text',
      'report_footer_text',
      'report_disclaimer',
      'powered_by_visible',
      'support_email',
      'email_from_name',
      'email_reply_to',
      'custom_subdomain',
      'favicon_url',
      'tab_title_format',
      'primary_font',
      'secondary_font',
      'welcome_message',
      'custom_tos_url',
      'custom_privacy_url',
      'display_name',
      'department_label',
      'default_member_role',
    ];

    for (const field of directFields) {
      if (dto[field] !== undefined) {
        updateFields[field] = dto[field];
      }
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
