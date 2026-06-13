/**
 * Characterization snapshots that PIN the rendered markup of every marketing/
 * lifecycle email. Copy now lives in `@propertyiq/emails` `email-copy.ts`; these
 * snapshots ensure a future copy edit changes ONLY the words, not the surrounding
 * markup/structure. If a snapshot diff shows changed tags/styles/attributes, the
 * edit broke layout — investigate before running `jest -u`.
 *
 * React templates are rendered with react-dom/server's synchronous
 * renderToStaticMarkup (not @react-email/render, whose node build uses a dynamic
 * import() that jest's CJS VM rejects). This captures the component's JSX output —
 * exactly what we want to detect structural regressions. Inputs are fixed so the
 * output is deterministic across runs.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OnboardingDay0Welcome,
  OnboardingDay1Scores,
  OnboardingDay3Compare,
  OnboardingDay5Upgrade,
  OnboardingDay7Profile,
  OnboardingDay10Zillow,
  OnboardingDay14Report,
  WinbackDay14,
} from '@propertyiq/emails';
import {
  buildWelcomeEmail,
  buildActiveExplorerEmail,
  buildReportGeneratedEmail,
  buildPaywallHitEmail,
  buildPostTrial7dEmail,
  buildInactive24hEmail,
  buildTrialDay10Email,
  buildTrialDay13Email,
  buildTrialExpiredEmail,
} from '../behavioral-trigger-emails';

const NAME = 'Sample';
const BASE = 'https://example.com';
const UNSUB = `${BASE}/account/notifications`;
const onboardingProps = { name: NAME, loginUrl: BASE, unsubscribeUrl: UNSUB };

describe('React email templates — rendered markup is pinned', () => {
  // The shared <Tailwind> layout suspends on the FIRST render to initialise its
  // class→style engine, which legacy renderToStaticMarkup can't await. Warm it up
  // here (awaiting the thrown promise) so the synchronous renders below are stable.
  beforeAll(async () => {
    try {
      renderToStaticMarkup(
        React.createElement(
          OnboardingDay0Welcome as React.ComponentType<any>,
          onboardingProps as any,
        ),
      );
    } catch (err: unknown) {
      if (err && typeof (err as PromiseLike<unknown>).then === 'function') {
        await err;
      }
    }
    // Let the Tailwind class→style engine finish initialising before the
    // synchronous renders below (it resolves on a timer/microtask).
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  it.each([
    ['onboarding-day0-welcome', OnboardingDay0Welcome, onboardingProps],
    ['onboarding-day1-scores', OnboardingDay1Scores, onboardingProps],
    ['onboarding-day3-compare', OnboardingDay3Compare, onboardingProps],
    ['onboarding-day5-upgrade', OnboardingDay5Upgrade, onboardingProps],
    ['onboarding-day7-profile', OnboardingDay7Profile, onboardingProps],
    ['onboarding-day10-zillow', OnboardingDay10Zillow, onboardingProps],
    ['onboarding-day14-report', OnboardingDay14Report, onboardingProps],
    ['winback-day14', WinbackDay14, { name: NAME, loginUrl: BASE }],
  ])('%s', (_label, Component, props) => {
    const html = renderToStaticMarkup(
      React.createElement(Component as React.ComponentType<any>, props as any),
    );
    expect(html).toMatchSnapshot();
  });
});

describe('Backend HTML email builders — rendered HTML is pinned', () => {
  it('welcome', () =>
    expect(
      buildWelcomeEmail(NAME, `${BASE}/get-started`, UNSUB),
    ).toMatchSnapshot());
  it('active_explorer', () =>
    expect(
      buildActiveExplorerEmail(NAME, `${BASE}/graphs`, UNSUB),
    ).toMatchSnapshot());
  it('report_generated', () =>
    expect(
      buildReportGeneratedEmail(NAME, `${BASE}/reports`, UNSUB),
    ).toMatchSnapshot());
  it('paywall_hit', () =>
    expect(
      buildPaywallHitEmail(NAME, 'ZIP-level scores', `${BASE}/pricing`, UNSUB),
    ).toMatchSnapshot());
  it('post_trial_7d', () =>
    expect(
      buildPostTrial7dEmail(NAME, `${BASE}/reports`, `${BASE}/pricing`, UNSUB),
    ).toMatchSnapshot());
  it('inactive_24h', () =>
    expect(
      buildInactive24hEmail(NAME, `${BASE}/graphs`, UNSUB),
    ).toMatchSnapshot());
  it('trial_day10', () =>
    expect(
      buildTrialDay10Email(NAME, `${BASE}/pricing`, UNSUB),
    ).toMatchSnapshot());
  it('trial_day13', () =>
    expect(
      buildTrialDay13Email(NAME, `${BASE}/pricing`, UNSUB),
    ).toMatchSnapshot());
  it('trial_expired', () =>
    expect(
      buildTrialExpiredEmail(NAME, `${BASE}/pricing`, UNSUB),
    ).toMatchSnapshot());
});
