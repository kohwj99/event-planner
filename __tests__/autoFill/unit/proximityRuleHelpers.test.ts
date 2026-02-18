import { describe, it, expect } from 'vitest';
import {
  shouldSitTogether,
  shouldSitAway,
  getAllSitTogetherPartners,
  getSitAwayGuests,
  isVIP,
} from '@/utils/autoFill/proximityRuleHelpers';
import { createSitTogetherRule, createSitAwayRule } from '../factories/rulesFactory';

describe('shouldSitTogether', () => {
  it('returns true for existing pair (forward order)', () => {
    const rules = [createSitTogetherRule('a', 'b')];
    expect(shouldSitTogether('a', 'b', rules)).toBe(true);
  });

  it('returns true for existing pair (reverse order)', () => {
    const rules = [createSitTogetherRule('a', 'b')];
    expect(shouldSitTogether('b', 'a', rules)).toBe(true);
  });

  it('returns false for non-existing pair', () => {
    const rules = [createSitTogetherRule('a', 'b')];
    expect(shouldSitTogether('a', 'c', rules)).toBe(false);
  });

  it('returns false with empty rules', () => {
    expect(shouldSitTogether('a', 'b', [])).toBe(false);
  });
});

describe('shouldSitAway', () => {
  it('returns true for existing pair', () => {
    const rules = [createSitAwayRule('a', 'b')];
    expect(shouldSitAway('a', 'b', rules)).toBe(true);
  });

  it('returns true for reverse order', () => {
    const rules = [createSitAwayRule('a', 'b')];
    expect(shouldSitAway('b', 'a', rules)).toBe(true);
  });

  it('returns false for non-existing pair', () => {
    const rules = [createSitAwayRule('a', 'b')];
    expect(shouldSitAway('a', 'c', rules)).toBe(false);
  });
});

describe('getAllSitTogetherPartners', () => {
  it('returns all partners for a guest', () => {
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('a', 'c'),
    ];
    const partners = getAllSitTogetherPartners('a', rules);
    expect(partners.sort()).toEqual(['b', 'c']);
  });

  it('returns partners from both directions', () => {
    const rules = [
      createSitTogetherRule('b', 'a'),
      createSitTogetherRule('a', 'c'),
    ];
    const partners = getAllSitTogetherPartners('a', rules);
    expect(partners.sort()).toEqual(['b', 'c']);
  });

  it('returns empty array for guest with no rules', () => {
    const rules = [createSitTogetherRule('a', 'b')];
    expect(getAllSitTogetherPartners('c', rules)).toEqual([]);
  });

  it('deduplicates partners', () => {
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('b', 'a'), // duplicate pair
    ];
    const partners = getAllSitTogetherPartners('a', rules);
    expect(partners).toEqual(['b']);
  });
});

describe('getSitAwayGuests', () => {
  it('returns all avoidance targets', () => {
    const rules = [
      createSitAwayRule('a', 'b'),
      createSitAwayRule('a', 'c'),
    ];
    const targets = getSitAwayGuests('a', rules);
    expect(targets.sort()).toEqual(['b', 'c']);
  });

  it('returns targets from both directions', () => {
    const rules = [
      createSitAwayRule('b', 'a'),
      createSitAwayRule('a', 'c'),
    ];
    const targets = getSitAwayGuests('a', rules);
    expect(targets.sort()).toEqual(['b', 'c']);
  });

  it('returns empty array for guest with no rules', () => {
    const rules = [createSitAwayRule('a', 'b')];
    expect(getSitAwayGuests('c', rules)).toEqual([]);
  });
});

describe('isVIP', () => {
  it('returns true for ranking 1', () => {
    expect(isVIP({ ranking: 1 })).toBe(true);
  });

  it('returns true for ranking 4', () => {
    expect(isVIP({ ranking: 4 })).toBe(true);
  });

  it('returns false for ranking 5', () => {
    expect(isVIP({ ranking: 5 })).toBe(false);
  });

  it('returns false for ranking 0', () => {
    expect(isVIP({ ranking: 0 })).toBe(false);
  });

  it('returns false for undefined ranking', () => {
    expect(isVIP({})).toBe(false);
  });

  it('returns false for null guest', () => {
    expect(isVIP(null)).toBe(false);
  });
});
