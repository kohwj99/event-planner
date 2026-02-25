import { describe, it, expect, beforeEach } from 'vitest';
import { reorderForTagSimilarity, reorderForTagGroups, buildTagSignature } from '@/utils/autoFill/tagReordering';
import { createGuest, resetGuestCounter } from '../factories/guestFactory';
import { createTagSitTogetherGroup, resetRuleIdCounter } from '../factories/rulesFactory';

// Simple no-op comparator (preserves original order on tie)
const noopComparator = (_a: any, _b: any) => 0;

// Ranking-based comparator (ascending)
const rankingComparator = (a: any, b: any) => a.ranking - b.ranking;

beforeEach(() => {
  resetGuestCounter();
  resetRuleIdCounter();
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

describe('reorderForTagGroups', () => {
  it('returns empty array for empty input', () => {
    const group = createTagSitTogetherGroup('Cyber', ['a', 'b']);
    const result = reorderForTagGroups([], [group], noopComparator);
    expect(result).toEqual([]);
  });

  it('returns unchanged array when tagGroups is empty', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', tags: ['Analytics'] }),
      createGuest({ id: 'c', tags: ['Cybersecurity'] }),
    ];

    const result = reorderForTagGroups(guests, [], noopComparator);
    expect(result.map(g => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('pulls up tag group members after their anchor', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', ranking: 2, tags: ['Analytics'] }),
      createGuest({ id: 'c', ranking: 3, tags: ['Other'] }),
      createGuest({ id: 'd', ranking: 4, tags: ['Cybersecurity'] }),
    ];

    const group = createTagSitTogetherGroup('Cybersecurity', ['a', 'd']);
    const result = reorderForTagGroups(guests, [group], rankingComparator);
    const ids = result.map(g => g.id);

    // 'a' is anchor (earliest position), 'd' should be pulled up right after 'a'
    expect(ids).toEqual(['a', 'd', 'b', 'c']);
  });

  it('uses earliest-position member as anchor (highest priority)', () => {
    const guests = [
      createGuest({ id: 'x', ranking: 1, tags: [] }),
      createGuest({ id: 'b', ranking: 2, tags: ['Cyber'] }),
      createGuest({ id: 'y', ranking: 3, tags: [] }),
      createGuest({ id: 'a', ranking: 4, tags: ['Cyber'] }),
    ];

    // 'b' is at position 1, 'a' is at position 3 -> 'b' is anchor
    const group = createTagSitTogetherGroup('Cyber', ['a', 'b']);
    const result = reorderForTagGroups(guests, [group], rankingComparator);
    const ids = result.map(g => g.id);

    // 'b' stays at position 1, 'a' pulled up right after
    expect(ids).toEqual(['x', 'b', 'a', 'y']);
  });

  it('handles multiple independent tag groups', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', ranking: 2, tags: ['Analytics'] }),
      createGuest({ id: 'c', ranking: 3, tags: [] }),
      createGuest({ id: 'd', ranking: 4, tags: ['Cybersecurity'] }),
      createGuest({ id: 'e', ranking: 5, tags: ['Analytics'] }),
    ];

    const group1 = createTagSitTogetherGroup('Cybersecurity', ['a', 'd']);
    const group2 = createTagSitTogetherGroup('Analytics', ['b', 'e']);
    const result = reorderForTagGroups(guests, [group1, group2], rankingComparator);
    const ids = result.map(g => g.id);

    // 'a' is anchor for Cyber, 'd' pulled up after 'a'
    // 'b' is anchor for Analytics, 'e' pulled up after 'b'
    expect(ids).toEqual(['a', 'd', 'b', 'e', 'c']);
  });

  it('handles guest in multiple tag groups (only pulled once)', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cybersecurity', 'Analytics'] }),
      createGuest({ id: 'b', ranking: 2, tags: ['Cybersecurity'] }),
      createGuest({ id: 'c', ranking: 3, tags: ['Analytics'] }),
      createGuest({ id: 'd', ranking: 4, tags: ['Cybersecurity'] }),
    ];

    // 'c' is in both groups; should only be pulled up once (by first group processed)
    const group1 = createTagSitTogetherGroup('Cybersecurity', ['a', 'b', 'd']);
    const group2 = createTagSitTogetherGroup('Analytics', ['a', 'c']);
    const result = reorderForTagGroups(guests, [group1, group2], rankingComparator);
    const ids = result.map(g => g.id);

    // Group 1: 'a' is anchor, 'b' and 'd' pulled up after 'a'
    // Group 2: 'a' is anchor, 'c' pulled up after 'a' (appended to existing members)
    expect(ids).toEqual(['a', 'b', 'd', 'c']);
  });

  it('filters out group members not in candidates', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', ranking: 2, tags: ['Other'] }),
      createGuest({ id: 'c', ranking: 3, tags: ['Cybersecurity'] }),
    ];

    // 'missing' is not in the candidates list
    const group = createTagSitTogetherGroup('Cybersecurity', ['a', 'missing', 'c']);
    const result = reorderForTagGroups(guests, [group], rankingComparator);
    const ids = result.map(g => g.id);

    // 'a' is anchor, 'c' pulled up after 'a'; 'missing' is ignored
    expect(ids).toEqual(['a', 'c', 'b']);
  });

  it('skips groups with fewer than 2 members in candidates', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', ranking: 2, tags: ['Other'] }),
      createGuest({ id: 'c', ranking: 3, tags: ['Other'] }),
    ];

    // Only 'a' from the group is in candidates - group should be skipped
    const group = createTagSitTogetherGroup('Cybersecurity', ['a', 'missing']);
    const result = reorderForTagGroups(guests, [group], rankingComparator);
    const ids = result.map(g => g.id);

    // No reordering should happen
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('does not modify the original array', () => {
    const guests = [
      createGuest({ id: 'a', tags: ['Cybersecurity'] }),
      createGuest({ id: 'b', tags: ['Analytics'] }),
      createGuest({ id: 'c', tags: ['Cybersecurity'] }),
    ];
    const originalIds = guests.map(g => g.id);

    const group = createTagSitTogetherGroup('Cybersecurity', ['a', 'c']);
    reorderForTagGroups(guests, [group], noopComparator);

    expect(guests.map(g => g.id)).toEqual(originalIds);
  });

  it('preserves non-group guest positions', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1 }),
      createGuest({ id: 'b', ranking: 2, tags: ['Cyber'] }),
      createGuest({ id: 'c', ranking: 3 }),
      createGuest({ id: 'd', ranking: 4 }),
      createGuest({ id: 'e', ranking: 5, tags: ['Cyber'] }),
      createGuest({ id: 'f', ranking: 6 }),
    ];

    const group = createTagSitTogetherGroup('Cyber', ['b', 'e']);
    const result = reorderForTagGroups(guests, [group], rankingComparator);
    const ids = result.map(g => g.id);

    // 'b' is anchor, 'e' pulled up after 'b'
    // Non-group guests 'a', 'c', 'd', 'f' maintain relative order
    expect(ids).toEqual(['a', 'b', 'e', 'c', 'd', 'f']);
  });

  it('groups 3+ members correctly after anchor', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cyber'] }),
      createGuest({ id: 'b', ranking: 2, tags: [] }),
      createGuest({ id: 'c', ranking: 3, tags: ['Cyber'] }),
      createGuest({ id: 'd', ranking: 4, tags: [] }),
      createGuest({ id: 'e', ranking: 5, tags: ['Cyber'] }),
      createGuest({ id: 'f', ranking: 6, tags: ['Cyber'] }),
    ];

    const group = createTagSitTogetherGroup('Cyber', ['a', 'c', 'e', 'f']);
    const result = reorderForTagGroups(guests, [group], rankingComparator);
    const ids = result.map(g => g.id);

    // 'a' is anchor, then 'c', 'e', 'f' follow sorted by comparator
    expect(ids).toEqual(['a', 'c', 'e', 'f', 'b', 'd']);
  });

  it('skips group when anchor was already pulled up by a prior group', () => {
    const guests = [
      createGuest({ id: 'a', ranking: 1, tags: ['Cyber'] }),
      createGuest({ id: 'b', ranking: 2, tags: ['Cyber'] }),
      createGuest({ id: 'c', ranking: 3, tags: ['Analytics'] }),
      createGuest({ id: 'd', ranking: 4, tags: ['Analytics'] }),
    ];

    // Group 1 pulls up 'b' after 'a'
    // Group 2 has 'b' as member (position 2 after pull-up) and 'c' as potential anchor
    // But 'b' was already pulled up, so in group 2 'c' should be anchor and 'd' pulled up
    const group1 = createTagSitTogetherGroup('Cyber', ['a', 'b']);
    const group2 = createTagSitTogetherGroup('Analytics', ['c', 'd']);
    const result = reorderForTagGroups(guests, [group1, group2], rankingComparator);
    const ids = result.map(g => g.id);

    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles single guest in candidates', () => {
    const guests = [createGuest({ id: 'a', tags: ['Cybersecurity'] })];
    const group = createTagSitTogetherGroup('Cyber', ['a', 'b']);
    const result = reorderForTagGroups(guests, [group], noopComparator);
    expect(result.map(g => g.id)).toEqual(['a']);
  });
});
