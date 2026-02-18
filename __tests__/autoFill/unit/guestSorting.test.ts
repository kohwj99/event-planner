import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getGuestFieldValue,
  makeComparator,
  makeComparatorWithHostTieBreak,
  shuffleArray,
  applyRandomizeOrder,
  isRandomizeOrderApplicable,
} from '@/utils/autoFill/guestSorting';
import { createGuest, createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createSortRule, createRandomizeConfig, createRandomizePartition } from '../factories/rulesFactory';

beforeEach(() => {
  resetGuestCounter();
});

describe('getGuestFieldValue', () => {
  it('returns name field value', () => {
    const guest = createGuest({ name: 'Alice' });
    expect(getGuestFieldValue(guest, 'name')).toBe('Alice');
  });

  it('returns country field value', () => {
    const guest = createGuest({ country: 'Japan' });
    expect(getGuestFieldValue(guest, 'country')).toBe('Japan');
  });

  it('maps "organization" to guest.company', () => {
    const guest = createGuest({ company: 'MegaCorp' });
    expect(getGuestFieldValue(guest, 'organization')).toBe('MegaCorp');
  });

  it('returns ranking as number', () => {
    const guest = createGuest({ ranking: 3 });
    expect(getGuestFieldValue(guest, 'ranking')).toBe(3);
  });

  it('returns undefined for null guest', () => {
    expect(getGuestFieldValue(null, 'name')).toBeUndefined();
  });

  it('returns empty string when neither company nor organization exists', () => {
    const guest = { id: 'g', name: 'Test', ranking: 1, fromHost: true };
    expect(getGuestFieldValue(guest, 'organization')).toBe('');
  });
});

describe('makeComparator', () => {
  it('sorts by ranking ascending (lower number first)', () => {
    const cmp = makeComparator([createSortRule({ field: 'ranking', direction: 'asc' })]);
    const g1 = createGuest({ ranking: 1 });
    const g2 = createGuest({ ranking: 5 });
    expect(cmp(g1, g2)).toBeLessThan(0);
  });

  it('sorts by ranking descending (higher number first)', () => {
    const cmp = makeComparator([createSortRule({ field: 'ranking', direction: 'desc' })]);
    const g1 = createGuest({ ranking: 1 });
    const g2 = createGuest({ ranking: 5 });
    expect(cmp(g1, g2)).toBeGreaterThan(0);
  });

  it('sorts by name ascending (alphabetical)', () => {
    const cmp = makeComparator([createSortRule({ field: 'name', direction: 'asc' })]);
    const g1 = createGuest({ name: 'Alice' });
    const g2 = createGuest({ name: 'Bob' });
    expect(cmp(g1, g2)).toBeLessThan(0);
  });

  it('sorts by name descending (reverse alphabetical)', () => {
    const cmp = makeComparator([createSortRule({ field: 'name', direction: 'desc' })]);
    const g1 = createGuest({ name: 'Alice' });
    const g2 = createGuest({ name: 'Bob' });
    expect(cmp(g1, g2)).toBeGreaterThan(0);
  });

  it('sorts by country ascending', () => {
    const cmp = makeComparator([createSortRule({ field: 'country', direction: 'asc' })]);
    const g1 = createGuest({ name: 'A', country: 'France' });
    const g2 = createGuest({ name: 'B', country: 'Japan' });
    expect(cmp(g1, g2)).toBeLessThan(0);
  });

  it('sorts by organization ascending, mapping company field', () => {
    const cmp = makeComparator([createSortRule({ field: 'organization', direction: 'asc' })]);
    const g1 = createGuest({ name: 'A', company: 'Alpha' });
    const g2 = createGuest({ name: 'B', company: 'Beta' });
    expect(cmp(g1, g2)).toBeLessThan(0);
  });

  it('applies multi-field sort: primary ranking, secondary name', () => {
    const cmp = makeComparator([
      createSortRule({ field: 'ranking', direction: 'asc' }),
      createSortRule({ field: 'name', direction: 'asc' }),
    ]);
    const g1 = createHostGuest({ name: 'Bob', ranking: 1 });
    const g2 = createHostGuest({ name: 'Alice', ranking: 1 });
    // Same ranking, so name decides: Alice < Bob
    expect(cmp(g1, g2)).toBeGreaterThan(0);
  });

  it('uses host-first tiebreaker when sort fields are equal', () => {
    const cmp = makeComparator([createSortRule({ field: 'ranking', direction: 'asc' })]);
    const host = createHostGuest({ name: 'Alice', ranking: 3 });
    const ext = createExternalGuest({ name: 'Alice', ranking: 3 });
    expect(cmp(host, ext)).toBeLessThan(0);
  });

  it('uses alphabetical name tiebreaker when host/external are same', () => {
    const cmp = makeComparator([createSortRule({ field: 'ranking', direction: 'asc' })]);
    const g1 = createHostGuest({ name: 'Bob', ranking: 3 });
    const g2 = createHostGuest({ name: 'Alice', ranking: 3 });
    expect(cmp(g1, g2)).toBeGreaterThan(0);
  });

  it('handles null/undefined field values by treating as empty', () => {
    const cmp = makeComparator([createSortRule({ field: 'country', direction: 'asc' })]);
    const g1 = { id: 'g1', name: 'A', fromHost: true, country: undefined };
    const g2 = createGuest({ name: 'B', country: 'USA' });
    // empty < "usa"
    expect(cmp(g1, g2)).toBeLessThan(0);
  });

  it('treats ranking 0 correctly in numeric comparison', () => {
    const cmp = makeComparator([createSortRule({ field: 'ranking', direction: 'asc' })]);
    const g1 = createGuest({ ranking: 0 });
    const g2 = createGuest({ ranking: 5 });
    expect(cmp(g1, g2)).toBeLessThan(0);
  });
});

