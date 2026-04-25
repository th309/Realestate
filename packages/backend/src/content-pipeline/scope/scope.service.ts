import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  ResolveScopeDto,
  ResolveScopeResult,
  ResolvedMarket,
} from '../dto/resolve-scope.dto';

const MAX_RESOLVED_MARKETS = 2500;

@Injectable()
export class ScopeService {
  private readonly logger = new Logger(ScopeService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async resolve(dto: ResolveScopeDto): Promise<ResolveScopeResult> {
    switch (dto.type) {
      case 'metros_in_state':
        if (!dto.state) throw new BadRequestException('state required');
        return this.resolveMetrosInState(dto.state.toUpperCase());
      case 'zips_in_state':
        if (!dto.state) throw new BadRequestException('state required');
        return this.resolveZipsInState(dto.state.toUpperCase());
      case 'zips_in_metro':
        if (!dto.cbsaCode) throw new BadRequestException('cbsaCode required');
        return this.resolveZipsInMetro(dto.cbsaCode);
      case 'custom':
        if (!dto.codes || dto.codes.length === 0)
          throw new BadRequestException('codes required');
        return this.resolveCustom(dto.codes);
    }
  }

  private async resolveMetrosInState(
    stateCode: string,
  ): Promise<ResolveScopeResult> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('geography_crosswalk')
      .select('cbsa_code, cbsa_name, cbsa_population')
      .eq('state_abbrev', stateCode)
      .not('cbsa_code', 'is', null)
      .limit(MAX_RESOLVED_MARKETS);
    if (error) throw new Error(`crosswalk lookup failed: ${error.message}`);
    const seen = new Set<string>();
    const markets: ResolvedMarket[] = [];
    for (const row of data ?? []) {
      const r = row as {
        cbsa_code: string;
        cbsa_name: string | null;
        cbsa_population: number | null;
      };
      if (!r.cbsa_code || seen.has(r.cbsa_code)) continue;
      seen.add(r.cbsa_code);
      markets.push({
        id: r.cbsa_code,
        geography: 'metro',
        canonical_name: r.cbsa_name ?? `Metro ${r.cbsa_code}`,
        population: r.cbsa_population,
        score: null,
      });
    }
    await this.attachScores(markets);
    return { markets, truncated: markets.length >= MAX_RESOLVED_MARKETS };
  }

