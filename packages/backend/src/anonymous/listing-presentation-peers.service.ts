import { Injectable } from '@nestjs/common';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeoLevel } from '../metric-resolution/metric-resolution.types';
import { type PeerCandidate } from '../markets/peers.service';

/** Flat, raw peer row the finale's peer cards consume (frontend adapter formats). */
export interface EnrichedPeer {
  geoLevel: string;
  geoId: string;
  name: string;
  score: number;
  home_value: number | null;
  days_on_market: number | null;
  sale_to_list: number | null;
  home_value_yoy: number | null;
}

const PEER_METRICS = [
  'home_value',
  'days_on_market',
  'sale_to_list',
  'home_value_yoy',
];

/**
 * Enriches ranked peers with the display metrics the finale's peer cards need
 * (median value, 12-month growth, days on market, sold-above-list).
 *
 * WHY THIS EXISTS: PeersService ranks peers and returns identity + PropertyIQ
 * score ONLY, so the finale's peer cards rendered three markets with blank
 * metric rows. Metrics resolve through MetricResolutionService (CLAUDE.md §5.1)
 * — never an ad-hoc fallback chain. Raw numbers are returned; the frontend
 * adapter formats them. A peer whose metrics are missing keeps null fields,
 * which the adapter renders as "—" instead of crashing.
 */
@Injectable()
export class ListingPresentationPeersService {
  constructor(private metrics: MetricResolutionService) {}

  async buildPeers(peers: PeerCandidate[]): Promise<EnrichedPeer[]> {
    return Promise.all(
      peers.map(async (peer) => {
        const m = await this.metrics
          .resolveMetricBatch(
            PEER_METRICS,
            peer.geoLevel as GeoLevel,
            peer.geoId,
          )
          .catch(() => ({}) as Record<string, { value: number | null }>);
        return {
          geoLevel: peer.geoLevel,
          geoId: peer.geoId,
          name: peer.name,
          score: peer.score,
          home_value: m.home_value?.value ?? null,
          days_on_market: m.days_on_market?.value ?? null,
          sale_to_list: m.sale_to_list?.value ?? null,
          home_value_yoy: m.home_value_yoy?.value ?? null,
        };
      }),
    );
  }
}