describe('makeComparatorWithHostTieBreak', () => {
  it('preserves base comparator result when non-zero', () => {
    const base = (_a: unknown, _b: unknown) => -1;
    const cmp = makeComparatorWithHostTieBreak(base);
    const g1 = createHostGuest({ id: 'a' });
    const g2 = createExternalGuest({ id: 'b' });
    expect(cmp(g1, g2)).toBe(-1);
  });

  it('breaks ties with host-first ordering', () => {
    const base = (_a: unknown, _b: unknown) => 0;
    const cmp = makeComparatorWithHostTieBreak(base);
    const host = createHostGuest({ id: 'a' });
    const ext = createExternalGuest({ id: 'b' });
    expect(cmp(host, ext)).toBeLessThan(0);
    expect(cmp(ext, host)).toBeGreaterThan(0);
  });

  it('breaks host-type ties with ID comparison', () => {
    const base = (_a: unknown, _b: unknown) => 0;
    const cmp = makeComparatorWithHostTieBreak(base);
    const g1 = createHostGuest({ id: 'aaa' });
    const g2 = createHostGuest({ id: 'zzz' });
    expect(cmp(g1, g2)).toBeLessThan(0);
  });
});

describe('shuffleArray', () => {
  it('returns a new array (does not mutate original)', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffleArray(original);
    expect(original).toEqual(copy);
  });

  it('preserves all elements (same length, same set)', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffleArray(original);
    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.sort((a, b) => a - b)).toEqual(original.sort((a, b) => a - b));
  });

  it('produces different orderings for large arrays', () => {
    const original = Array.from({ length: 50 }, (_, i) => i);
    const shuffled = shuffleArray(original);
    // Extremely unlikely that a 50-element shuffle produces the same order
    expect(shuffled).not.toEqual(original);
  });
});