  private async resolveZipsInState(
    stateCode: string,
  ): Promise<ResolveScopeResult> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('geography_crosswalk')
      .select('zip_code')
      .eq('state_abbrev', stateCode)
      .not('zip_code', 'is', null)
      .limit(MAX_RESOLVED_MARKETS);
    if (error) throw new Error(`crosswalk lookup failed: ${error.message}`);
    const markets: ResolvedMarket[] = (data ?? []).map((row) => {
      const r = row as { zip_code: string };
      return {
        id: r.zip_code,
        geography: 'zip',
        canonical_name: `ZIP ${r.zip_code}`,
        population: null,
        score: null,
      };
    });
    await this.attachScores(markets);
    return {
      markets,
      truncated: markets.length >= MAX_RESOLVED_MARKETS,
    };
  }

  private async resolveZipsInMetro(
    cbsaCode: string,
  ): Promise<ResolveScopeResult> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('geography_crosswalk')
      .select('zip_code')
      .eq('cbsa_code', cbsaCode)
      .not('zip_code', 'is', null)
      .limit(MAX_RESOLVED_MARKETS);
    if (error) throw new Error(`crosswalk lookup failed: ${error.message}`);
    const markets: ResolvedMarket[] = (data ?? []).map((row) => {
      const r = row as { zip_code: string };
      return {
        id: r.zip_code,
        geography: 'zip',
        canonical_name: `ZIP ${r.zip_code}`,
        population: null,
        score: null,
      };
    });
    await this.attachScores(markets);
    return {
      markets,
      truncated: markets.length >= MAX_RESOLVED_MARKETS,
    };
  }

  private async resolveCustom(rawCodes: string[]): Promise<ResolveScopeResult> {
    const client = this.supabase.getClient();
    const trimmed = rawCodes.map((c) => c.trim()).filter(Boolean);
    const dedupe = Array.from(new Set(trimmed));

    const [{ data: zipRows }, { data: cbsaRows }] = await Promise.all([
      client
        .from('geography_crosswalk')
        .select('zip_code, cbsa_name, state_abbrev')
        .in('zip_code', dedupe),
      client
        .from('geography_crosswalk')
        .select('cbsa_code, cbsa_name, cbsa_population')
        .in('cbsa_code', dedupe)
        .not('cbsa_code', 'is', null),
    ]);

    const matchedIds = new Set<string>();
    const markets: ResolvedMarket[] = [];

    for (const row of zipRows ?? []) {
      const r = row as {
        zip_code: string;
        cbsa_name: string | null;
        state_abbrev: string | null;
      };
      if (!r.zip_code || matchedIds.has(`zip:${r.zip_code}`)) continue;
      matchedIds.add(`zip:${r.zip_code}`);
      markets.push({
        id: r.zip_code,
        geography: 'zip',
        canonical_name: `ZIP ${r.zip_code}${r.cbsa_name ? ` (${r.cbsa_name})` : ''}`,
        population: null,
        score: null,
      });
    }

    const seenCbsa = new Set<string>();
    for (const row of cbsaRows ?? []) {
      const r = row as {
        cbsa_code: string;
        cbsa_name: string | null;
        cbsa_population: number | null;
      };
      if (!r.cbsa_code || seenCbsa.has(r.cbsa_code)) continue;
      seenCbsa.add(r.cbsa_code);
      matchedIds.add(`metro:${r.cbsa_code}`);
      markets.push({
        id: r.cbsa_code,
        geography: 'metro',
        canonical_name: r.cbsa_name ?? `Metro ${r.cbsa_code}`,
        population: r.cbsa_population,
        score: null,
      });
    }

    const recognizedCodes = new Set([
      ...(zipRows ?? []).map((r: any) => r.zip_code).filter(Boolean),
      ...(cbsaRows ?? []).map((r: any) => r.cbsa_code).filter(Boolean),
    ]);
    const unrecognized = dedupe.filter((c) => !recognizedCodes.has(c));

    await this.attachScores(markets);
    return {
      markets,
      truncated: false,
      unrecognized: unrecognized.length > 0 ? unrecognized : undefined,
    };
  }

  private async attachScores(markets: ResolvedMarket[]): Promise<void> {
    if (markets.length === 0) return;
    const client = this.supabase.getClient();
    const byLevel: Record<'metro' | 'zip', string[]> = { metro: [], zip: [] };
    for (const m of markets) byLevel[m.geography].push(m.id);

    const lookups: Promise<any>[] = [];
    if (byLevel.metro.length > 0) {
      lookups.push(
        client
          .from('propertyiq_scores')
          .select('geo_id, score')
          .eq('geo_level', 'metro')
          .eq('score_type', 'propertyiq')
          .in('geo_id', byLevel.metro) as unknown as Promise<any>,
      );
    }
    if (byLevel.zip.length > 0) {
      lookups.push(
        client
          .from('propertyiq_scores')
          .select('geo_id, score')
          .eq('geo_level', 'zip')
          .eq('score_type', 'propertyiq')
          .in('geo_id', byLevel.zip) as unknown as Promise<any>,
      );
    }
    if (lookups.length === 0) return;
    const results = await Promise.all(lookups);
    const scoreMap = new Map<string, number>();
    for (const res of results) {
      for (const row of res.data ?? []) {
        scoreMap.set(`${row.geo_id}`, Number(row.score));
      }
    }
    for (const m of markets) {
      const s = scoreMap.get(m.id);
      if (typeof s === 'number') m.score = s;
    }
  }
}
