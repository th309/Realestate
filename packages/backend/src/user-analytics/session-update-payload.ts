/**
 * Builds the UPDATE payload for an existing session, including the decision to
 * promote it from unclassified to human.
 *
 * Extracted from session-manager.service.ts (300-line hard limit) and kept
 * pure: no client, no I/O, so the promotion rule — the part that decides who
 * counts as a person — is directly testable.
 */

import { IngestableEvent } from './user-analytics.types';
import { isHumanEvidenceAction } from './bot-detection';

export interface ExistingSessionRow {
  page_count: number | null;
  feature_events_count: number | null;
  is_bot: boolean | null;
  [column: string]: unknown;
}

export interface SessionUpdatePlan {
  payload: Record<string, unknown>;
  /** True when this batch flips the session NULL -> false. */
  promotesToHuman: boolean;
}

/** Session-invariant acquisition fields, safe to backfill from any batch. */
const BACKFILL_COLUMNS = [
  'entry_type',
  'referrer',
  'referrer_domain',
  'utm_source',
  'utm_medium',
  'utm_campaign',
] as const;

export function buildSessionUpdatePlan(args: {
  existing: ExistingSessionRow;
  events: IngestableEvent[];
  pageviewCount: number;
  exitPage: string | null;
  props: Record<string, string | undefined>;
}): SessionUpdatePlan {
  const { existing, events, pageviewCount, exitPage, props } = args;

  const previousPageCount = existing.page_count ?? 0;
  const previousFeatureCount = existing.feature_events_count ?? 0;
  const totalPageCount = previousPageCount + pageviewCount;

  const newFeatureCount = events.filter(
    (e) => e.event_category === 'feature',
  ).length;
  const hasFrustration = events.some((e) => e.event_category === 'frustration');
  const conversionEvent = events.find(
    (e) => e.event_action === 'signup_complete',
  );

  const payload: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
    exit_page: exitPage,
    page_count: totalPageCount,
    is_bounce: totalPageCount <= 1 ? undefined : false,
    feature_events_count: previousFeatureCount + newFeatureCount,
  };

  if (hasFrustration) payload['had_frustration_event'] = true;

  // Only ever set converted true — never clear it. A later batch from the same
  // session must not un-convert a signup that already happened.
  if (conversionEvent) {
    payload['converted'] = true;
    payload['conversion_type'] = conversionEvent.event_action;
  }

  // Evidence a crawler does not produce. Auto-fired telemetry (score_view,
  // conversion_bar_shown, error_shown …) is excluded by isHumanEvidenceAction —
  // 582 known-bot sessions emit score_view alone, so counting it would readmit
  // exactly the population this rule exists to exclude.
  const hasHumanEvidence =
    events.some((e) => isHumanEvidenceAction(e.event_action)) ||
    totalPageCount > 1 ||
    !!events[0]?.user_id ||
    !!conversionEvent;

  // Promote ONLY from NULL. A UA that self-identifies as a crawler is
  // definitive and outranks behaviour, so `true` is never rewritten.
  const promotesToHuman = hasHumanEvidence && existing.is_bot === null;
  if (promotesToHuman) payload['is_bot'] = false;

  // Fill acquisition fields only where the existing row is null, so the insert
  // winner's real value is never overwritten. landing_page is deliberately
  // excluded — it is order-dependent, and backfilling it could turn a missing
  // value into a confidently wrong one.
  for (const column of BACKFILL_COLUMNS) {
    const current = existing[column];
    const incoming = props[column];
    if ((current === null || current === undefined) && incoming != null) {
      payload[column] = incoming;
    }
  }

  return {
    // Strip undefined so Supabase does not overwrite columns with null.
    payload: Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    ),
    promotesToHuman,
  };
}
