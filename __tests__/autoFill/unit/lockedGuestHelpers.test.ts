import { describe, it, expect, beforeEach } from 'vitest';
import { buildLockedGuestMap, wouldViolateSitAwayWithLocked } from '@/utils/autoFill/lockedGuestHelpers';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import { createProximityRules, createSitAwayRule } from '../factories/rulesFactory';

beforeEach(() => {
  resetTableCounter();
});

describe('buildLockedGuestMap', () => {
  it('builds map from tables with locked seats', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: {
        0: { locked: true, assignedGuestId: 'g1' },
        2: { locked: true, assignedGuestId: 'g2' },
      },
    });

    const map = buildLockedGuestMap([table]);
    expect(map.size).toBe(2);
    expect(map.has('g1')).toBe(true);
    expect(map.has('g2')).toBe(true);
    expect(map.get('g1')!.tableId).toBe(table.id);
    expect(map.get('g1')!.seatId).toBe(table.seats[0].id);
  });

  it('ignores locked seats without assignedGuestId', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 0: { locked: true } },
    });

    const map = buildLockedGuestMap([table]);
    expect(map.size).toBe(0);
  });

  it('ignores unlocked seats', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 0: { locked: false, assignedGuestId: 'g1' } },
    });

    const map = buildLockedGuestMap([table]);
    expect(map.size).toBe(0);
  });

  it('handles tables with no seats', () => {
    const table = { id: 't1', seats: [], label: 'Empty', shape: 'round' as const, x: 0, y: 0, radius: 100 };
    const map = buildLockedGuestMap([table]);
    expect(map.size).toBe(0);
  });

  it('handles multiple locked guests across multiple tables', () => {
    const t1 = createRoundTable({
      seatCount: 4,
      seatOverrides: { 0: { locked: true, assignedGuestId: 'g1' } },
    });
    const t2 = createRoundTable({
      seatCount: 4,
      seatOverrides: { 1: { locked: true, assignedGuestId: 'g2' } },
    });

    const map = buildLockedGuestMap([t1, t2]);
    expect(map.size).toBe(2);
    expect(map.get('g1')!.tableId).toBe(t1.id);
    expect(map.get('g2')!.tableId).toBe(t2.id);
  });
});

describe('wouldViolateSitAwayWithLocked', () => {
  it('returns false when guest has no sit-away rules', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 1: { locked: true, assignedGuestId: 'locked1' } },
    });
    const rules = createProximityRules();
    const lockedMap = buildLockedGuestMap([table]);

    const result = wouldViolateSitAwayWithLocked(
      'newGuest', table.seats[0], table.seats, lockedMap, rules
    );
    expect(result).toBe(false);
  });

  it('returns true when adjacent locked seat has a sit-away guest', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 1: { locked: true, assignedGuestId: 'locked1' } },
    });
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('newGuest', 'locked1')],
    });
    const lockedMap = buildLockedGuestMap([table]);

    // Seat 0 is adjacent to seat 1 (which has locked1)
    const result = wouldViolateSitAwayWithLocked(
      'newGuest', table.seats[0], table.seats, lockedMap, rules
    );
    expect(result).toBe(true);
  });

  it('returns false when adjacent locked seat has an unrelated guest', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 1: { locked: true, assignedGuestId: 'someoneElse' } },
    });
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('newGuest', 'differentGuest')],
    });
    const lockedMap = buildLockedGuestMap([table]);

    const result = wouldViolateSitAwayWithLocked(
      'newGuest', table.seats[0], table.seats, lockedMap, rules
    );
    expect(result).toBe(false);
  });

  it('returns false when no adjacent seats are locked', () => {
    const table = createRoundTable({ seatCount: 6 });
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('newGuest', 'someGuest')],
    });

    const result = wouldViolateSitAwayWithLocked(
      'newGuest', table.seats[0], table.seats, new Map(), rules
    );
    expect(result).toBe(false);
  });

  it('checks all adjacent seats, not just first', () => {
    // On a 4-seat round table, seat 0 is adjacent to seats 3 and 1
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: {
        // Seat 1 has unrelated guest, seat 3 has the sit-away guest
        1: { locked: true, assignedGuestId: 'unrelated' },
        3: { locked: true, assignedGuestId: 'avoidMe' },
      },
    });
    const rules = createProximityRules({
      sitAway: [createSitAwayRule('newGuest', 'avoidMe')],
    });
    const lockedMap = buildLockedGuestMap([table]);

    const result = wouldViolateSitAwayWithLocked(
      'newGuest', table.seats[0], table.seats, lockedMap, rules
    );
    expect(result).toBe(true);
  });
});
