/**
 * V2 Routing Helpers for the Reports Orchestrator
 *
 * All reports use the v2 two-pass generation pipeline. Maps report templates
 * to the v2 report type identifiers.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ReportTemplate } from './reports.service';
import type { GenerateReportDto } from './dto/generate-report.dto';

/**
 * Determine the prompt pipeline version for report generation.
 * All reports use the v2 two-pass pipeline (outline → parallel sections).
 */
export function getPromptVersion(
  _supabase: SupabaseClient,
  _reportType?: string | null,
): string {
  return 'v2';
}

/**
 * Map a report template + DTO to a v2 report type identifier.
 * Returns null if the template doesn't map to a known v2 type.
 *
 * All new reports use 'propertyiq' as the canonical type.
 * Legacy slugs ('homeready', 'investoredge') in the DB are routed
 * to the same underlying sections for backward compatibility.
 */
export function resolveReportType(
  template: ReportTemplate,
  dto: GenerateReportDto,
):
  | 'propertyiq'
  | 'homeready'
  | 'investoredge'
  | 'comparison'
  | 'custom'
  | null {
  // Comparison reports are identified by having comparison geographies
  if (dto.comparison_geographies && dto.comparison_geographies.length > 0) {
    return 'comparison';
  }
  const slug = template.slug?.toLowerCase() || '';
  if (slug.includes('custom') || dto.user_inputs?.custom_question) {
    return 'custom';
  }
  // Legacy slug backward compat: old reports stored with these slugs
  // still route to the same section configs (which now use propertyiq vars)
  if (slug.includes('investor') || slug.includes('investoredge')) {
    return 'investoredge'; // legacy — routes to INVESTOR_V2_SECTIONS
  }
  if (slug.includes('homeready') || slug.includes('homebuyer')) {
    return 'homeready'; // legacy — routes to HOMEREADY_V2_SECTIONS
  }
  // New reports: default to propertyiq regardless of user_type
  // (investor vs homebuyer audience is handled at the section level)
  if (dto.user_type === 'investor') return 'investoredge';
  if (dto.user_type === 'homebuyer') return 'homeready';
  return 'propertyiq';
}
