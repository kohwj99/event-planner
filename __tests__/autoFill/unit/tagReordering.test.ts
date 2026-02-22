import { describe, it, expect, beforeEach } from 'vitest';
import { reorderForTagSimilarity, buildTagSignature } from '@/utils/autoFill/tagReordering';
import { createGuest, resetGuestCounter } from '../factories/guestFactory';

// Simple no-op comparator (preserves original order on tie)
const noopComparator = (_a: any, _b: any) => 0;

// Ranking-based comparator (ascending)
const rankingComparator = (a: any, b: any) => a.ranking - b.ranking;

beforeEach(() => {
  resetGuestCounter();
});

describe('buildTagSignature', () => {
  it('returns empty string for guest with no tags', () => {
    const guest = createGuest({ tags: [] });
    expect(buildTagSignature(guest)).toBe('');
  });

  it('returns empty string for guest with undefined tags', () => {
    const guest = createGuest();
    guest.tags = undefined as any;
    expect(buildTagSignature(guest)).toBe('');
  });

  it('returns single tag as-is', () => {
    const guest = createGuest({ tags: ['Cybersecurity'] });
    expect(buildTagSignature(guest)).toBe('Cybersecurity');
  });

  it('sorts multiple tags alphabetically', () => {
    const guest = createGuest({ tags: ['Bahasa', 'Cybersecurity', 'Analytics'] });
    expect(buildTagSignature(guest)).toBe('Analytics|Bahasa|Cybersecurity');
  });

  it('produces identical signatures for same tags in different order', () => {
    const g1 = createGuest({ tags: ['Bahasa', 'Cybersecurity'] });
    const g2 = createGuest({ tags: ['Cybersecurity', 'Bahasa'] });
    expect(buildTagSignature(g1)).toBe(buildTagSignature(g2));
  });
});

describe('reorderForTagSimilarity', () => {
  it('returns empty array for empty input', () => {
    const result = reorderForTagSimilarity([], noopComparator);
    expect(result).toEqual([]);
  });

  it('returns unchanged array when no guests have tags', () => {
    const guests = [
      createGuest({ id: 'a', name: 'Alice', tags: [] }),
      createGuest({ id: 'b', name: 'Bob', tags: [] }),
      createGuest({ id: 'c', name: 'Charlie', tags: [] }),
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    expect(result.map(g => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns unchanged array when all guests have unique tags', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', tags: ['Analytics'] }),
      createGuest({ id: 'c', tags: ['Bahasa'] }),
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    expect(result.map(g => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('groups guests with identical tags together', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', tags: ['Analytics'] }),
      createGuest({ id: 'c', tags: ['Cybersecurity'] }),
      createGuest({ id: 'd', tags: ['Analytics'] }),
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    const ids = result.map(g => g.id);

    // 'a' is anchor for Cybersecurity, 'c' should follow it
    // 'b' is anchor for Analytics, 'd' should follow it
    expect(ids).toEqual(['a', 'c', 'b', 'd']);
  });

  it('handles mixed tagged and untagged guests', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', tags: [] }),
      createGuest({ id: 'c', tags: ['Cybersecurity'] }),
      createGuest({ id: 'd', tags: [] }),
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    const ids = result.map(g => g.id);

    // 'a' and 'c' grouped together, 'b' and 'd' stay in place
    expect(ids).toEqual(['a', 'c', 'b', 'd']);
  });

  it('preserves original sort order within each tag group', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', ranking: 3, tags: ['Analytics'] }),
      createGuest({ id: 'c', ranking: 5, tags: ['Cybersecurity'] }),
      createGuest({ id: 'd', ranking: 2, tags: ['Cybersecurity'] }),
      createGuest({ id: 'e', ranking: 4, tags: ['Analytics'] }),
    ];

    const result = reorderForTagSimilarity(guests, rankingComparator);
    const ids = result.map(g => g.id);

    // 'a' is anchor for Cybersecurity (earliest position), then 'c' and 'd' follow in original order
    // 'b' is anchor for Analytics, then 'e' follows
    expect(ids).toEqual(['a', 'c', 'd', 'b', 'e']);
  });

  it('handles single-member tag groups without reordering', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', tags: ['Analytics'] }),
      createGuest({ id: 'c', tags: ['Bahasa'] }),
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    expect(result.map(g => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles multiple tag groups correctly', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity', 'Bahasa'] }),
      createGuest({ id: 'b', tags: ['Analytics'] }),
      createGuest({ id: 'c', tags: ['Cybersecurity', 'Bahasa'] }),
      createGuest({ id: 'd', tags: ['Analytics'] }),
      createGuest({ id: 'e', tags: ['Cybersecurity'] }), // Different from a & c (has only Cybersecurity)
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    const ids = result.map(g => g.id);

    // 'a' and 'c' share identical tags ['Cybersecurity', 'Bahasa'] -> grouped
    // 'b' and 'd' share ['Analytics'] -> grouped
    // 'e' has unique tag set ['Cybersecurity'] -> stays in place
    expect(ids).toEqual(['a', 'c', 'b', 'd', 'e']);
  });

  it('does not modify the original array', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', tags: ['Analytics'] }),
      createGuest({ id: 'c', tags: ['Cybersecurity'] }),
    ];
    const originalIds = guests.map(g => g.id);

    reorderForTagSimilarity(guests, noopComparator);

    expect(guests.map(g => g.id)).toEqual(originalIds);
  });

  it('handles a single guest', () => {
    const guests = [createGuest({ id: 'a', tags: ['Cybersecurity'] })];
    const result = reorderForTagSimilarity(guests, noopComparator);
    expect(result.map(g => g.id)).toEqual(['a']);
  });

  it('groups three or more guests with same tags', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Bahasa'] }),
      createGuest({ id: 'b', tags: ['English'] }),
      createGuest({ id: 'c', tags: ['Bahasa'] }),
      createGuest({ id: 'd', tags: ['English'] }),
      createGuest({ id: 'e', tags: ['Bahasa'] }),
      createGuest({ id: 'f', tags: ['English'] }),
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    const ids = result.map(g => g.id);

    expect(ids).toEqual(['a', 'c', 'e', 'b', 'd', 'f']);
  });

  it('treats tag order as irrelevant (same tags in different order produce same group)', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Bahasa', 'Cybersecurity'] }),
      createGuest({ id: 'b', tags: ['Other'] }),
      createGuest({ id: 'c', tags: ['Cybersecurity', 'Bahasa'] }), // Same tags, different order
    ];

    const result = reorderForTagSimilarity(guests, noopComparator);
    const ids = result.map(g => g.id);

    // 'a' and 'c' should be grouped (same tag signature after sorting)
    expect(ids).toEqual(['a', 'c', 'b']);
  });
});
