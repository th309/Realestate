import {
  buildCarouselSlideHtml,
  buildSinglePostHtml,
  copyToImageContents,
} from '../post-image-templates';
import { DISCLAIMER } from '../post-image-shared';
import { PostImageGrounding } from '../post-image.types';

describe('copyToImageContents', () => {
  it('returns no images for video_script (a suggestion, not a post)', () => {
    expect(
      copyToImageContents('video_script', { hook: 'x', body: 'y', title: 't' }),
    ).toEqual([]);
  });

  it('yields cover + one-per-slide + closer for a carousel', () => {
    const out = copyToImageContents('carousel_copy', {
      hook: 'Three cooling markets',
      slides: [
        { heading: 'Denver', body: 'Down 12' },
        { heading: 'Tampa', body: 'Down 8' },
      ],
      cta: 'propertyiq.app',
    });
    expect(out).toHaveLength(4); // cover + 2 slides + closer
    expect(out[0].content.variant).toBe('cover');
    expect(out[1].content.variant).toBe('content');
    expect(out[3].content.variant).toBe('closer');
    expect(out.every((o) => o.template === 'carousel_slide')).toBe(true);
  });

  it('uses a stat variant when grounding has a real score', () => {
    const grounding: PostImageGrounding = {
      marketName: 'Buffalo',
      state: 'NY',
      score: 98,
      scoreLabel: 'very strong',
    };
    const out = copyToImageContents(
      'linkedin_post',
      { hook: 'Buffalo is outrunning its state' },
      grounding,
      'seed-a',
    );
    expect(out).toHaveLength(1);
    expect(['daily_card_stat', 'editorial_stat']).toContain(
      out[0].content.variant,
    );
    expect(out[0].content.stat?.value).toBe('98');
  });

  it('falls back to a typographic variant when grounding has no number', () => {
    const out = copyToImageContents(
      'facebook_post',
      { hook: 'A market to watch' },
      { marketName: 'Nowhere' },
      'seed-b',
    );
    expect(['daily_card_hook', 'editorial_claim']).toContain(
      out[0].content.variant,
    );
    expect(out[0].content.stat).toBeUndefined();
  });

  it('never invents a number: no stat when score and value are absent', () => {
    const out = copyToImageContents('linkedin_post', { hook: 'x' }, {}, 's');
    expect(out[0].content.stat).toBeUndefined();
  });

  it('picks a family deterministically from the seed', () => {
    const a = copyToImageContents(
      'linkedin_post',
      { hook: 'x' },
      {},
      'same',
    )[0];
    const b = copyToImageContents(
      'linkedin_post',
      { hook: 'x' },
      {},
      'same',
    )[0];
    expect(a.content.family).toBe(b.content.family);
  });
});

describe('template HTML', () => {
  const [{ content }] = copyToImageContents(
    'linkedin_post',
    { hook: 'Seattle cooled fast', cta: 'propertyiq.app' },
    { marketName: 'Seattle', state: 'WA', score: 16, scoreLabel: 'weak' },
    'seed-dark',
  );

  it('embeds the fonts as base64 woff2 (no host-font dependency)', () => {
    const html = buildSinglePostHtml(content);
    expect(html).toContain('@font-face');
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toContain("font-family:'Roboto Mono'");
  });

  it('always carries the standing disclaimer + site', () => {
    const html = buildSinglePostHtml(content);
    expect(html).toContain(DISCLAIMER);
    expect(html).toContain('propertyiq.app');
  });

  it('escapes copy text into the markup', () => {
    const html = buildSinglePostHtml({
      ...content,
      headline: 'A & B <script>',
    });
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('applies the render scale to the --s variable', () => {
    expect(buildCarouselSlideHtml(content, 0.85)).toContain('--s:0.85');
  });
});
