import { describe, it, expect } from 'vitest';
import { formatRent, formatBeds, formatCommute, sourceLabel, ratingSourceLabel } from './format';
import type { Source } from './types';

describe('formatRent', () => {
  it('groups thousands and marks the period', () => {
    expect(formatRent(3500)).toBe('$3,500/mo');
    expect(formatRent(950)).toBe('$950/mo');
    expect(formatRent(12500)).toBe('$12,500/mo');
  });
});

describe('formatBeds', () => {
  it('calls zero bedrooms a studio', () => {
    expect(formatBeds(0)).toBe('Studio');
  });

  it('abbreviates the rest', () => {
    expect(formatBeds(1)).toBe('1 bd');
    expect(formatBeds(3)).toBe('3 bd');
  });
});

describe('formatCommute', () => {
  it('states the minutes and the mode', () => {
    expect(formatCommute(18, 'transit')).toBe('18 min transit');
    expect(formatCommute(5, 'walk')).toBe('5 min walk');
  });
});

describe('sourceLabel', () => {
  it('gives every known source a human name', () => {
    const sources: Source[] = ['rentcast', 'apartments_com', 'zillow', 'mock'];
    for (const s of sources) {
      expect(sourceLabel(s)).not.toBe(s);
      expect(sourceLabel(s).length).toBeGreaterThan(0);
    }
    expect(sourceLabel('apartments_com')).toBe('Apartments.com');
  });

  it('falls back to the raw value for an unmapped source', () => {
    expect(sourceLabel('brand_new_portal' as Source)).toBe('brand_new_portal');
  });
});

describe('ratingSourceLabel', () => {
  it('names the known rating sources', () => {
    expect(ratingSourceLabel('google')).toBe('Google reviews');
    expect(ratingSourceLabel('platform-users')).toBe('Verified residents');
  });

  it('passes an unknown source through untouched', () => {
    expect(ratingSourceLabel('some-new-source')).toBe('some-new-source');
  });
});
