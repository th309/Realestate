import { segmentNarration } from './narration-segmenter';

const texts = (input: string) => segmentNarration(input).map((s) => s.text);
const breaks = (input: string) =>
  segmentNarration(input).map((s) => s.breakAfterMs);

describe('segmentNarration returns one clip per sentence with pauses between', () => {
  const threeSentences =
    'Phoenix home values climbed nine percent over the last year. ' +
    'Inventory is still tight across the whole metro area. ' +
    'Buyers are moving fast across the entire spring market.';

  it('splits a multi-sentence script on sentence boundaries', () => {
    expect(texts(threeSentences)).toEqual([
      'Phoenix home values climbed nine percent over the last year.',
      'Inventory is still tight across the whole metro area.',
      'Buyers are moving fast across the entire spring market.',
    ]);
  });

  it('pauses 350ms between sentences and never after the last one', () => {
    expect(breaks(threeSentences)).toEqual([350, 350, 0]);
  });

  it('keeps question marks and exclamation points as boundaries', () => {
    expect(
      texts(
        'Which metro leads the country on rent growth this quarter? ' +
          'Tampa takes it again by a comfortable margin! ' +
          'Here is what the underlying demand data actually shows.',
      ),
    ).toHaveLength(3);
  });

  it('treats a whole script as one clip when it is shorter than a breath', () => {
    const short = 'Rents are up. Values are flat.';
    expect(segmentNarration(short)).toEqual([
      { text: 'Rents are up. Values are flat.', breakAfterMs: 0 },
    ]);
  });

  it('returns nothing for an empty or whitespace-only script', () => {
    expect(segmentNarration('')).toEqual([]);
    expect(segmentNarration('   \n\n  ')).toEqual([]);
  });

  it('collapses newlines inside a paragraph into single spaces', () => {
    expect(
      texts(
        'Phoenix home values climbed nine percent\nover the last twelve months. ' +
          'Inventory is still tight across the whole metro area.',
      )[0],
    ).toBe(
      'Phoenix home values climbed nine percent over the last twelve months.',
    );
  });
});

describe('segmentNarration pauses longer at paragraph breaks', () => {
  const twoParagraphs =
    'Phoenix inventory dropped again this month across every price band.\n\n' +
    'That is the tightest reading we have seen in the last three years.';

  it('inserts a 500ms pause where a paragraph ends', () => {
    expect(breaks(twoParagraphs)).toEqual([500, 0]);
  });

  it('still splits sentences inside each paragraph', () => {
    const breakList = breaks(
      'Phoenix inventory dropped again this month across every band. ' +
        'Days on market fell for the fourth straight month.\n\n' +
        'That is the tightest reading we have seen in three years.',
    );
    expect(breakList).toEqual([350, 500, 0]);
  });
});

describe('segmentNarration does not mistake abbreviations for sentence ends', () => {
  it('keeps "St." attached to the place name that follows it', () => {
    expect(
      texts(
        'Median rent in St. Louis climbed to 1,450 dollars last quarter. ' +
          'That beats every other Midwest metro we track this year.',
      ),
    ).toEqual([
      'Median rent in St. Louis climbed to 1,450 dollars last quarter.',
      'That beats every other Midwest metro we track this year.',
    ]);
  });

  it('keeps initialisms like "U.S." intact even before a capitalized word', () => {
    expect(
      texts(
        'The U.S. Census counted more new households last year than any year since 2007. ' +
          'That demand has to land somewhere, and the Sun Belt keeps absorbing it.',
      )[0],
    ).toBe(
      'The U.S. Census counted more new households last year than any year since 2007.',
    );
  });

  it('keeps "Dr." and "vs." from breaking a clip mid-phrase', () => {
    expect(
      texts(
        'Listings along Dr. Martin Luther King Boulevard sold in nine days. ' +
          'Cash vs. Financed offers are splitting almost evenly right now.',
      ),
    ).toHaveLength(2);
  });

  it('does not split decimals or numbers with a period', () => {
    expect(
      texts(
        'Days on market fell to 21.5 from 34.2 in the same window last year across the metro.',
      ),
    ).toEqual([
      'Days on market fell to 21.5 from 34.2 in the same window last year across the metro.',
    ]);
  });
});

describe('segmentNarration merges fragments too short to stand alone', () => {
  it('folds a short opener into the sentence after it', () => {
    expect(
      texts(
        'Here is the deal. Phoenix home values climbed nine percent over the last year. ' +
          'Inventory is still tight across the whole metro area.',
      ),
    ).toEqual([
      'Here is the deal. Phoenix home values climbed nine percent over the last year.',
      'Inventory is still tight across the whole metro area.',
    ]);
  });

  it('folds a short closer into the sentence before it', () => {
    const result = texts(
      'Phoenix home values climbed nine percent over the last year. ' +
        'Inventory is still tight across the whole metro area. Not for long.',
    );
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(
      'Inventory is still tight across the whole metro area. Not for long.',
    );
  });
});

describe('segmentNarration splits sentences too long for one breath', () => {
  const longSentence =
    'Phoenix led every Sun Belt metro on price growth again this quarter, ' +
    'Tampa followed close behind it on almost exactly the same demand signal, ' +
    'Charlotte held its ground despite a sharp jump in brand new listings, ' +
    'and Atlanta rounded out the group with the softest reading of the four markets we track.';

  it('breaks a 280-plus character sentence at clause punctuation', () => {
    const segments = segmentNarration(longSentence);
    expect(longSentence.length).toBeGreaterThan(280);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(segment.text.length).toBeLessThanOrEqual(280);
    }
  });

  it('uses a shorter 200ms pause inside a split sentence', () => {
    const segments = segmentNarration(longSentence);
    expect(segments[0].breakAfterMs).toBe(200);
    expect(segments[segments.length - 1].breakAfterMs).toBe(0);
  });

  it('keeps every word of the original script', () => {
    const rejoined = segmentNarration(longSentence)
      .map((s) => s.text)
      .join(' ');
    expect(rejoined).toBe(longSentence);
  });

  it('leaves a long sentence alone when it has no clause punctuation', () => {
    const unbroken = `Phoenix ${'demand '.repeat(45)}keeps climbing`.replace(
      /\s+/g,
      ' ',
    );
    expect(unbroken.length).toBeGreaterThan(280);
    expect(texts(unbroken)).toEqual([unbroken]);
  });
});
