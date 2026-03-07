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
 * Check ai_model_config for a prompt_version override on report_narrative purpose.
 * Returns 'v1' if no config exists or the column is absent.
 */
export async function getPromptVersion(
  supabase: SupabaseClient,
): Promise<string> {
  try {
    const { data } = await supabase
      .from('ai_model_config')
      .select('prompt_version')
      .eq('purpose', 'report_narrative')
      .eq('is_active', true)
      .single();
    return data?.prompt_version || 'v1';
  } catch {
    return 'v1';
  }
}

/**
 * Map a report template + DTO to a v2 report type identifier.
 * Returns null if the template doesn't map to a known v2 type.
 */
export function resolveReportType(
  template: ReportTemplate,
  dto: GenerateReportDto,
): 'homeready' | 'investoredge' | 'comparison' | null {
  // Comparison reports are identified by having comparison geographies
  if (dto.comparison_geographies && dto.comparison_geographies.length > 0) {
    return 'comparison';
  }
  const slug = template.slug?.toLowerCase() || '';
  if (slug.includes('investor') || slug.includes('investoredge')) {
    return 'investoredge';
  }
  if (slug.includes('homeready') || slug.includes('homebuyer')) {
    return 'homeready';
  }
  // Fallback based on user_type
  if (dto.user_type === 'investor') return 'investoredge';
  if (dto.user_type === 'homebuyer') return 'homeready';
  return null;
}
