/**
 * Report Template Catalog Service
 *
 * Thin NestJS DI wrapper for report_templates reads (public catalog + lookup
 * by slug). Split out of ReportsService to keep it under CLAUDE.md's
 * 300-line hard limit (§1.3). Writing a private builder template stays on
 * ReportsService.saveBuilderTemplate — that's a distinct (write) concern
 * tied to the report-builder wizard, not the public catalog.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ReportTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  version: number;
  tier_required: string;
  config: any;
}

@Injectable()
export class ReportTemplateCatalogService {
  private readonly logger = new Logger(ReportTemplateCatalogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // Public catalog: every active, public template, ordered by tier_required.
  // Intentionally NOT filtered by a caller-supplied tier — a client tier must
  // never influence what the server returns (tier is resolved server-side for
  // access decisions, not for catalog visibility).
  async getTemplates(): Promise<ReportTemplate[]> {
    const client = this.supabase.getClient();
    const query = client
      .from('report_templates')
      .select('*')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('tier_required', { ascending: true });

    const { data, error } = await query;
    if (error) {
      this.logger.error('Failed to fetch templates:', error);
      return [];
    }
    return data || [];
  }

  async getTemplateBySlug(slug: string): Promise<ReportTemplate | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('report_templates')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      this.logger.error(`Failed to fetch template ${slug}:`, error);
      return null;
    }
    return data;
  }
}
