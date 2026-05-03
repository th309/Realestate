import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  GEOGRAPHIES_WITH_SCORES_VIEW,
  SIZE_DISTANCE_WEIGHT,
} from './constants';

export interface PeerCandidate {
  geoLevel: string;
  geoId: string;
  name: string;
  score: number;
  householdCount: number;
}

export interface FindPeersInput {
  geoLevel: string;
  geoId: string;
  score: number;
  parentMetro: string | null;
  householdCount: number;
}

@Injectable()
export class PeersService {
  constructor(private supabase: SupabaseService) {}

  async findPeers(input: FindPeersInput, limit = 3): Promise<PeerCandidate[]> {
    // TODO(phase-01-task-13): verify this view exists with these exact columns.
    // Specifically: confirm 'score' maps to PropertyIQ score (vs other score_type),
    // confirm 'parent_metro_cbsa' is populated for ZIP/county/city rows, and confirm
    // 'household_count' field name matches schema.
    const candidates = await this.supabase
      .from(GEOGRAPHIES_WITH_SCORES_VIEW)
      .select(
        'geo_id, name, score, household_count, parent_metro_cbsa, geo_level',
      )
      .eq('parent_metro_cbsa', input.parentMetro ?? '')
      .eq('geo_level', input.geoLevel)
      .limit(50);

    if (candidates.error || !candidates.data) return [];

    const ranked = candidates.data
      .filter((c) => c.geo_id !== input.geoId)
      .map((c) => ({
        geoLevel: c.geo_level,
        geoId: c.geo_id,
        name: c.name,
        score: c.score,
        householdCount: c.household_count,
        scoreDist: Math.abs(c.score - input.score),
        sizeDist:
          Math.abs(c.household_count - input.householdCount) /
          Math.max(input.householdCount, 1),
      }))
      .sort(
        (a, b) =>
          a.scoreDist +
          a.sizeDist * SIZE_DISTANCE_WEIGHT -
          (b.scoreDist + b.sizeDist * SIZE_DISTANCE_WEIGHT),
      )
      .slice(0, limit);

    return ranked.map(({ scoreDist, sizeDist, ...rest }) => rest);
  }
}
