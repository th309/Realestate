/**
 * Organization Branding Service
 *
 * Manages logo upload/delete, accent color, and public branding
 * for organization-branded shared reports and embeds.
 *
 * Storage: Supabase Storage bucket `org-logos` (public read).
 * Database: `organizations` table columns: logo_url, accent_color, website_url, name.
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

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const LOGO_BUCKET = 'org-logos';

export interface BrandingResponse {
  logo_url: string | null;
  accent_color: string | null;
  org_name: string;
  website_url: string | null;
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
      .select('logo_url, accent_color, name, website_url')
      .eq('id', orgId)
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to fetch branding for org ${orgId}: ${error?.message}`,
      );
      throw new NotFoundException('Organization not found');
    }

    return {
      logo_url: data.logo_url,
      accent_color: data.accent_color,
      org_name: data.name,
      website_url: data.website_url,
    };
  }

  /**
   * Get branding for public consumption (shared reports, embeds).
   * No auth required — returns only publicly-safe fields.
   */
  async getBrandingPublic(orgId: string): Promise<BrandingResponse> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('logo_url, accent_color, name, website_url')
      .eq('id', orgId)
      .single();

    if (error || !data) {
      this.logger.warn(
        `Public branding lookup failed for org ${orgId}: ${error?.message}`,
      );
      throw new NotFoundException('Organization not found');
    }

    return {
      logo_url: data.logo_url,
      accent_color: data.accent_color,
      org_name: data.name,
      website_url: data.website_url,
    };
  }

  /**
   * Update accent color and/or website URL.
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

    if (Object.keys(updateFields).length === 0) {
      return this.getBranding(orgId);
    }

    const { data, error } = await this.supabase
      .from('organizations')
      .update(updateFields)
      .eq('id', orgId)
      .select('logo_url, accent_color, name, website_url')
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

    return {
      logo_url: data.logo_url,
      accent_color: data.accent_color,
      org_name: data.name,
      website_url: data.website_url,
    };
  }

  /**
   * Upload organization logo to Supabase Storage.
   *
   * Validates MIME type, uploads to `org-logos/{orgId}/logo.{ext}`,
   * and updates the organizations table with the public URL.
   */
  async uploadLogo(
    orgId: string,
    file: Express.Multer.File,
    actorId: string,
  ): Promise<{ logo_url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const ext = MIME_TO_EXT[file.mimetype];
    const storagePath = `${orgId}/logo.${ext}`;

    const { error: uploadError } = await this.supabase.storage
      .from(LOGO_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      this.logger.error(
        `Failed to upload logo for org ${orgId}: ${uploadError.message}`,
      );
      throw new BadRequestException('Failed to upload logo');
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(LOGO_BUCKET).getPublicUrl(storagePath);

    const { error: updateError } = await this.supabase
      .from('organizations')
      .update({ logo_url: publicUrl })
      .eq('id', orgId);

    if (updateError) {
      this.logger.error(
        `Failed to update logo_url for org ${orgId}: ${updateError.message}`,
      );
      throw new BadRequestException('Failed to save logo URL');
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'logo_uploaded',
      targetType: 'branding',
      details: { storagePath, mimeType: file.mimetype },
    });

    return { logo_url: publicUrl };
  }

  /**
   * Delete the organization logo from storage and clear the DB column.
   */
  async deleteLogo(orgId: string, actorId: string): Promise<void> {
    // Get current logo_url to determine the storage path
    const { data, error: fetchError } = await this.supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', orgId)
      .single();

    if (fetchError || !data) {
      throw new NotFoundException('Organization not found');
    }

    if (!data.logo_url) {
      return; // No logo to delete
    }

    // Extract the storage path from the public URL
    // URL format: .../storage/v1/object/public/org-logos/{orgId}/logo.{ext}
    const urlParts = data.logo_url.split(`/${LOGO_BUCKET}/`);
    const storagePath = urlParts.length > 1 ? urlParts[1] : null;

    if (storagePath) {
      const { error: deleteError } = await this.supabase.storage
        .from(LOGO_BUCKET)
        .remove([storagePath]);

      if (deleteError) {
        this.logger.warn(
          `Failed to delete logo file for org ${orgId}: ${deleteError.message}`,
        );
        // Continue — still clear the DB reference even if storage delete fails
      }
    }

    const { error: updateError } = await this.supabase
      .from('organizations')
      .update({ logo_url: null })
      .eq('id', orgId);

    if (updateError) {
      this.logger.error(
        `Failed to clear logo_url for org ${orgId}: ${updateError.message}`,
      );
      throw new BadRequestException('Failed to remove logo');
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'logo_removed',
      targetType: 'branding',
    });
  }
}
