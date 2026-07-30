/**
 * The traffic segment decides which population every dashboard number describes,
 * so an unrecognised value must never widen the audience. Defaulting a typo to
 * 'all' would silently put ~46,000 unclassified crawler sessions back into a
 * tile that claims to show humans — the exact failure this work removed.
 */

import {
  DEFAULT_TRAFFIC_SEGMENT,
  TRAFFIC_SEGMENTS,
  parseTrafficSegment,
} from '../traffic-segment';

describe('parseTrafficSegment fails closed to the human segment', () => {
  it('defaults to human when nothing is supplied', () => {
    expect(parseTrafficSegment(undefined)).toBe('human');
    expect(DEFAULT_TRAFFIC_SEGMENT).toBe('human');
  });

  it.each(TRAFFIC_SEGMENTS)('accepts the %s segment verbatim', (segment) => {
    expect(parseTrafficSegment(segment)).toBe(segment);
  });

  it('falls back to human for an unrecognised value rather than widening to all', () => {
    expect(parseTrafficSegment('everything')).toBe('human');
    expect(parseTrafficSegment('ALL')).toBe('human');
    expect(parseTrafficSegment('')).toBe('human');
  });

  it('never silently admits bots through a malformed value', () => {
    for (const bad of ['bots', 'true', '1', 'null', 'undefined', 'human ']) {
      expect(parseTrafficSegment(bad)).toBe('human');
    }
  });
});
