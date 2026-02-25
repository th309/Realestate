import { describe, it, expect } from 'vitest';
import {
  generateMetroSlug,
  getMetroShortName,
  getMetroState,
} from '../metro-slugs';

describe('generateMetroSlug', () => {
  it('converts simple metro name', () => {
    expect(generateMetroSlug('Austin-Round Rock-Georgetown, TX')).toBe(
      'austin-round-rock-georgetown-tx'
    );
  });
  it('handles multi-state metros', () => {
    expect(
      generateMetroSlug('New York-Newark-Jersey City, NY-NJ-PA')
    ).toBe('new-york-newark-jersey-city-ny-nj-pa');
  });
  it('handles apostrophes', () => {
    expect(generateMetroSlug("Coeur d'Alene, ID")).toBe('coeur-dalene-id');
  });
  it('handles periods', () => {
    expect(generateMetroSlug('St. Louis, MO-IL')).toBe('st-louis-mo-il');
  });
});

describe('getMetroShortName', () => {
  it('extracts first city and state', () => {
    expect(getMetroShortName('Austin-Round Rock-Georgetown, TX')).toBe(
      'Austin, TX'
    );
  });
  it('handles multi-state', () => {
    expect(
      getMetroShortName('New York-Newark-Jersey City, NY-NJ-PA')
    ).toBe('New York, NY');
  });
  it('handles single city', () => {
    expect(getMetroShortName('Miami, FL')).toBe('Miami, FL');
  });
});

describe('getMetroState', () => {
  it('extracts state abbreviation', () => {
    expect(getMetroState('Austin-Round Rock-Georgetown, TX')).toBe('TX');
  });
  it('extracts first state from multi-state', () => {
    expect(getMetroState('New York-Newark-Jersey City, NY-NJ-PA')).toBe(
      'NY'
    );
  });
  it('returns empty for no comma', () => {
    expect(getMetroState('Unknown Metro')).toBe('');
  });
});
