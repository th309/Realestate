import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SectorBreakdown {
  naicsCode: string;
  naicsLabel: string;
  employment: number;
  /**
   * Share of the returned top-N rows, NOT share of the county's full economy.
   * If you need true county-level share, multiply by the ratio of total-top-N
   * employment to total-county employment (which would require a separate
   * aggregate query).
   */
  percentShareOfTopN: number;
}

/**
 * BLS QCEW annual data lags ~6-12 months; previous year is the freshest fully
 * published series. Override with `input.year` once a newer ingest lands.
 */
const DEFAULT_QCEW_LAG_YEARS = 1;

@Injectable()
export class EmploymentSectorsService {
  constructor(private supabase: SupabaseService) {}

  async getTopSectors(input: {
    countyFips: string;
    topN?: number;
    year?: number;
  }) {
    const topN = input.topN ?? 5;
    const year =
      input.year ?? new Date().getFullYear() - DEFAULT_QCEW_LAG_YEARS;

    const { data, error } = await this.supabase
      .from('employment_sectors')
      .select('naics_code, naics_label, employment')
      .eq('county_fips', input.countyFips)
      .eq('year', year)
      .not('naics_code', 'is', null)
      .not('naics_label', 'is', null)
      .order('employment', { ascending: false })
      .limit(topN);

    if (error || !data) return { sectors: [], totalEmployment: 0 };

    const totalEmployment = data.reduce(
      (sum, row) => sum + (row.employment ?? 0),
      0,
    );
    const sectors: SectorBreakdown[] = data.map((row) => ({
      naicsCode: row.naics_code,
      naicsLabel: row.naics_label,
      employment: row.employment,
      percentShareOfTopN:
        totalEmployment > 0 ? (row.employment / totalEmployment) * 100 : 0,
    }));

    return { sectors, totalEmployment };
  }
}
