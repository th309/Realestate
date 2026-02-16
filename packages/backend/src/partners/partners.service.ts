import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PartnerRecommendationDto } from './dto/partner.dto';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get partner recommendations for a report.
   * For each context_type requested, finds the highest-priority active partner
   * that matches optional geography and tier filters.
   * Returns null for context types with no matching partner (slot stays hidden).
   */
  async getRecommendationsForReport(
    contextTypes: string[],
    options?: {
      geographyType?: string;
      geographyId?: string;
      userTier?: string;
      templateVars?: Record<string, string>;
    },
  ): Promise<Record<string, PartnerRecommendationDto | null>> {
    const result: Record<string, PartnerRecommendationDto | null> = {};

    // Initialize all requested types as null
    for (const ct of contextTypes) {
      result[ct] = null;
    }

    if (contextTypes.length === 0) {
      return result;
    }

    try {
      const client = this.supabase.getClient();
      const { data: partners, error } = await client
        .from('partner_config')
        .select('*')
        .in('context_type', contextTypes)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        this.logger.warn('Failed to fetch partner configs:', error.message);
        return result;
      }

      if (!partners || partners.length === 0) {
        return result;
      }

      for (const partner of partners) {
        // Skip if we already have a higher-priority partner for this context
        if (result[partner.context_type] !== null) continue;

        // Check geography filter
        if (partner.geography_filter) {
          const filter = partner.geography_filter as {
            types?: string[];
            ids?: string[];
          };
          if (
            filter.types &&
            options?.geographyType &&
            !filter.types.includes(options.geographyType)
          ) {
            continue;
          }
          if (
            filter.ids &&
            options?.geographyId &&
            !filter.ids.includes(options.geographyId)
          ) {
            continue;
          }
        }

        // Check tier filter
        if (
          partner.tier_filter &&
          partner.tier_filter.length > 0 &&
          options?.userTier
        ) {
          if (!partner.tier_filter.includes(options.userTier)) continue;
        }

        // Interpolate description template
        let description = partner.description_template;
        if (options?.templateVars) {
          for (const [key, value] of Object.entries(options.templateVars)) {
            description = description.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
              value,
            );
          }
        }

        result[partner.context_type] = {
          name: partner.name,
          description,
          cta_text: partner.cta_text,
          cta_url: partner.cta_url,
          logo_url: partner.logo_url || undefined,
        };
      }

      this.logger.debug(
        `Fetched partner recommendations: ${Object.values(result).filter((v) => v !== null).length}/${contextTypes.length} slots filled`,
      );
    } catch (error) {
      this.logger.error('Error fetching partner recommendations:', error);
    }

    return result;
  }
}
