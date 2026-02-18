import { describe, it, expect, beforeEach } from 'vitest';
import { buildPrioritizedGuestPools } from '@/utils/autoFill/guestPoolBuilder';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createSortRule, createProximityRules, createSitTogetherRule, createSitAwayRule } from '../factories/rulesFactory';

beforeEach(() => {
  resetGuestCounter();
});

describe('buildPrioritizedGuestPools', () => {
  const comparator = makeComparator([createSortRule()]);

  it('places sit-together rule guests first in host pool', () => {
    const h1 = createHostGuest({ id: 'h1', ranking: 5 });
    const h2 = createHostGuest({ id: 'h2', ranking: 1 });
    const h3 = createHostGuest({ id: 'h3', ranking: 3 });
    const ext1 = createExternalGuest({ id: 'e1', ranking: 2 });
    const rules = createProximityRules({
      sitTogether: [createSitTogetherRule('h2', 'e1')],
    });

    const result = buildPrioritizedGuestPools([h1, h2, h3], [ext1], rules, comparator, 10);

    // h2 is in proximity rules, should be first in host pool
    expect(result.prioritizedHost[0].id).toBe('h2');
    // e1 is in proximity rules, should be first in external pool
    expect(result.prioritizedExternal[0].id).toBe('e1');
  });

  it('places sit-away rule guests first in both pools', () => {
    const h1 = createHostGuest({ id: 'h1', ranking: 5 });
    const h2 = createHostGuest({ id: 'h2', ranking: 1 });
    const ext1 = createExternalGuest({ id: 'e1', ranking: 2 });
    const ext2 = createExternalGuest({ id: 'e2', ranking: 4 });
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('h1', 'e2')],
    });

    const result = buildPrioritizedGuestPools([h1, h2], [ext1, ext2], rules, comparator, 10);

    expect(result.prioritizedHost[0].id).toBe('h1');
    expect(result.prioritizedExternal[0].id).toBe('e2');
  });

  it('sorts must-include and regular sub-groups by comparator', () => {
    const h1 = createHostGuest({ id: 'h1', ranking: 10 });
    const h2 = createHostGuest({ id: 'h2', ranking: 2 });
    const h3 = createHostGuest({ id: 'h3', ranking: 5 });
    const ext1 = createExternalGuest({ id: 'e1' });
    const rules = createProximityRules({
      sitTogether: [createSitTogetherRule('h1', 'e1')],
    });

    const result = buildPrioritizedGuestPools([h1, h2, h3], [ext1], rules, comparator, 10);

    // h1 (must-include) first, then h2 (rank 2) before h3 (rank 5)
    expect(result.prioritizedHost.map((g: { id: string }) => g.id)).toEqual(['h1', 'h2', 'h3']);
  });

  it('returns correct guestsInProximityRules set', () => {
    const h1 = createHostGuest({ id: 'h1' });
    const ext1 = createExternalGuest({ id: 'e1' });
    const ext2 = createExternalGuest({ id: 'e2' });
    const rules = createProximityRules({
      sitTogether: [createSitTogetherRule('h1', 'e1')],
      sitAway: [createSitAwayRule('h1', 'e2')],
    });

    const result = buildPrioritizedGuestPools([h1], [ext1, ext2], rules, comparator, 10);

    expect(result.guestsInProximityRules.has('h1')).toBe(true);
    expect(result.guestsInProximityRules.has('e1')).toBe(true);
    expect(result.guestsInProximityRules.has('e2')).toBe(true);
  });

  it('handles guests appearing in multiple rules (deduplicated in set)', () => {
    const h1 = createHostGuest({ id: 'h1' });
    const ext1 = createExternalGuest({ id: 'e1' });
    const ext2 = createExternalGuest({ id: 'e2' });
    const rules = createProximityRules({
      sitTogether: [createSitTogetherRule('h1', 'e1'), createSitTogetherRule('h1', 'e2')],
    });

    const result = buildPrioritizedGuestPools([h1], [ext1, ext2], rules, comparator, 10);

    expect(result.guestsInProximityRules.size).toBe(3);
  });

  it('handles empty proximity rules (all guests are regular)', () => {
    const h1 = createHostGuest({ id: 'h1', ranking: 3 });
    const h2 = createHostGuest({ id: 'h2', ranking: 1 });
    const rules = createProximityRules();

    const result = buildPrioritizedGuestPools([h1, h2], [], rules, comparator, 10);

    expect(result.prioritizedHost.map((g: { id: string }) => g.id)).toEqual(['h2', 'h1']);
    expect(result.guestsInProximityRules.size).toBe(0);
  });

  it('handles empty candidate lists', () => {
    const rules = createProximityRules();
    const result = buildPrioritizedGuestPools([], [], rules, comparator, 10);

    expect(result.prioritizedHost).toHaveLength(0);
    expect(result.prioritizedExternal).toHaveLength(0);
  });

  it('handles all guests being in proximity rules', () => {
    const h1 = createHostGuest({ id: 'h1', ranking: 2 });
    const h2 = createHostGuest({ id: 'h2', ranking: 1 });
    const rules = createProximityRules({
      sitTogether: [createSitTogetherRule('h1', 'h2')],
    });

    const result = buildPrioritizedGuestPools([h1, h2], [], rules, comparator, 10);

    // Both are must-include, sorted by ranking
    expect(result.prioritizedHost.map((g: { id: string }) => g.id)).toEqual(['h2', 'h1']);
  });
});
