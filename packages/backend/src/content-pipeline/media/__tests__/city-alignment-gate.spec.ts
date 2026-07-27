import { passesCityAlignmentGate } from '../city-alignment-gate';

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

describe('passesCityAlignmentGate rejects the right city in the wrong country', () => {
  // Both are live misses. US city names are exported worldwide, and a US-state
  // check cannot catch a foreign one.
  it('rejects Bangor, Wales for Bangor, ME', () => {
    expect(
      passesCityAlignmentGate(
        'Explore Bangor, Wales with this vibrant marina scene featuring moored boats and urban architecture.',
        'bangor',
        'ME',
      ),
    ).toBe(false);
  });

  it('rejects Johnstown Castle, Ireland for Johnstown, PA', () => {
    expect(
      passesCityAlignmentGate(
        'majestic peacock at johnstown castle ireland downtown',
        'johnstown',
        'PA',
      ),
    ).toBe(false);
  });

  it('still accepts genuine US footage', () => {
    expect(
      passesCityAlignmentGate(
        'Bangor Maine waterfront downtown',
        'bangor',
        'ME',
      ),
    ).toBe(true);
  });
});

describe('passesCityAlignmentGate rejects the right city in the wrong state', () => {
  // The live miss: Johnstown PA was served an aerial of Johnstown, CO.
  const JOHNSTOWN_CO =
    'Aerial view of a town in Johnstown, CO, featuring a sports complex and residential area.';

  it('rejects a metadata state that conflicts with the metro state', () => {
    expect(passesCityAlignmentGate(JOHNSTOWN_CO, 'johnstown', 'PA')).toBe(
      false,
    );
  });

  it('accepts it for the metro it actually depicts', () => {
    expect(passesCityAlignmentGate(JOHNSTOWN_CO, 'johnstown', 'CO')).toBe(true);
  });

  it('allows metadata that names no state at all', () => {
    // Most stock captions omit the state; city + urban checks still apply.
    expect(
      passesCityAlignmentGate('Johnstown downtown street', 'johnstown', 'PA'),
    ).toBe(true);
  });

  it('ignores the state check when the caller does not know the state', () => {
    expect(passesCityAlignmentGate(JOHNSTOWN_CO, 'johnstown')).toBe(true);
  });
});
