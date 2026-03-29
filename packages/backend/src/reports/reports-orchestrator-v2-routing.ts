/**
 * V2 Routing Helpers for the Reports Orchestrator
 *
 * Determines whether to use the v2 two-pass generation pipeline by checking
 * ai_model_config for a prompt_version flag, and maps report templates to
 * the v2 report type identifiers.
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
  // All score-based reports now use the unified PropertyIQ flow
  // Legacy slugs (investor, homeready) map to the same type
  if (slug.includes('investor') || slug.includes('investoredge')) {
    return 'investoredge'; // backward compat — same sections
  }
  if (slug.includes('homeready') || slug.includes('homebuyer')) {
    return 'homeready'; // backward compat — same sections
  }
  // Default based on user_type
  if (dto.user_type === 'investor') return 'investoredge';
  if (dto.user_type === 'homebuyer') return 'homeready';
  return null;
}
