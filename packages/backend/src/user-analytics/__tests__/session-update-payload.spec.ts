/**
 * The promotion rule decides who counts as a person.
 *
 * `is_bot` is three-state and insert never writes `false` — a session cannot be
 * shown human at creation, when duration is 0 for everyone. `false` is earned
 * here, from evidence a crawler does not produce. Getting this wrong in either
 * direction is expensive: too loose and ~46,000 crawler sessions reappear as
 * visitors; too strict and a real person vanishes from a funnel that sees ~8
 * signups a month.
 */

import { buildSessionUpdatePlan } from '../session-update-payload';
import type { IngestableEvent } from '../user-analytics.types';

function event(partial: Partial<IngestableEvent>): IngestableEvent {
  return {
    visitor_id: 'v1',
    session_id: 's1',
    event_category: 'pageview',
    event_action: 'view',
    ...partial,
  } as IngestableEvent;
}

function plan(opts: {
  isBot?: boolean | null;
  pageCount?: number;
  pageviewCount?: number;
  events?: IngestableEvent[];
}) {
  return buildSessionUpdatePlan({
    existing: {
      page_count: opts.pageCount ?? 1,
      feature_events_count: 0,
      is_bot: opts.isBot === undefined ? null : opts.isBot,
    },
    events: opts.events ?? [event({})],
    pageviewCount: opts.pageviewCount ?? 0,
    exitPage: '/markets/austin-tx',
    props: {},
  });
}

describe('promotion to human requires evidence a crawler does not produce', () => {
  it('does not promote a single-pageview session with only auto-fired events', () => {
    // The exact shape that re-contaminated the human segment: one pageview,
    // score_view and conversion_bar_shown, both of which render automatically.
    const { payload, promotesToHuman } = plan({
      events: [
        event({ event_category: 'feature', event_action: 'score_view' }),
        event({ event_category: 'seo', event_action: 'conversion_bar_shown' }),
      ],
    });

    expect(promotesToHuman).toBe(false);
    expect(payload.is_bot).toBeUndefined();
  });

  it('promotes on a deliberate interaction', () => {
    const { payload, promotesToHuman } = plan({
      events: [
        event({ event_category: 'feature', event_action: 'region_select' }),
      ],
    });

    expect(promotesToHuman).toBe(true);
    expect(payload.is_bot).toBe(false);
  });

  it('promotes on a second pageview', () => {
    const { promotesToHuman } = plan({ pageCount: 1, pageviewCount: 1 });
    expect(promotesToHuman).toBe(true);
  });

  it('promotes on an authenticated session', () => {
    const { promotesToHuman } = plan({
      events: [event({ user_id: 'u-123' })],
    });
    expect(promotesToHuman).toBe(true);
  });

  it('promotes on a completed signup and records the conversion', () => {
    const { payload, promotesToHuman } = plan({
      events: [
        event({
          event_category: 'conversion',
          event_action: 'signup_complete',
        }),
      ],
    });

    expect(promotesToHuman).toBe(true);
    expect(payload.converted).toBe(true);
    expect(payload.conversion_type).toBe('signup_complete');
  });

  it('never rewrites a self-identified crawler, whatever it then does', () => {
    // A UA that says "I am GPTBot" is definitive and outranks behaviour.
    const { payload, promotesToHuman } = plan({
      isBot: true,
      pageviewCount: 5,
      events: [event({ event_action: 'region_select', user_id: 'u-1' })],
    });

    expect(promotesToHuman).toBe(false);
    expect(payload.is_bot).toBeUndefined();
  });

  it('does not re-promote a session already classified human', () => {
    const { promotesToHuman } = plan({
      isBot: false,
      events: [event({ event_action: 'region_select' })],
    });
    expect(promotesToHuman).toBe(false);
  });
});

describe('payload hygiene', () => {
  it('omits undefined so Supabase does not null out columns', () => {
    const { payload } = plan({ pageCount: 0, pageviewCount: 1 });
    // is_bounce is undefined for a single-pageview session and must not be sent.
    expect(Object.values(payload)).not.toContain(undefined);
  });

  it('never clears an existing conversion on a later batch', () => {
    const { payload } = plan({ events: [event({})] });
    expect(payload).not.toHaveProperty('converted');
  });
});
