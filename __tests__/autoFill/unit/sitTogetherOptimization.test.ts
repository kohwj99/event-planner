import { describe, it, expect, beforeEach } from 'vitest';
import { applySitTogetherOptimization } from '@/utils/autoFill/sitTogetherOptimization';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import { createProximityRules, createSitTogetherRule, createSortRule } from '../factories/rulesFactory';
import { expectGuestsAdjacent } from '../helpers/assertions';

beforeEach(() => {
  resetGuestCounter();
  resetTableCounter();
});

const comparator = makeComparator([createSortRule()]);

describe('applySitTogetherOptimization', () => {
  it('no-ops when sitTogether rules are empty', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[2].id, 'g2');

    const rules = createProximityRules();
    const allGuests = [
      createHostGuest({ id: 'g1' }),
      createHostGuest({ id: 'g2' }),
    ];

    const before = new Map(seatToGuest);
    applySitTogetherOptimization(seatToGuest, [table], rules, allGuests, comparator, new Map());
    expect(seatToGuest).toEqual(before);
  });

  describe('Phase 1: Cross-table consolidation', () => {
    it('moves guest to same table as partner when on different tables', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({ seatCount: 4 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, name: 'Bob' });
      const g3 = createHostGuest({ id: 'g3', ranking: 5, name: 'Charlie' });
      const allGuests = [g1, g2, g3];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(t1.seats[0].id, 'g1');
      seatToGuest.set(t1.seats[1].id, 'g3');
      seatToGuest.set(t2.seats[0].id, 'g2');

      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      applySitTogetherOptimization(seatToGuest, [t1, t2], rules, allGuests, comparator, new Map());

      // After optimization, both g1 and g2 should be on the same table
      let g1Table: string | null = null;
      let g2Table: string | null = null;
      for (const table of [t1, t2]) {
        for (const seat of table.seats) {
          if (seatToGuest.get(seat.id) === 'g1') g1Table = table.id;
          if (seatToGuest.get(seat.id) === 'g2') g2Table = table.id;
        }
      }
      expect(g1Table).toBe(g2Table);
    });

    it('targets table with locked cluster member', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { locked: true, assignedGuestId: 'g1' } },
      });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, name: 'Bob' });
      const allGuests = [g1, g2];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(t1.seats[0].id, 'g2');

      const lockedMap = new Map([['g1', {
        guestId: 'g1', tableId: t2.id, seatId: t2.seats[0].id,
        seat: t2.seats[0], table: t2,
      }]]);

      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      applySitTogetherOptimization(seatToGuest, [t1, t2], rules, allGuests, comparator, lockedMap);

      // g2 should move to t2 (where g1 is locked)
      let g2OnT2 = false;
      for (const seat of t2.seats) {
        if (seatToGuest.get(seat.id) === 'g2') g2OnT2 = true;
      }
      expect(g2OnT2).toBe(true);
    });

    it('does not move locked guests', () => {
      const t1 = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { locked: true, assignedGuestId: 'g1' } },
      });
      const t2 = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { locked: true, assignedGuestId: 'g2' } },
      });

      const g1 = createHostGuest({ id: 'g1', ranking: 1 });
      const g2 = createHostGuest({ id: 'g2', ranking: 2 });
      const allGuests = [g1, g2];

      const seatToGuest = new Map<string, string>();

      const lockedMap = new Map([
        ['g1', { guestId: 'g1', tableId: t1.id, seatId: t1.seats[0].id, seat: t1.seats[0], table: t1 }],
        ['g2', { guestId: 'g2', tableId: t2.id, seatId: t2.seats[0].id, seat: t2.seats[0], table: t2 }],
      ]);

      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      applySitTogetherOptimization(seatToGuest, [t1, t2], rules, allGuests, comparator, lockedMap);

      // Neither should have moved (both locked on different tables)
      // The seatToGuest map should not contain either locked guest
      expect(seatToGuest.has(t1.seats[0].id)).toBe(false);
      expect(seatToGuest.has(t2.seats[0].id)).toBe(false);
    });
  });

  describe('Phase 2: Within-table adjacency', () => {
    it('swaps guests to make cluster members adjacent', () => {
      const table = createRoundTable({ seatCount: 6 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, name: 'Bob' });
      const filler = createHostGuest({ id: 'f1', ranking: 5, name: 'Filler' });
      const allGuests = [g1, g2, filler];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'f1');
      seatToGuest.set(table.seats[3].id, 'g2'); // not adjacent to g1

      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      applySitTogetherOptimization(seatToGuest, [table], rules, allGuests, comparator, new Map());

      // g1 and g2 should now be adjacent
      expectGuestsAdjacent('g1', 'g2', [table], seatToGuest);
    });

    it('does not swap if already adjacent', () => {
      const table = createRoundTable({ seatCount: 4 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1 });
      const g2 = createHostGuest({ id: 'g2', ranking: 2 });
      const allGuests = [g1, g2];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'g2'); // already adjacent

      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      const before = new Map(seatToGuest);
      applySitTogetherOptimization(seatToGuest, [table], rules, allGuests, comparator, new Map());

      // Should not change anything since they're already adjacent
      expect(seatToGuest).toEqual(before);
    });
  });

  describe('Phase 3: Second-pass direct swaps', () => {
    it('moves lower priority guest to sit next to higher priority', () => {
      const table = createRoundTable({ seatCount: 6 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'VIP' });
      const g2 = createHostGuest({ id: 'g2', ranking: 5, name: 'Regular' });
      const f1 = createHostGuest({ id: 'f1', ranking: 10, name: 'Filler1' });
      const f2 = createHostGuest({ id: 'f2', ranking: 10, name: 'Filler2' });
      const allGuests = [g1, g2, f1, f2];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'f1');
      seatToGuest.set(table.seats[2].id, 'f2');
      seatToGuest.set(table.seats[3].id, 'g2'); // not adjacent to g1

      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      applySitTogetherOptimization(seatToGuest, [table], rules, allGuests, comparator, new Map());

      expectGuestsAdjacent('g1', 'g2', [table], seatToGuest);
    });
  });

  describe('cluster scenarios', () => {
    it('consolidates a 3-guest cluster onto one table', () => {
      const t1 = createRoundTable({ seatCount: 6 });
      const t2 = createRoundTable({ seatCount: 6 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'A' });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, name: 'B' });
      const g3 = createHostGuest({ id: 'g3', ranking: 3, name: 'C' });
      const f1 = createHostGuest({ id: 'f1', ranking: 10, name: 'F1' });
      const f2 = createHostGuest({ id: 'f2', ranking: 10, name: 'F2' });
      const allGuests = [g1, g2, g3, f1, f2];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(t1.seats[0].id, 'g1');
      seatToGuest.set(t1.seats[1].id, 'f1');
      seatToGuest.set(t2.seats[0].id, 'g2');
      seatToGuest.set(t2.seats[1].id, 'g3');
      seatToGuest.set(t2.seats[2].id, 'f2');

      const rules = createProximityRules({
        sitTogether: [
          createSitTogetherRule('g1', 'g2'),
          createSitTogetherRule('g2', 'g3'),
        ],
      });

      applySitTogetherOptimization(seatToGuest, [t1, t2], rules, allGuests, comparator, new Map());

      // All three should be on the same table
      let g1Table: string | null = null;
      let g2Table: string | null = null;
      let g3Table: string | null = null;
      for (const table of [t1, t2]) {
        for (const seat of table.seats) {
          const guestId = seatToGuest.get(seat.id);
          if (guestId === 'g1') g1Table = table.id;
          if (guestId === 'g2') g2Table = table.id;
          if (guestId === 'g3') g3Table = table.id;
        }
      }
      expect(g1Table).toBe(g2Table);
      expect(g2Table).toBe(g3Table);
    });
  });
});
