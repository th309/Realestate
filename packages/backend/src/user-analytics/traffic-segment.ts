/**
 * Which population a dashboard number describes.
 *
 * `is_bot` is three-state (true = automated, false = human on evidence,
 * NULL = unclassified), so "human" is NOT the complement of "bot". Roughly
 * 46,000 of 48,600 sessions in the trailing 30 days are unclassified: written
 * before classification existed, and unknowable after the fact because the
 * early-heartbeat signal that would have judged them did not exist yet. They
 * are their own bucket, never folded into humans.
 *
 * `internal` cuts across that axis rather than extending it. Our own browsing
 * is human by every behavioural test — 99 of 767 human sessions in a trailing
 * 30-day window were ours — so it has to be subtracted explicitly or it reads
 * as customer demand. It is excluded from human, bot AND unclassified, and
 * appears only under `internal` and `all`. The rule lives in one place, the
 * `public.analytics_in_segment` SQL function; this list only has to agree with
 * the names it accepts.
 */

export const TRAFFIC_SEGMENTS = [
  'human',
  'bot',
  'unclassified',
  'internal',
  'all',
] as const;

export type TrafficSegment = (typeof TRAFFIC_SEGMENTS)[number];

export const DEFAULT_TRAFFIC_SEGMENT: TrafficSegment = 'human';

/**
 * Normalise an untrusted query-string value into a segment.
 *
 * Fails CLOSED to `human`. Defaulting an unrecognised value to `all` would put
 * the crawler population back into a tile that claims to show people — the same
 * outcome as the bug this replaced, reached by a different route.
 */
export function parseTrafficSegment(value: unknown): TrafficSegment {
  return TRAFFIC_SEGMENTS.includes(value as TrafficSegment)
    ? (value as TrafficSegment)
    : DEFAULT_TRAFFIC_SEGMENT;
}
