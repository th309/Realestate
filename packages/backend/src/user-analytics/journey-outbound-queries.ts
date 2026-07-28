/**
 * Query helpers for outbound-destination reporting and device filtering on the
 * Journeys tab. Operate directly on a SupabaseClient so they carry no
 * injectable state and can be tested in isolation — same shape as
 * acquisition-session-queries.ts.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import type { OutboundDestination } from './journey.types';
import type { AnalyticsFilters } from './user-analytics.types';

const logger = new Logger('JourneyOutboundQueries');

/** Cap on session ids pulled for an in-memory device filter. */
const DEVICE_SESSION_LIMIT = 20000;

/**
 * Resolve the set of session ids matching a device filter.
 *
 * `user_events` has no device_type column — it lives only on `user_sessions` —
 * so device filtering on event-derived panels has to happen in memory against
 * this set. Returns null when no device filter is active, meaning "no
 * filtering", which callers must distinguish from an empty set ("filter active,
 * nothing matched").
 */
export async function resolveDeviceSessionIds(
  client: SupabaseClient,
  startDate: string,
  filters: AnalyticsFilters,
): Promise<Set<string> | null> {
  if (!filters.device) return null;

  const { data, error } = await client
    .from('user_sessions')
    .select('session_id')
    .eq('device_type', filters.device)
    .eq('is_bot', false)
    .gte('started_at', startDate)
    .limit(DEVICE_SESSION_LIMIT);

  if (error) {
    logger.error(`Failed to resolve device session ids: ${error.message}`);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.session_id as string));
}

interface OutboundAccumulator {
  clicks: number;
  sessions: Set<string>;
  urlCounts: Map<string, number>;
  fromCounts: Map<string, number>;
}

function topKey(counts: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Aggregate outbound link clicks by destination domain.
 *
 * Only click-time data exists — a browser gives the departing page no access to
 * where a navigation lands, so exits by typed URL, bookmark or tab close are
 * unobservable and simply absent here.
 */
export async function queryOutboundDestinations(
  client: SupabaseClient,
  startDate: string,
  filters: AnalyticsFilters,
  deviceSessionIds: Set<string> | null,
): Promise<OutboundDestination[]> {
  let query = client
    .from('user_events')
    .select('session_id, page_path, properties')
    .eq('event_category', 'outbound')
    .eq('is_bot', false)
    .gte('created_at', startDate)
    .limit(5000);

  if (filters.tier) query = query.eq('user_tier', filters.tier);

  const { data, error } = await query;
  if (error) {
    logger.error(`Failed to fetch outbound destinations: ${error.message}`);
    return [];
  }

  const byDomain = new Map<string, OutboundAccumulator>();

  for (const row of data ?? []) {
    const sessionId = row.session_id as string;
    if (deviceSessionIds && !deviceSessionIds.has(sessionId)) continue;

    const props = (row.properties ?? {}) as Record<string, unknown>;
    const domain = props['destination_domain'];
    if (typeof domain !== 'string' || !domain) continue;

    const entry = byDomain.get(domain) ?? {
      clicks: 0,
      sessions: new Set<string>(),
      urlCounts: new Map<string, number>(),
      fromCounts: new Map<string, number>(),
    };

    entry.clicks += 1;
    entry.sessions.add(sessionId);

    const url = props['destination_url'];
    if (typeof url === 'string' && url) {
      entry.urlCounts.set(url, (entry.urlCounts.get(url) ?? 0) + 1);
    }

    const fromPage = (props['from_page'] ?? row.page_path) as unknown;
    if (typeof fromPage === 'string' && fromPage) {
      entry.fromCounts.set(fromPage, (entry.fromCounts.get(fromPage) ?? 0) + 1);
    }

    byDomain.set(domain, entry);
  }

  return Array.from(byDomain.entries())
    .map(([domain, entry]) => ({
      domain,
      clicks: entry.clicks,
      sessions: entry.sessions.size,
      topUrl: topKey(entry.urlCounts),
      fromPage: topKey(entry.fromCounts),
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 25);
}
