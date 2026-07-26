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

  it('does not select rows/versus with only one market (below threshold)', () => {
    const oneMarket = [
      { name: 'Abilene', state: 'TX', score: 94, scoreLabel: 'very strong' },
    ];
    const listy = new Set([
      'daily_card_rows',
      'editorial_ranking',
      'daily_card_versus',
      'editorial_versus',
    ]);
    for (const sd of seeds) {
      const v = copyToImageContents(
        'linkedin_post',
        { hook: 'x' },
        { markets: oneMarket },
        sd,
      )[0].content.variant;
      expect(listy.has(v)).toBe(false);
    }
  });

  it('caps a rows card at 5 markets even when more are supplied', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `City ${i}`,
      state: 'TX',
      score: 90 - i,
      scoreLabel: 'strong',
    }));
    let rowsContent;
    for (let i = 0; i < 300 && !rowsContent; i++) {
      const c = copyToImageContents(
        'linkedin_post',
        { hook: 'x' },
        { markets: many },
        `cap-${i}`,
      )[0].content;
      if (
        c.variant === 'daily_card_rows' ||
        c.variant === 'editorial_ranking'
      ) {
        rowsContent = c;
      }
    }
    expect(rowsContent).toBeDefined();
    expect(rowsContent!.rows!.length).toBe(5);
  });

  it('applies shortMarketName to row names (CBSA title -> City, ST)', () => {
    const cbsa = [
      {
        name: 'Houston-The Woodlands-Sugar Land, TX',
        score: 70,
        scoreLabel: 'rising',
      },
      {
        name: 'Dallas-Fort Worth-Arlington, TX',
        score: 65,
        scoreLabel: 'firming',
      },
      {
        name: 'Austin-Round Rock-Georgetown, TX',
        score: 55,
        scoreLabel: 'steady',
      },
    ];
    let rowsContent;
    for (let i = 0; i < 300 && !rowsContent; i++) {
      const c = copyToImageContents(
        'linkedin_post',
        { hook: 'x' },
        { markets: cbsa },
        `cbsa-${i}`,
      )[0].content;
      if (
        c.variant === 'daily_card_rows' ||
        c.variant === 'editorial_ranking'
      ) {
        rowsContent = c;
      }
    }
    expect(rowsContent).toBeDefined();
    expect(rowsContent!.rows!.map((r) => r.name)).toContain('Houston, TX');
    expect(
      rowsContent!.rows!.every((r) => !r.name.includes('The Woodlands')),
    ).toBe(true);
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

/**
 * Regression: rendered cards dropped an interior run of body copy and resumed
 * MID-NUMBER, so the graphic stated a DIFFERENT statistic than its own caption —
 * a body reading "dropped 22.6% year over year" rendered as "6% year over year".
 * The rule these tests lock in: a card excerpt is always a PREFIX of the body.
 * Dropping a trailing run and marking it with "…" is the only edit allowed;
 * splicing text out of the middle means the card is inventing a number.
 */
describe('card excerpts never splice interior copy (mid-number cut)', () => {
  const JOHNSTOWN =
    'The median home value dropped 22.6% year over year, and rents are flat. ' +
    'Johnstown, PA now scores 12 on the PropertyIQ Score, weak momentum against ' +
    'a state average of 50. Median days on market stretched to 61, and 34.8% of ' +
    'listings took a price cut last month. PropertyIQ tracks the turn before ' +
    'list prices catch up.';

  const BANGOR =
    'A score of 83 signals strong momentum. The jump suggests Bangor’s ' +
    'market is heating up, even as median home values sit at $289,934, down ' +
    '4.5% year over year. Median rent held steady at $1,563.';

  /** Every excerpt must be a leading slice of the body (a trailing "…" aside). */
  function expectPrefixOf(excerpt: string, body: string): void {
    const normalized = body.trim().replace(/\s+/g, ' ');
    const withoutEllipsis = excerpt.replace(/…$/, '');
    expect(normalized.startsWith(withoutEllipsis)).toBe(true);
  }

  const budgets = [80, 120, 160, 200, 260];

  it('keeps a decimal statistic whole instead of resuming mid-number', () => {
    for (const budget of budgets) {
      const out = leadingSentences(JOHNSTOWN, budget);
      expectPrefixOf(out, JOHNSTOWN);
      expect(out.startsWith('6%')).toBe(false);
      // If the drop is quoted at all it must read 22.6%, never a bare 6%.
      if (out.includes('% year over year')) {
        expect(out).toContain('22.6% year over year');
      }
    }
  });

  it('never drops an interior sentence from a multi-statistic body', () => {
    for (const budget of budgets) {
      const out = leadingSentences(BANGOR, budget);
      expectPrefixOf(out, BANGOR);
      expect(out).not.toContain('momentum. 5% year over year');
      // The $289,934 clause may be dropped from the END, but if the sentence
      // that carries the YoY figure survives, it must carry its subject too.
      if (out.includes('4.5%')) {
        expect(out).toContain('median home values sit at $289,934');
      }
    }
  });

  it('treats a decimal point as part of the number, not a sentence end', () => {
    const body =
      'Inventory rose 3.4% while days on market fell to 28.6 from 41.2 last ' +
      'spring, a swing that usually shows up in list prices within two quarters. ' +
      'PropertyIQ tracks it monthly so the turn is visible before the sale prices move.';
    for (const budget of budgets) {
      const out = leadingSentences(body, budget);
      expectPrefixOf(out, body);
      expect(out.startsWith('Inventory rose')).toBe(true);
    }
  });

  it('builds single-post card copy that is a prefix of the post body', () => {
    const copy = {
      hook: 'Johnstown, PA is cooling fast.',
      body: JOHNSTOWN,
      cta: 'See the full breakdown at propertyiq.app',
    };
    const subheads = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      .flatMap((seed) =>
        copyToImageContents('image_post', copy, undefined, seed),
      )
      .map((item) => item.content.subhead)
      .filter((text): text is string => !!text);

    expect(subheads.length).toBeGreaterThan(0);
    for (const subhead of subheads) expectPrefixOf(subhead, JOHNSTOWN);
  });
});
