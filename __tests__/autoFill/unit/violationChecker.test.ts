import { describe, it, expect, beforeEach } from 'vitest';
import { performFinalViolationCheck } from '@/utils/autoFill/violationChecker';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import { createHostGuest, resetGuestCounter } from '../factories/guestFactory';
import { createProximityRules, createSitTogetherRule, createSitAwayRule } from '../factories/rulesFactory';

beforeEach(() => {
  resetTableCounter();
  resetGuestCounter();
});

function makeGuestLookup(...guests: { id: string; name: string }[]): Record<string, { id: string; name: string }> {
  const lookup: Record<string, { id: string; name: string }> = {};
  for (const g of guests) {
    lookup[g.id] = g;
  }
  return lookup;
}

describe('performFinalViolationCheck', () => {
  describe('sit-together violations', () => {
    it('reports no violation when pair is adjacent on same table', () => {
      const table = createRoundTable({ seatCount: 4 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[1].assignedGuestId = 'g2';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(0);
    });

    it('reports violation when pair is on different tables', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({ seatCount: 4 });
      t1.seats[0].assignedGuestId = 'g1';
      t2.seats[0].assignedGuestId = 'g2';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([t1, t2], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('sit-together');
    });

    it('reports violation when pair is on same table but not adjacent', () => {
      const table = createRoundTable({ seatCount: 6 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[3].assignedGuestId = 'g2'; // 3 seats apart

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('sit-together');
    });

    it('skips rule when either guest is not seated', () => {
      const table = createRoundTable({ seatCount: 4 });
      table.seats[0].assignedGuestId = 'g1';
      // g2 not seated

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(0);
    });

    it('skips rule when guest is not in guestLookup', () => {
      const table = createRoundTable({ seatCount: 4 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[1].assignedGuestId = 'g2';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')],
      });

      // g2 not in lookup
      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1));
      expect(violations).toHaveLength(0);
    });

    it('deduplicates violations for same pair', () => {
      const table = createRoundTable({ seatCount: 6 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[3].assignedGuestId = 'g2';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitTogether: [
          createSitTogetherRule('g1', 'g2'),
          createSitTogetherRule('g1', 'g2'), // duplicate
        ],
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(1);
    });
  });

  describe('sit-away violations', () => {
    it('reports no violation when pair is on different tables', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({ seatCount: 4 });
      t1.seats[0].assignedGuestId = 'g1';
      t2.seats[0].assignedGuestId = 'g2';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitAway: [createSitAwayRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([t1, t2], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(0);
    });

    it('reports no violation when same table but not adjacent', () => {
      const table = createRoundTable({ seatCount: 6 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[3].assignedGuestId = 'g2';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitAway: [createSitAwayRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(0);
    });

    it('reports violation when pair is adjacent on same table', () => {
      const table = createRoundTable({ seatCount: 4 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[1].assignedGuestId = 'g2';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitAway: [createSitAwayRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('sit-away');
    });

    it('skips rule when either guest is not seated', () => {
      const table = createRoundTable({ seatCount: 4 });
      table.seats[0].assignedGuestId = 'g1';

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const rules = createProximityRules({
        sitAway: [createSitAwayRule('g1', 'g2')],
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2));
      expect(violations).toHaveLength(0);
    });
  });

  describe('combined rules', () => {
    it('returns all violations from both rule types', () => {
      const table = createRoundTable({ seatCount: 6 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[1].assignedGuestId = 'g2'; // adjacent to g1
      table.seats[3].assignedGuestId = 'g3'; // not adjacent to g1

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const g3 = createHostGuest({ id: 'g3', name: 'Charlie' });
      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g3')], // g1 and g3 not adjacent -> violation
        sitAway: [createSitAwayRule('g1', 'g2')], // g1 and g2 adjacent -> violation
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2, g3));
      expect(violations).toHaveLength(2);
      expect(violations.map(v => v.type).sort()).toEqual(['sit-away', 'sit-together']);
    });

    it('returns empty array when all rules satisfied', () => {
      const table = createRoundTable({ seatCount: 6 });
      table.seats[0].assignedGuestId = 'g1';
      table.seats[1].assignedGuestId = 'g2'; // adjacent to g1
      table.seats[3].assignedGuestId = 'g3'; // not adjacent to g1

      const g1 = createHostGuest({ id: 'g1', name: 'Alice' });
      const g2 = createHostGuest({ id: 'g2', name: 'Bob' });
      const g3 = createHostGuest({ id: 'g3', name: 'Charlie' });
      const rules = createProximityRules({
        sitTogether: [createSitTogetherRule('g1', 'g2')], // adjacent -> OK
        sitAway: [createSitAwayRule('g1', 'g3')], // not adjacent -> OK
      });

      const violations = performFinalViolationCheck([table], rules, makeGuestLookup(g1, g2, g3));
      expect(violations).toHaveLength(0);
    });
  });
});