describe('applyRandomizeOrder', () => {
  it('returns input unchanged when disabled', () => {
    const guests = [createGuest({ ranking: 1 }), createGuest({ ranking: 2 })];
    const config = createRandomizeConfig({ enabled: false });
    const result = applyRandomizeOrder(guests, config);
    expect(result).toEqual(guests);
  });

  it('returns input unchanged when partitions are empty', () => {
    const guests = [createGuest({ ranking: 1 }), createGuest({ ranking: 2 })];
    const config = createRandomizeConfig({ enabled: true, partitions: [] });
    const result = applyRandomizeOrder(guests, config);
    expect(result).toEqual(guests);
  });

  it('shuffles guests within a single partition range', () => {
    // Create many guests so shuffle is observable
    resetGuestCounter();
    const guests = Array.from({ length: 20 }, (_, i) =>
      createGuest({ ranking: i + 1 })
    );
    const config = createRandomizeConfig({
      enabled: true,
      partitions: [createRandomizePartition({ minRank: 1, maxRank: 21 })],
    });
    const result = applyRandomizeOrder(guests, config);
    expect(result).toHaveLength(guests.length);
    // All same elements
    const resultIds = result.map((g: { id: string }) => g.id).sort();
    const inputIds = guests.map(g => g.id).sort();
    expect(resultIds).toEqual(inputIds);
  });

  it('preserves guests outside any partition', () => {
    resetGuestCounter();
    const guest1 = createGuest({ ranking: 1 });
    const guest2 = createGuest({ ranking: 5 });
    const guest3 = createGuest({ ranking: 10 });
    const guests = [guest1, guest2, guest3];
    // Only shuffle ranks 4-6
    const config = createRandomizeConfig({
      enabled: true,
      partitions: [createRandomizePartition({ minRank: 4, maxRank: 7 })],
    });
    const result = applyRandomizeOrder(guests, config);
    // guest1 (rank 1) and guest3 (rank 10) should stay in same positions
    expect(result[0].id).toBe(guest1.id);
    expect(result[2].id).toBe(guest3.id);
  });

  it('handles partition with only 1 guest (no change)', () => {
    resetGuestCounter();
    const guests = [
      createGuest({ ranking: 1 }),
      createGuest({ ranking: 5 }),
      createGuest({ ranking: 10 }),
    ];
    const config = createRandomizeConfig({
      enabled: true,
      partitions: [createRandomizePartition({ minRank: 1, maxRank: 2 })],
    });
    const result = applyRandomizeOrder(guests, config);
    // Only one guest in [1,2), so order is unchanged
    expect(result.map((g: { id: string }) => g.id)).toEqual(guests.map(g => g.id));
  });

  it('uses inclusive lower bound and exclusive upper bound: [minRank, maxRank)', () => {
    resetGuestCounter();
    const guest1 = createGuest({ ranking: 3 }); // should be included
    const guest2 = createGuest({ ranking: 5 }); // should be included
    const guest3 = createGuest({ ranking: 7 }); // should NOT be included (exclusive)
    const guests = [guest1, guest2, guest3];
    const config = createRandomizeConfig({
      enabled: true,
      partitions: [createRandomizePartition({ minRank: 3, maxRank: 7 })],
    });
    const result = applyRandomizeOrder(guests, config);
    // guest3 (rank 7) should stay in position 2
    expect(result[2].id).toBe(guest3.id);
  });
});

describe('isRandomizeOrderApplicable', () => {
  it('returns true for exactly 1 ranking sort rule', () => {
    expect(isRandomizeOrderApplicable([createSortRule({ field: 'ranking' })])).toBe(true);
  });

  it('returns false for 0 sort rules', () => {
    expect(isRandomizeOrderApplicable([])).toBe(false);
  });

  it('returns false for 2 sort rules even if first is ranking', () => {
    expect(isRandomizeOrderApplicable([
      createSortRule({ field: 'ranking' }),
      createSortRule({ field: 'name' }),
    ])).toBe(false);
  });

  it('returns false for 1 rule that is not ranking', () => {
    expect(isRandomizeOrderApplicable([createSortRule({ field: 'name' })])).toBe(false);
  });
});
