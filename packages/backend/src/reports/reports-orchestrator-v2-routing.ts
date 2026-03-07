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
 * Check ai_model_config for a prompt_version override.
 * Checks both 'report_narrative' and 'custom_report' purposes —
 * returns 'v2' if either is set to v2 for the given report type.
 */
export async function getPromptVersion(
  supabase: SupabaseClient,
  reportType?: string | null,
): Promise<string> {
  const purpose =
    reportType === 'custom' ? 'custom_report' : 'report_narrative';
  try {
    const { data } = await supabase
      .from('ai_model_config')
      .select('prompt_version')
      .eq('purpose', purpose)
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
): 'homeready' | 'investoredge' | 'comparison' | 'custom' | null {
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
  if (slug.includes('custom') || dto.user_inputs?.custom_question) {
    return 'custom';
  }
  // Fallback based on user_type
  if (dto.user_type === 'investor') return 'investoredge';
  if (dto.user_type === 'homebuyer') return 'homeready';
  return null;
}
