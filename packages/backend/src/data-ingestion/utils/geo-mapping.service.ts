import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class GeoMappingService {
    private readonly logger = new Logger(GeoMappingService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Map Zillow region name to region_id
     * Tries to match against existing markets table
     */
    async mapZillowRegionToGeoCode(
        regionName: string,
        stateCode: string,
        geoType: 'metro' | 'state' | 'city' | 'zipcode' = 'metro'
    ): Promise<string | null> {
        const supabase = this.supabaseService.getClient();

        // Clean region name for matching
        const cleanName = regionName
            .replace(/,/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Map geoType to region_type
        const regionType = geoType === 'metro' ? 'msa' : geoType;

        // Try exact match first
        const { data: exactMatch, error: exactError } = await supabase
            .from('markets')
            .select('region_id')
            .eq('region_name', cleanName)
            .eq('state_code', stateCode)
            .eq('region_type', regionType)
            .limit(1)
            .single();

        if (exactError && exactError.code !== 'PGRST116') {
            this.logger.error(`Exact match query error: ${exactError.message}`);
        }

        if (exactMatch) {
            return exactMatch.region_id;
        }

        // Try partial match (contains)
        const { data: partialMatch } = await supabase
            .from('markets')
            .select('region_id')
            .ilike('region_name', `%${cleanName}%`)
            .eq('state_code', stateCode)
            .eq('region_type', regionType)
            .limit(1)
            .single();

        if (partialMatch) {
            return partialMatch.region_id;
        }

        // Try reverse - check if our name contains their name
        const { data: reverseMatch } = await supabase
            .from('markets')
            .select('region_id, region_name')
            .eq('state_code', stateCode)
            .eq('region_type', regionType)
            .limit(100);

        if (reverseMatch) {
            for (const market of reverseMatch) {
                if (market.region_name && cleanName.includes(market.region_name)) {
                    return market.region_id;
                }
                if (market.region_name && market.region_name.includes(cleanName)) {
                    return market.region_id;
                }
            }
        }

        // No match found
        this.logger.warn(`No region_id found for: ${cleanName}, ${stateCode}, ${regionType}`);
        return null;
    }

    /**
     * Generate a temporary geo_code for unmapped regions
     */
    generateTempGeoCode(
        regionName: string,
        stateCode: string,
        geoType: string = 'metro'
    ): string {
        const sanitized = regionName
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase()
            .substring(0, 15);

        const prefix = geoType === 'metro' ? 'MSA' : geoType.toUpperCase();
        return `US-${prefix}-${sanitized}-${stateCode}`.substring(0, 20);
    }
}
