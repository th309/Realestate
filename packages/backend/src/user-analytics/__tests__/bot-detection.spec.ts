/**
 * Bot classification tests.
 *
 * The central property under test is the deliberate CONSERVATISM of the
 * predicate: a real visitor must never be flagged, even when their behaviour
 * looks exactly like a crawler's (one pageview, no duration). Getting this
 * wrong hides real people from a funnel that sees ~8 signups a month.
 */

import { classifyAsBot, hasBotUserAgent } from '../bot-detection';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('hasBotUserAgent flags self-identifying automation', () => {
  it.each([
    [
      'Googlebot',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ],
    [
      'Bingbot',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ],
    [
      'GPTBot',
      'Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
    ],
    [
      'ClaudeBot',
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    ],
    ['PerplexityBot', 'Mozilla/5.0 (compatible; PerplexityBot/1.0)'],
    ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0)'],
    ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl)'],
    ['Bytespider', 'Mozilla/5.0 (compatible; Bytespider)'],
    ['headless Chrome', 'Mozilla/5.0 HeadlessChrome/126.0.0.0 Safari/537.36'],
    ['curl', 'curl/8.4.0'],
    ['python-requests', 'python-requests/2.31.0'],
    ['Go http client', 'Go-http-client/2.0'],
    ['node-fetch', 'node-fetch/1.0'],
  ])('flags %s', (_label, ua) => {
    expect(hasBotUserAgent(ua)).toBe(true);
  });

  it('is case insensitive', () => {
    expect(hasBotUserAgent('GOOGLEBOT/2.1')).toBe(true);
  });

  it.each([
    ['desktop Chrome', CHROME_UA],
    ['iOS Safari', SAFARI_IOS_UA],
    [
      'Firefox',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
    ],
  ])('does not flag %s', (_label, ua) => {
    expect(hasBotUserAgent(ua)).toBe(false);
  });

  it('does not flag an absent User-Agent, since absence is not evidence', () => {
    expect(hasBotUserAgent('')).toBe(false);
  });
});

describe('classifyAsBot never flags a real visitor on behaviour alone', () => {
  it('does not flag a genuine one-page, zero-duration visit', () => {
    // This is the crux. A person who lands on a blog post, reads it, and leaves
    // inside the heartbeat window is indistinguishable from a crawler by
    // behaviour. The predicate must let them through.
    expect(classifyAsBot({ userAgent: CHROME_UA, pageCount: 1 })).toBe(false);
  });

  it('does not flag a visit with no pageviews recorded yet', () => {
    expect(classifyAsBot({ userAgent: SAFARI_IOS_UA, pageCount: 0 })).toBe(
      false,
    );
  });

  it('does not flag when the User-Agent is unknown', () => {
    // The proxy forwards '' when the header is missing. Defaulting to "bot"
    // there would silently delete traffic on an infrastructure hiccup.
    expect(classifyAsBot({ userAgent: '', pageCount: 1 })).toBe(false);
  });

  it('flags a declared crawler regardless of how much it browsed', () => {
    expect(
      classifyAsBot({
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        pageCount: 12,
      }),
    ).toBe(true);
  });
});
