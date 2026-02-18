import { describe, it, expect, beforeEach } from 'vitest';
import { buildSitTogetherClusters, getOptimalClusterOrder } from '@/utils/autoFill/clusterBuilder';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { createSitTogetherRule, createSortRule } from '../factories/rulesFactory';
import { createHostGuest, resetGuestCounter } from '../factories/guestFactory';

beforeEach(() => {
  resetGuestCounter();
});

describe('buildSitTogetherClusters', () => {
  it('groups a single pair into one cluster', () => {
    const rules = [createSitTogetherRule('a', 'b')];
    const clusters = buildSitTogetherClusters(rules);
    expect(clusters.size).toBe(1);
    const members = Array.from(clusters.values())[0].sort();
    expect(members).toEqual(['a', 'b']);
  });

  it('groups transitive pairs: A+B, B+C => {A,B,C}', () => {
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('b', 'c'),
    ];
    const clusters = buildSitTogetherClusters(rules);
    expect(clusters.size).toBe(1);
    const members = Array.from(clusters.values())[0].sort();
    expect(members).toEqual(['a', 'b', 'c']);
  });

  it('creates separate clusters for disconnected pairs', () => {
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('c', 'd'),
    ];
    const clusters = buildSitTogetherClusters(rules);
    expect(clusters.size).toBe(2);
  });

  it('handles empty rules (empty map)', () => {
    const clusters = buildSitTogetherClusters([]);
    expect(clusters.size).toBe(0);
  });
});

describe('getOptimalClusterOrder', () => {
  const comparator = makeComparator([createSortRule()]);

  it('sorts a pair by comparator priority', () => {
    const gA = createHostGuest({ id: 'a', ranking: 5 });
    const gB = createHostGuest({ id: 'b', ranking: 1 });
    const lookup = new Map([['a', gA], ['b', gB]]);
    const rules = [createSitTogetherRule('a', 'b')];

    const order = getOptimalClusterOrder(['a', 'b'], rules, lookup, comparator);
    // b has ranking 1 (higher priority), should come first
    expect(order[0]).toBe('b');
  });

  it('places the most-connected guest in the center for 3+ cluster', () => {
    // b is connected to both a and c
    const gA = createHostGuest({ id: 'a', ranking: 3 });
    const gB = createHostGuest({ id: 'b', ranking: 2 });
    const gC = createHostGuest({ id: 'c', ranking: 1 });
    const lookup = new Map([['a', gA], ['b', gB], ['c', gC]]);
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('b', 'c'),
    ];

    const order = getOptimalClusterOrder(['a', 'b', 'c'], rules, lookup, comparator);
    // b has 2 connections, should be in the center (index 1 of 3)
    const centerIndex = Math.floor(order.length / 2);
    expect(order[centerIndex]).toBe('b');
  });

  it('handles equal connection counts by using comparator as tiebreaker', () => {
    // All have 1 connection each in a chain a-b, b-c
    // But b has 2 connections
    const gA = createHostGuest({ id: 'a', ranking: 1 });
    const gB = createHostGuest({ id: 'b', ranking: 2 });
    const gC = createHostGuest({ id: 'c', ranking: 3 });
    const lookup = new Map([['a', gA], ['b', gB], ['c', gC]]);
    const rules = [
      createSitTogetherRule('a', 'b'),
      createSitTogetherRule('b', 'c'),
    ];

    const order = getOptimalClusterOrder(['a', 'b', 'c'], rules, lookup, comparator);
    // b has most connections, should be in center
    expect(order.length).toBe(3);
    expect(order).toContain('a');
    expect(order).toContain('b');
    expect(order).toContain('c');
  });

  it('handles cluster of size 1 (returns as-is)', () => {
    const gA = createHostGuest({ id: 'a' });
    const lookup = new Map([['a', gA]]);
    const order = getOptimalClusterOrder(['a'], [], lookup, comparator);
    expect(order).toEqual(['a']);
  });
});
