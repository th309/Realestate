import { passesCityAlignmentGate } from '../pexels-media';

describe('passesCityAlignmentGate accepts genuine city footage', () => {
  it.each([
    ['a slug', 'https://pexels.com/video/chicago-skyline-at-dusk-123/'],
    ['tags', 'aerial downtown chicago river'],
    ['photo alt text', 'Chicago cityscape seen from the lake'],
  ])('accepts %s naming the city with urban context', (_label, metadata) => {
    expect(passesCityAlignmentGate(metadata, 'chicago')).toBe(true);
  });

  it('accepts a multi-word city name', () => {
    expect(
      passesCityAlignmentGate(
        'salt lake city downtown street',
        'salt lake city',
      ),
    ).toBe(true);
  });

  it('is case insensitive', () => {
    expect(passesCityAlignmentGate('MIAMI SKYLINE', 'miami')).toBe(true);
  });
});

describe('passesCityAlignmentGate rejects wrong-subject media', () => {
  // The live failure: Barre VT matched a ballet clip because the slug contains
  // "barre". Right media -> no media -> NEVER wrong media.
  it('rejects the ballerina clip that matched Barre, VT', () => {
    expect(
      passesCityAlignmentGate(
        'https://www.pexels.com/video/a-ballerina-training-on-a-barre-8934028/',
        'barre',
      ),
    ).toBe(false);
  });

  it.each([
    ['reading a book on a sofa', 'reading'],
    ['a mobile phone on a desk', 'mobile'],
    ['jackson playing guitar', 'jackson'],
    ['a sandwich on a plate', 'sandwich'],
  ])('rejects "%s" for the same-named metro %s', (metadata, city) => {
    expect(passesCityAlignmentGate(metadata, city)).toBe(false);
  });

  it('rejects urban footage that does not name the city', () => {
    expect(
      passesCityAlignmentGate('generic city skyline at night', 'austin'),
    ).toBe(false);
  });

  it('rejects a city name embedded inside a larger word', () => {
    // "barrelhouse" contains "barre" but is not the city.
    expect(
      passesCityAlignmentGate('barrelhouse bar downtown street', 'barre'),
    ).toBe(false);
  });

  it('rejects empty metadata', () => {
    expect(passesCityAlignmentGate('', 'chicago')).toBe(false);
  });
});
