import { describe, it, expect, beforeEach } from 'vitest';
import { reorderForSitTogetherClusters } from '@/utils/autoFill/proximityReordering';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createSortRule, createSitTogetherRule } from '../factories/rulesFactory';

const comparator = makeComparator([createSortRule({ field: 'ranking', direction: 'asc' })]);

beforeEach(() => {
  resetGuestCounter();
});

describe('reorderForSitTogetherClusters', () => {
  it('returns unchanged array when no sit-together rules', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 2 }),
      createHostGuest({ id: 'c', ranking: 3 }),
    ];
    const result = reorderForSitTogetherClusters(guests, [], comparator);
    expect(result.map((g: { id: string }) => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns unchanged array when candidates are empty', () => {
    const rules = [createSitTogetherRule('a', 'b')];
    const result = reorderForSitTogetherClusters([], rules, comparator);
    expect(result).toEqual([]);
  });

  it('pulls low-priority partner up after high-priority anchor', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 2 }),
      createHostGuest({ id: 'c', ranking: 3 }),
      createHostGuest({ id: 'd', ranking: 4 }),
      createHostGuest({ id: 'e', ranking: 5 }),
    ];
    const rules = [createSitTogetherRule('a', 'e')];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // 'e' should be pulled up to right after 'a'
    expect(ids).toEqual(['a', 'e', 'b', 'c', 'd']);
  });

  it('handles transitive cluster (A-B, B-C)', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 3 }),
      createHostGuest({ id: 'c', ranking: 5 }),
      createHostGuest({ id: 'd', ranking: 2 }),
      createHostGuest({ id: 'e', ranking: 4 }),
    ].sort((x, y) => comparator(x, y));

    // Sorted order: a(1), d(2), b(3), e(4), c(5)
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('b', 'c'),
    ];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // Anchor is 'a' (rank 1, earliest position)
    // 'b' (rank 3) and 'c' (rank 5) pulled up after 'a', sorted by comparator
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('preserves non-cluster guest positions', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 2 }),
      createHostGuest({ id: 'c', ranking: 3 }),
      createHostGuest({ id: 'd', ranking: 4 }),
    ];
    // Only a-d are linked; b and c are not in any rule
    const rules = [createSitTogetherRule('a', 'd')];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // 'd' pulled up after 'a'; 'b' and 'c' maintain relative order
    expect(ids).toEqual(['a', 'd', 'b', 'c']);
  });

  it('handles multiple independent clusters', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 2 }),
      createHostGuest({ id: 'c', ranking: 3 }),
      createHostGuest({ id: 'd', ranking: 4 }),
      createHostGuest({ id: 'e', ranking: 5 }),
      createHostGuest({ id: 'f', ranking: 6 }),
    ];
    const rules = [
      createSitTogetherRule('a', 'd'), // cluster 1: a(1), d(4)
      createSitTogetherRule('b', 'f'), // cluster 2: b(2), f(6)
    ];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // d pulled after a, f pulled after b; c and e stay in relative order
    expect(ids).toEqual(['a', 'd', 'b', 'f', 'c', 'e']);
  });

  it('handles single-member cluster when partner is not in candidates', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 2 }),
      createHostGuest({ id: 'c', ranking: 3 }),
    ];
    // 'x' is not in the candidates array (e.g., locked guest)
    const rules = [createSitTogetherRule('a', 'x')];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // No reordering since only 1 cluster member is in candidates
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('handles cross-pool pair (host + external)', () => {
    const guests = [
      createHostGuest({ id: 'h1', ranking: 1 }),
      createHostGuest({ id: 'h2', ranking: 2 }),
      createExternalGuest({ id: 'e1', ranking: 3 }),
      createExternalGuest({ id: 'e2', ranking: 4 }),
    ];
    const rules = [createSitTogetherRule('h1', 'e2')];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // e2 (external, rank 4) pulled up after h1 (host, rank 1)
    expect(ids).toEqual(['h1', 'e2', 'h2', 'e1']);
  });

  it('handles cluster where anchor is not at position 0', () => {
    const guests = [
      createHostGuest({ id: 'x', ranking: 1 }),  // not in any rule
      createHostGuest({ id: 'y', ranking: 2 }),  // not in any rule
      createHostGuest({ id: 'a', ranking: 3 }),  // anchor of cluster
      createHostGuest({ id: 'z', ranking: 4 }),  // not in any rule
      createHostGuest({ id: 'b', ranking: 5 }),  // cluster member
    ];
    const rules = [createSitTogetherRule('a', 'b')];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // x and y stay before anchor; b pulled up after a; z maintains relative position
    expect(ids).toEqual(['x', 'y', 'a', 'b', 'z']);
  });

  it('handles cluster members with same ranking', () => {
    const guests = [
      createHostGuest({ id: 'a', name: 'Alice', ranking: 1 }),
      createHostGuest({ id: 'b', name: 'Bob', ranking: 1 }),
      createHostGuest({ id: 'c', name: 'Charlie', ranking: 2 }),
    ];
    const rules = [createSitTogetherRule('a', 'c')];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // 'a' is anchor (earlier position), 'c' pulled up after 'a'
    expect(ids).toEqual(['a', 'c', 'b']);
  });

  it('handles long transitive chain (A-B, B-C, C-D, D-E)', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'x', ranking: 2 }),
      createHostGuest({ id: 'b', ranking: 3 }),
      createHostGuest({ id: 'y', ranking: 4 }),
      createHostGuest({ id: 'c', ranking: 5 }),
      createHostGuest({ id: 'z', ranking: 6 }),
      createHostGuest({ id: 'd', ranking: 7 }),
      createHostGuest({ id: 'e', ranking: 8 }),
    ];
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('b', 'c'),
      createSitTogetherRule('c', 'd'),
      createSitTogetherRule('d', 'e'),
    ];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // All chain members (a,b,c,d,e) grouped after anchor 'a', sorted by comparator
    // Non-cluster guests (x,y,z) maintain relative order after the cluster
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'x', 'y', 'z']);
  });

  it('does not reorder when both cluster members are already adjacent', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 2 }),
      createHostGuest({ id: 'c', ranking: 3 }),
    ];
    const rules = [createSitTogetherRule('a', 'b')];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);
    const ids = result.map((g: { id: string }) => g.id);

    // Already adjacent, order should be same
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('preserves all elements (no duplicates, no removals)', () => {
    const guests = [
      createHostGuest({ id: 'a', ranking: 1 }),
      createHostGuest({ id: 'b', ranking: 2 }),
      createHostGuest({ id: 'c', ranking: 3 }),
      createExternalGuest({ id: 'd', ranking: 4 }),
      createExternalGuest({ id: 'e', ranking: 5 }),
    ];
    const rules = [
      createSitTogetherRule('a', 'e'),
      createSitTogetherRule('b', 'd'),
    ];

    const result = reorderForSitTogetherClusters(guests, rules, comparator);

    expect(result).toHaveLength(guests.length);
    const resultIds = result.map((g: { id: string }) => g.id).sort();
    const inputIds = guests.map(g => g.id).sort();
    expect(resultIds).toEqual(inputIds);
  });
});
