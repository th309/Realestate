/**
 * Classification at WRITE time.
 *
 * The backfill made `is_bot` three-state and reclassified history, but the
 * ingestion path kept writing `false` for any non-bot User-Agent — i.e.
 * "evidence-backed human" — so the human bucket re-contaminated immediately.
 * A session recorded at 2026-07-30 00:50 with zero duration, zero heartbeats,
 * one pageview and only auto-fired events (score_view, conversion_bar_shown)
 * was sitting in the human segment within hours of the backfill.
 *
 * A session cannot be judged human at insert: duration is 0 for everyone at
 * that moment, by definition. So insert may only ever write `true` (the UA
 * self-identifies) or NULL (unknown). `false` is earned later, by evidence.
 */

import {
  classifySessionAtInsert,
  isHumanEvidenceAction,
} from '../bot-detection';

describe('classifySessionAtInsert never claims a session is human', () => {
  it('flags a self-identifying crawler as a bot', () => {
    expect(
      classifySessionAtInsert('Mozilla/5.0 (compatible; GPTBot/1.0)'),
    ).toBe(true);
    expect(classifySessionAtInsert('curl/8.4.0')).toBe(true);
  });

  it('returns null — not false — for an ordinary browser User-Agent', () => {
    expect(
      classifySessionAtInsert(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      ),
    ).toBeNull();
  });

  it('returns null for an absent User-Agent rather than assuming human', () => {
    expect(classifySessionAtInsert('')).toBeNull();
  });

  it('never returns false, because nothing observable at insert proves a human', () => {
    for (const ua of ['', 'Chrome/120', 'Safari/17', 'GPTBot/1.0', 'curl/8']) {
      expect(classifySessionAtInsert(ua)).not.toBe(false);
    }
  });
});

describe('isHumanEvidenceAction separates deliberate acts from auto-fired telemetry', () => {
  it('accepts events a crawler does not produce', () => {
    for (const action of [
      'region_select',
      'search',
      'pricing_cta_click',
      'signup_email_engaged',
      'signup_oauth_click',
      'pro_feature_used',
    ]) {
      expect(isHumanEvidenceAction(action)).toBe(true);
    }
  });

  it('rejects mount-fired funnel events that merely record a page being shown', () => {
    // Both fire from useEffect(..., []) — signup_start in
    // app/(app)/auth/sign-up/page.tsx, quiz_start in
    // app/(app)/onboarding/hooks/useQuiz.ts — so they record the form being
    // SHOWN, not touched. Any JS-executing crawler that loads /auth/sign-up
    // would otherwise be promoted to human on its first batch, which is exactly
    // the contamination this rule exists to prevent. 70 sessions had been
    // promoted on that basis before it was caught.
    expect(isHumanEvidenceAction('signup_start')).toBe(false);
    expect(isHumanEvidenceAction('quiz_start')).toBe(false);

    // Their deliberate counterparts must still count.
    expect(isHumanEvidenceAction('signup_email_engaged')).toBe(true);
    expect(isHumanEvidenceAction('signup_oauth_click')).toBe(true);
  });

  it('rejects the events that render automatically on every page', () => {
    // Measured: 582 known-bot sessions emit score_view and 550 emit
    // conversion_bar_shown. Counting either as evidence is what let crawlers
    // hitting /markets/* launder themselves into the human segment.
    for (const action of [
      'view',
      'score_view',
      'conversion_bar_shown',
      'error_shown',
      'sticky_bar_shown',
      'assigned',
      'install_banner_shown',
      'pricing_page_view',
      'upgrade_prompt_shown',
      'expired',
    ]) {
      expect(isHumanEvidenceAction(action)).toBe(false);
    }
  });
});
