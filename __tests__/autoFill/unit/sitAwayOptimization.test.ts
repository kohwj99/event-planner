import { describe, it, expect, beforeEach } from 'vitest';
import { applySitAwayOptimization } from '@/utils/autoFill/sitAwayOptimization';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { createHostGuest, resetGuestCounter } from '../factories/guestFactory';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import { createProximityRules, createSitAwayRule, createSitTogetherRule, createSortRule } from '../factories/rulesFactory';
import { expectGuestsNotAdjacent } from '../helpers/assertions';

beforeEach(() => {
  resetGuestCounter();
  resetTableCounter();
});

const comparator = makeComparator([createSortRule()]);

describe('applySitAwayOptimization', () => {
  it('no-ops when sitAway rules are empty', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[1].id, 'g2');

    const rules = createProximityRules();
    const allGuests = [
      createHostGuest({ id: 'g1' }),
      createHostGuest({ id: 'g2' }),
    ];

    const before = new Map(seatToGuest);
    applySitAwayOptimization(seatToGuest, [table], rules, allGuests, comparator, new Map());
    expect(seatToGuest).toEqual(before);
  });

  it('no-ops when sit-away pair is on different tables', () => {
    const t1 = createRoundTable({ seatCount: 4 });
    const t2 = createRoundTable({ seatCount: 4 });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(t1.seats[0].id, 'g1');
    seatToGuest.set(t2.seats[0].id, 'g2');

    const g1 = createHostGuest({ id: 'g1', ranking: 1 });
    const g2 = createHostGuest({ id: 'g2', ranking: 2 });
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
    });

    const before = new Map(seatToGuest);
    applySitAwayOptimization(seatToGuest, [t1, t2], rules, [g1, g2], comparator, new Map());
    expect(seatToGuest).toEqual(before);
  });

  it('no-ops when sit-away pair is on same table but not adjacent', () => {
    const table = createRoundTable({ seatCount: 6 });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[3].id, 'g2'); // not adjacent on 6-seat table

    const g1 = createHostGuest({ id: 'g1', ranking: 1 });
    const g2 = createHostGuest({ id: 'g2', ranking: 2 });
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
    });

    const before = new Map(seatToGuest);
    applySitAwayOptimization(seatToGuest, [table], rules, [g1, g2], comparator, new Map());
    expect(seatToGuest).toEqual(before);
  });

  it('separates adjacent sit-away pair by moving to empty seat', () => {
    const table = createRoundTable({ seatCount: 6 });

    const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'VIP' });
    const g2 = createHostGuest({ id: 'g2', ranking: 5, name: 'Regular' });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[1].id, 'g2'); // adjacent to g1

    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
    });

    applySitAwayOptimization(seatToGuest, [table], rules, [g1, g2], comparator, new Map());

    expectGuestsNotAdjacent('g1', 'g2', [table], seatToGuest);
  });

  it('separates adjacent sit-away pair by swapping with non-adjacent guest', () => {
    const table = createRoundTable({ seatCount: 6 });

    const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'VIP' });
    const g2 = createHostGuest({ id: 'g2', ranking: 5, name: 'Avoid' });
    const f1 = createHostGuest({ id: 'f1', ranking: 10, name: 'Filler1' });
    const f2 = createHostGuest({ id: 'f2', ranking: 10, name: 'Filler2' });
    const f3 = createHostGuest({ id: 'f3', ranking: 10, name: 'Filler3' });
    const f4 = createHostGuest({ id: 'f4', ranking: 10, name: 'Filler4' });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[1].id, 'g2'); // adjacent
    seatToGuest.set(table.seats[2].id, 'f1');
    seatToGuest.set(table.seats[3].id, 'f2');
    seatToGuest.set(table.seats[4].id, 'f3');
    seatToGuest.set(table.seats[5].id, 'f4');

    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
    });

    applySitAwayOptimization(seatToGuest, [table], rules, [g1, g2, f1, f2, f3, f4], comparator, new Map());

    expectGuestsNotAdjacent('g1', 'g2', [table], seatToGuest);
  });

  it('moves lower-priority non-locked guest', () => {
    const table = createRoundTable({ seatCount: 6 });

    const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'VIP' });
    const g2 = createHostGuest({ id: 'g2', ranking: 5, name: 'Regular' });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[1].id, 'g2');

    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
    });

    applySitAwayOptimization(seatToGuest, [table], rules, [g1, g2], comparator, new Map());

    // g1 (higher priority) should stay in seat 0
    expect(seatToGuest.get(table.seats[0].id)).toBe('g1');
    // g2 should have moved away
    expectGuestsNotAdjacent('g1', 'g2', [table], seatToGuest);
  });

  it('skips pair when both are locked', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: {
        0: { locked: true, assignedGuestId: 'g1' },
        1: { locked: true, assignedGuestId: 'g2' },
      },
    });

    const g1 = createHostGuest({ id: 'g1', ranking: 1 });
    const g2 = createHostGuest({ id: 'g2', ranking: 2 });

    const seatToGuest = new Map<string, string>();

    const lockedMap = new Map([
      ['g1', { guestId: 'g1', tableId: table.id, seatId: table.seats[0].id, seat: table.seats[0], table }],
      ['g2', { guestId: 'g2', tableId: table.id, seatId: table.seats[1].id, seat: table.seats[1], table }],
    ]);

    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
    });

    // Should not crash and should leave map unchanged
    applySitAwayOptimization(seatToGuest, [table], rules, [g1, g2], comparator, lockedMap);
    expect(seatToGuest.size).toBe(0); // no moves made
  });

  it('rolls back swap if it does not reduce total violations', () => {
    // Set up a scenario where any swap would not help
    const table = createRoundTable({ seatCount: 4 });

    const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'A' });
    const g2 = createHostGuest({ id: 'g2', ranking: 2, name: 'B' });
    const g3 = createHostGuest({ id: 'g3', ranking: 3, name: 'C' });
    const g4 = createHostGuest({ id: 'g4', ranking: 4, name: 'D' });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[1].id, 'g2');
    seatToGuest.set(table.seats[2].id, 'g3');
    seatToGuest.set(table.seats[3].id, 'g4');

    // g1 should sit away from g2, but also g3 and g4 should sit together
    // Moving g2 anywhere might break sit-together
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
      sitTogether: [
        createSitTogetherRule('g2', 'g3'),
        createSitTogetherRule('g3', 'g4'),
        createSitTogetherRule('g4', 'g1'),
      ],
    });

    applySitAwayOptimization(seatToGuest, [table], rules, [g1, g2, g3, g4], comparator, new Map());

    // All guests should still be assigned (no guests lost)
    expect(seatToGuest.size).toBe(4);
  });

  it('prefers same-table seats over cross-table seats', () => {
    const t1 = createRoundTable({ seatCount: 6 });
    const t2 = createRoundTable({ seatCount: 6 });

    const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'VIP' });
    const g2 = createHostGuest({ id: 'g2', ranking: 5, name: 'Avoid' });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(t1.seats[0].id, 'g1');
    seatToGuest.set(t1.seats[1].id, 'g2');

    const rules = createProximityRules({
      sitAway: [createSitAwayRule('g1', 'g2')],
    });

    applySitAwayOptimization(seatToGuest, [t1, t2], rules, [g1, g2], comparator, new Map());

    // g2 should have moved, preferably within t1
    expectGuestsNotAdjacent('g1', 'g2', [t1, t2], seatToGuest);
  });
});
