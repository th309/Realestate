/**
 * Types for the Journeys tab of admin analytics.
 *
 * Split out of user-analytics.types.ts, which crossed the 300-line hard limit
 * (CLAUDE.md 1.3). Re-exported from there, so existing import sites are
 * unchanged.
 */

import type { Annotation } from './user-analytics.types';

export interface NavigationFlow {
  fromPage: string;
  toPage: string;
  transitions: number;
}

export interface PathSequence {
  path: string[];
  sessions: number;
  conversionRate?: number;
}

export interface LandingPageMetric {
  page: string;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
}

export interface ExitPageMetric {
  page: string;
  exits: number;
}

export interface DurationBucket {
  bucket: string;
  count: number;
}

/**
 * An off-site destination reached by clicking a link on our site.
 *
 * This is the only observable part of "where a user goes after leaving" — the
 * browser gives a departing page no access to where the navigation lands, so
 * exits via typed URL, bookmark, or tab close are unknowable by design.
 */
export interface OutboundDestination {
  domain: string;
  clicks: number;
  sessions: number;
  topUrl: string;
  fromPage: string;
}

export interface JourneyData {
  landingPages: LandingPageMetric[];
  exitPages: ExitPageMetric[];
  navigationFlows: NavigationFlow[];
  commonPaths: PathSequence[];
  outboundDestinations: OutboundDestination[];
  avgPagesPerSession: number;
  sessionDurationDistribution: DurationBucket[];
  annotations: Annotation[];
}
