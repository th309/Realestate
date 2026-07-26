import {
  buildCarouselSlideHtml,
  buildSinglePostHtml,
  copyToImageContents,
} from '../post-image-templates';
import { DISCLAIMER, fitField, leadingSentences } from '../post-image-shared';
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

  // Selection is deterministic-per-seed among the variants the DATA supports, so
  // a feed shows a mix and a regenerate (new seed) cycles the look. These assert
  // the eligibility contract across many seeds rather than one fixed variant.
  const seeds = Array.from({ length: 24 }, (_, i) => `seed-${i}`);

  it('stat cards are reachable and always show the REAL score (never invented)', () => {
    const grounding: PostImageGrounding = {
      marketName: 'Buffalo',
      state: 'NY',
      score: 98,
      scoreLabel: 'very strong',
    };
    const contents = seeds.map(
      (sd) =>
        copyToImageContents(
          'linkedin_post',
          { hook: 'Buffalo is outrunning its state' },
          grounding,
          sd,
        )[0].content,
    );
    // A stat look is reachable when a real number exists...
    expect(contents.some((c) => c.stat != null)).toBe(true);
    // ...and whenever one is shown, it carries the real score, never a fabrication.
    for (const c of contents) {
      if (c.stat) expect(c.stat.value).toBe('98');
    }
  });

  it('with no number and no markets, only typographic looks are used (no stat, no rows)', () => {
    for (const sd of seeds) {
      const c = copyToImageContents(
        'facebook_post',
        { hook: 'A market to watch' },
        { marketName: 'Nowhere' },
        sd,
      )[0].content;
      expect([
        'daily_card_hook',
        'editorial_claim',
        'quote_highlight',
      ]).toContain(c.variant);
      expect(c.stat).toBeUndefined();
      expect(c.rows).toBeUndefined();
    }
  });

  it('never invents a number: no stat when score and value are absent', () => {
    const out = copyToImageContents('linkedin_post', { hook: 'x' }, {}, 's');
    expect(out[0].content.stat).toBeUndefined();
  });

  it('picks a look deterministically from the seed (same seed → same variant)', () => {
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
    expect(a.content.variant).toBe(b.content.variant);
    expect(a.content.family).toBe(b.content.family);
  });

  const texasMarkets = [
    { name: 'Abilene', state: 'TX', score: 94, scoreLabel: 'very strong' },
    { name: 'Austin', state: 'TX', score: 2, scoreLabel: 'very weak' },
    { name: 'Dallas', state: 'TX', score: 5, scoreLabel: 'very weak' },
  ];

  it('rows and versus looks are reachable with markets and never used without them', () => {
    const withMarkets = seeds.map(
      (sd) =>
        copyToImageContents(
          'linkedin_post',
          { hook: 'Texas' },
          { markets: texasMarkets },
          sd,
        )[0].content.variant,
    );
    expect(
      withMarkets.some(
        (v) => v === 'daily_card_rows' || v === 'editorial_ranking',
      ),
    ).toBe(true);
    expect(
      withMarkets.some(
        (v) => v === 'daily_card_versus' || v === 'editorial_versus',
      ),
    ).toBe(true);

    const listy = new Set([
      'daily_card_rows',
      'editorial_ranking',
      'daily_card_versus',
      'editorial_versus',
    ]);
    const noMarkets = seeds.map(
      (sd) =>
        copyToImageContents('linkedin_post', { hook: 'x' }, {}, sd)[0].content
          .variant,
    );
    expect(noMarkets.some((v) => listy.has(v))).toBe(false);
  });

  it('rows map real markets to momentum rows (momentum word + tone, never a letter grade)', () => {
    let rowsContent;
    for (let i = 0; i < 300 && !rowsContent; i++) {
      const c = copyToImageContents(
        'linkedin_post',
        { hook: 'Texas markets' },
        { markets: texasMarkets },
        `r-${i}`,
      )[0].content;
      if (
        c.variant === 'daily_card_rows' ||
        c.variant === 'editorial_ranking'
      ) {
        rowsContent = c;
      }
    }
    expect(rowsContent).toBeDefined();
    expect(rowsContent!.rows!.length).toBeGreaterThanOrEqual(3);
    expect(rowsContent!.rows![0]).toMatchObject({
      name: 'Abilene, TX',
      score: '94',
      momentum: 'VERY STRONG',
    });
    expect(['pos', 'neg', 'neutral', 'warn']).toContain(
      rowsContent!.rows![0].tone,
    );
    // The chip renders the momentum WORD, not an A/F grade.
    expect(buildSinglePostHtml(rowsContent)).toContain('VERY STRONG');
  });

  it('versus uses the first two markets', () => {
    let versus;
    for (let i = 0; i < 300 && !versus; i++) {
      const c = copyToImageContents(
        'linkedin_post',
        { hook: 'Head to head' },
        { markets: texasMarkets },
        `v-${i}`,
      )[0].content;
      if (c.variant === 'daily_card_versus' || c.variant === 'editorial_versus')
        versus = c;
    }
    expect(versus).toBeDefined();
    expect(versus!.rows).toHaveLength(2);
    expect(versus!.rows![0].name).toBe('Abilene, TX');
    expect(versus!.rows![1].name).toBe('Austin, TX');
  });

  it('quote look highlights an emphasis phrase with the inline green stroke', () => {
    let quote;
    for (let i = 0; i < 300 && !quote; i++) {
      const c = copyToImageContents(
        'linkedin_post',
        { hook: 'The best markets are the ones just starting to turn' },
        {},
        `q-${i}`,
      )[0].content;
      if (c.variant === 'quote_highlight') quote = c;
    }
    expect(quote).toBeDefined();
    expect(quote!.emphasis).toBeTruthy();
    // The highlighter stroke is an inline-SVG data-URI background (self-contained).
    expect(buildSinglePostHtml(quote)).toContain('background-image:url');
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

describe('text fit — never cut off legal copy', () => {
  const realCta =
    'See the full momentum breakdown at propertyiq.app. Start with our free tier, no credit card required. PropertyIQ. Now you know.';

  it('fitField passes legal copy through with no ellipsis', () => {
    expect(fitField(realCta, 500, 'cta')).toBe(realCta);
    expect(fitField(realCta, 500, 'cta')).not.toContain('…');
  });

  it('leadingSentences returns whole sentences, never a mid-word ellipsis', () => {
    const body =
      'PropertyIQ reads demand momentum monthly, so a quiet slide shows up before the sale prices do. Check yours before you make the next move. A third sentence far beyond the soft cap that must be dropped at a boundary.';
    const out = leadingSentences(body, 140);
    expect(out).not.toContain('…');
    expect(out.endsWith('.')).toBe(true);
    expect(out).toContain('quiet slide shows up');
  });

  it('leadingSentences word-safe backstops a punctuation-less body (no bypass)', () => {
    const noPunct = 'word '.repeat(200).trim(); // ~1000 chars, no . ! ?
    const out = leadingSentences(noPunct, 260);
    expect(out.length).toBeLessThan(280); // capped, not returned whole
    expect(out.endsWith('…')).toBe(true); // word-safe backstop, not a raw blob
  });

  it('carousel closer keeps the FULL hook + cta (Troy: never cut off)', () => {
    const out = copyToImageContents('carousel_copy', {
      hook: 'Plattsburgh, NY climbed 58 points on the PropertyIQ Score. Now at 96, very strong momentum.',
      slides: [{ heading: 'X', body: 'Y' }],
      cta: realCta,
    });
    const closer = out[out.length - 1].content;
    expect(closer.variant).toBe('closer');
    expect(closer.headline).not.toContain('…');
    expect(closer.cta).not.toContain('…');
    expect(closer.headline).toContain('very strong momentum');
    expect(closer.cta).toContain('Now you know');
  });
});
