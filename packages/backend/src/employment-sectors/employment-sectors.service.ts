import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SectorBreakdown {
  naicsCode: string;
  naicsLabel: string;
  employment: number;
  percentShare: number;
}

@Injectable()
export class EmploymentSectorsService {
  constructor(private supabase: SupabaseService) {}

  async getTopSectors(input: {
    countyFips: string;
    topN?: number;
    year?: number;
  }) {
    const topN = input.topN ?? 5;
    const year = input.year ?? new Date().getFullYear() - 1;

    const { data, error } = await this.supabase
      .from('employment_sectors')
      .select('naics_code, naics_label, employment')
      .eq('county_fips', input.countyFips)
      .eq('year', year)
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
      percentShare:
        totalEmployment > 0 ? (row.employment / totalEmployment) * 100 : 0,
    }));

    return { sectors, totalEmployment };
  }
}
