import { describe, it, expect, beforeEach } from 'vitest';
import { applyTagGroupOptimization } from '@/utils/autoFill/tagGroupOptimization';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { LockedGuestLocation } from '@/utils/autoFill/autoFillTypes';
import { createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import { createSortRule, createTagSitTogetherGroup, resetRuleIdCounter } from '../factories/rulesFactory';

beforeEach(() => {
  resetGuestCounter();
  resetTableCounter();
  resetRuleIdCounter();
});

const comparator = makeComparator([createSortRule()]);

/** Helper: find which table a guest ended up on */
function findGuestTable(guestId: string, tables: any[], seatToGuest: Map<string, string>): string | null {
  for (const table of tables) {
    for (const seat of table.seats) {
      if (seatToGuest.get(seat.id) === guestId) return table.id;
      if (seat.locked && seat.assignedGuestId === guestId) return table.id;
    }
  }
  return null;
}

describe('applyTagGroupOptimization', () => {
  it('no-ops when tagGroups is empty', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[2].id, 'g2');

    const allGuests = [
      createHostGuest({ id: 'g1' }),
      createHostGuest({ id: 'g2' }),
    ];

    const before = new Map(seatToGuest);
    applyTagGroupOptimization(seatToGuest, [table], [], allGuests, comparator, new Map());
    expect(seatToGuest).toEqual(before);
  });

  it('no-ops when all group members are already on the same table', () => {
    const table = createRoundTable({ seatCount: 4 });
    const g1 = createHostGuest({ id: 'g1', tags: ['Cyber'] });
    const g2 = createHostGuest({ id: 'g2', tags: ['Cyber'] });

    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[2].id, 'g2');

    const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2'])];

    const before = new Map(seatToGuest);
    applyTagGroupOptimization(seatToGuest, [table], tagGroups, [g1, g2], comparator, new Map());

    // Guests should still be on the same table (may have moved for adjacency)
    expect(findGuestTable('g1', [table], seatToGuest)).toBe(table.id);
    expect(findGuestTable('g2', [table], seatToGuest)).toBe(table.id);
  });

  describe('Phase 1: Cross-table consolidation', () => {
    it('moves guest to same table as group members when spread across tables', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({ seatCount: 4 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, name: 'Alice', tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, name: 'Bob', tags: ['Cyber'] });
      const g3 = createHostGuest({ id: 'g3', ranking: 5, name: 'Charlie' });
      const allGuests = [g1, g2, g3];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(t1.seats[0].id, 'g1');
      seatToGuest.set(t1.seats[1].id, 'g3');
      seatToGuest.set(t2.seats[0].id, 'g2');

      const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2'])];

      applyTagGroupOptimization(seatToGuest, [t1, t2], tagGroups, allGuests, comparator, new Map());

      // Both g1 and g2 should be on the same table
      const g1Table = findGuestTable('g1', [t1, t2], seatToGuest);
      const g2Table = findGuestTable('g2', [t1, t2], seatToGuest);
      expect(g1Table).toBe(g2Table);
    });

    it('prefers table with locked group member as target', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({
        seatCount: 4,
        seatOverrides: {
          0: { locked: true, assignedGuestId: 'g1' },
        },
      });

      const g1 = createHostGuest({ id: 'g1', ranking: 3, name: 'Alice', tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 1, name: 'Bob', tags: ['Cyber'] });
      const allGuests = [g1, g2];

      const seatToGuest = new Map<string, string>();
      // g1 is locked on t2, g2 is on t1
      seatToGuest.set(t1.seats[0].id, 'g2');

      const lockedGuestMap = new Map<string, LockedGuestLocation>();
      lockedGuestMap.set('g1', {
        guestId: 'g1',
        tableId: t2.id,
        seatId: t2.seats[0].id,
        seat: t2.seats[0],
        table: t2,
      });

      const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2'])];

      applyTagGroupOptimization(seatToGuest, [t1, t2], tagGroups, allGuests, comparator, lockedGuestMap);

      // g2 should have moved to t2 (where g1 is locked)
      expect(findGuestTable('g2', [t1, t2], seatToGuest)).toBe(t2.id);
    });

    it('prefers table with most group members already present', () => {
      const t1 = createRoundTable({ seatCount: 6 });
      const t2 = createRoundTable({ seatCount: 6 });

      const g1 = createHostGuest({ id: 'g1', ranking: 2, tags: ['Data'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 3, tags: ['Data'] });
      const g3 = createHostGuest({ id: 'g3', ranking: 4, tags: ['Data'] });
      const allGuests = [g1, g2, g3];

      const seatToGuest = new Map<string, string>();
      // 2 guests on t1, 1 on t2
      seatToGuest.set(t1.seats[0].id, 'g1');
      seatToGuest.set(t1.seats[1].id, 'g2');
      seatToGuest.set(t2.seats[0].id, 'g3');

      const tagGroups = [createTagSitTogetherGroup('Data', ['g1', 'g2', 'g3'])];

      applyTagGroupOptimization(seatToGuest, [t1, t2], tagGroups, allGuests, comparator, new Map());

      // All 3 should be on t1 (where 2 already are)
      expect(findGuestTable('g1', [t1, t2], seatToGuest)).toBe(t1.id);
      expect(findGuestTable('g2', [t1, t2], seatToGuest)).toBe(t1.id);
      expect(findGuestTable('g3', [t1, t2], seatToGuest)).toBe(t1.id);
    });
  });

  describe('Phase 2: Within-table adjacency', () => {
    it('swaps to improve adjacency for group members on same table', () => {
      // 6-seat round table: seats 0-1-2-3-4-5 circular
      const table = createRoundTable({ seatCount: 6 });
      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Cyber'] });
      const filler1 = createHostGuest({ id: 'f1', ranking: 5 });
      const filler2 = createHostGuest({ id: 'f2', ranking: 6 });
      const filler3 = createHostGuest({ id: 'f3', ranking: 7 });
      const filler4 = createHostGuest({ id: 'f4', ranking: 8 });
      const allGuests = [g1, g2, filler1, filler2, filler3, filler4];

      const seatToGuest = new Map<string, string>();
      // Place g1 at seat 0, g2 at seat 3 (opposite sides, not adjacent)
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'f1');
      seatToGuest.set(table.seats[2].id, 'f2');
      seatToGuest.set(table.seats[3].id, 'g2');
      seatToGuest.set(table.seats[4].id, 'f3');
      seatToGuest.set(table.seats[5].id, 'f4');

      const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2'])];

      applyTagGroupOptimization(seatToGuest, [table], tagGroups, allGuests, comparator, new Map());

      // After optimization, g1 and g2 should be adjacent
      const g1SeatIdx = table.seats.findIndex((s: any) => seatToGuest.get(s.id) === 'g1');
      const g2SeatIdx = table.seats.findIndex((s: any) => seatToGuest.get(s.id) === 'g2');
      expect(g1SeatIdx).toBeGreaterThanOrEqual(0);
      expect(g2SeatIdx).toBeGreaterThanOrEqual(0);

      // Check adjacency via seat adjacentSeats
      const g1Seat = table.seats[g1SeatIdx];
      const g2Seat = table.seats[g2SeatIdx];
      const isAdjacent = g1Seat.adjacentSeats.includes(g2Seat.id) || g2Seat.adjacentSeats.includes(g1Seat.id);
      expect(isAdjacent).toBe(true);
    });
  });

  describe('Locked seat handling', () => {
    it('does not move locked guests', () => {
      const t1 = createRoundTable({
        seatCount: 4,
        seatOverrides: {
          0: { locked: true, assignedGuestId: 'g1' },
        },
      });
      const t2 = createRoundTable({ seatCount: 4 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Cyber'] });

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(t2.seats[0].id, 'g2');

      const lockedGuestMap = new Map<string, LockedGuestLocation>();
      lockedGuestMap.set('g1', {
        guestId: 'g1',
        tableId: t1.id,
        seatId: t1.seats[0].id,
        seat: t1.seats[0],
        table: t1,
      });

      const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2'])];

      applyTagGroupOptimization(seatToGuest, [t1, t2], tagGroups, [g1, g2], comparator, lockedGuestMap);

      // g1 should still be on t1 (locked), g2 should have moved to t1
      expect(findGuestTable('g2', [t1, t2], seatToGuest)).toBe(t1.id);
    });
  });

  describe('Multiple groups', () => {
    it('processes multiple groups without interference', () => {
      const t1 = createRoundTable({ seatCount: 6 });
      const t2 = createRoundTable({ seatCount: 6 });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Cyber'] });
      const g3 = createHostGuest({ id: 'g3', ranking: 3, tags: ['Data'] });
      const g4 = createHostGuest({ id: 'g4', ranking: 4, tags: ['Data'] });
      const filler = createHostGuest({ id: 'f1', ranking: 9 });
      const allGuests = [g1, g2, g3, g4, filler];

      const seatToGuest = new Map<string, string>();
      // Group 1 (Cyber): g1 on t1, g2 on t2
      seatToGuest.set(t1.seats[0].id, 'g1');
      seatToGuest.set(t2.seats[0].id, 'g2');
      // Group 2 (Data): g3 on t1, g4 on t2
      seatToGuest.set(t1.seats[2].id, 'g3');
      seatToGuest.set(t2.seats[2].id, 'g4');
      seatToGuest.set(t1.seats[4].id, 'f1');

      const tagGroups = [
        createTagSitTogetherGroup('Cyber', ['g1', 'g2']),
        createTagSitTogetherGroup('Data', ['g3', 'g4']),
      ];

      applyTagGroupOptimization(seatToGuest, [t1, t2], tagGroups, allGuests, comparator, new Map());

      // Each group should be consolidated on some table
      const g1Table = findGuestTable('g1', [t1, t2], seatToGuest);
      const g2Table = findGuestTable('g2', [t1, t2], seatToGuest);
      expect(g1Table).toBe(g2Table);

      const g3Table = findGuestTable('g3', [t1, t2], seatToGuest);
      const g4Table = findGuestTable('g4', [t1, t2], seatToGuest);
      expect(g3Table).toBe(g4Table);
    });
  });

  describe('Contiguous chain adjacency', () => {
    /** Helper: check if two guests are adjacent via seat adjacency lists */
    function areGuestsAdjacentInResult(
      guestAId: string,
      guestBId: string,
      tables: any[],
      seatToGuest: Map<string, string>
    ): boolean {
      let seatA: any = null;
      let seatB: any = null;
      for (const table of tables) {
        for (const seat of table.seats) {
          const occupant = seatToGuest.get(seat.id) ?? (seat.locked ? seat.assignedGuestId : null);
          if (occupant === guestAId) seatA = seat;
          if (occupant === guestBId) seatB = seat;
        }
      }
      if (!seatA || !seatB) return false;
      return seatA.adjacentSeats.includes(seatB.id);
    }

    /** Helper: check if all group members form a connected chain (each connected to at least one other) */
    function isConnectedChain(
      guestIds: string[],
      tables: any[],
      seatToGuest: Map<string, string>
    ): boolean {
      if (guestIds.length < 2) return true;

      // Build adjacency graph among group members
      const adjMap = new Map<string, Set<string>>();
      for (const gid of guestIds) adjMap.set(gid, new Set());

      for (let i = 0; i < guestIds.length; i++) {
        for (let j = i + 1; j < guestIds.length; j++) {
          if (areGuestsAdjacentInResult(guestIds[i], guestIds[j], tables, seatToGuest)) {
            adjMap.get(guestIds[i])!.add(guestIds[j]);
            adjMap.get(guestIds[j])!.add(guestIds[i]);
          }
        }
      }

      // BFS from first member to see if all are connected
      const visited = new Set<string>();
      const queue = [guestIds[0]];
      visited.add(guestIds[0]);
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of adjMap.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      return visited.size === guestIds.length;
    }

    it('forms contiguous chain for 2 members placed apart on round table', () => {
      // 6-seat round table, g1 at seat 0, g2 at seat 3 (opposite sides)
      const table = createRoundTable({ seatCount: 6 });
      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Cyber'] });
      const f1 = createHostGuest({ id: 'f1', ranking: 5 });
      const f2 = createHostGuest({ id: 'f2', ranking: 6 });
      const f3 = createHostGuest({ id: 'f3', ranking: 7 });
      const f4 = createHostGuest({ id: 'f4', ranking: 8 });
      const allGuests = [g1, g2, f1, f2, f3, f4];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'f1');
      seatToGuest.set(table.seats[2].id, 'f2');
      seatToGuest.set(table.seats[3].id, 'g2');
      seatToGuest.set(table.seats[4].id, 'f3');
      seatToGuest.set(table.seats[5].id, 'f4');

      const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2'])];

      applyTagGroupOptimization(seatToGuest, [table], tagGroups, allGuests, comparator, new Map());

      expect(areGuestsAdjacentInResult('g1', 'g2', [table], seatToGuest)).toBe(true);
    });

    it('forms contiguous chain for 3 members scattered on round table', () => {
      // 8-seat round table, g1 at seat 0, g2 at seat 3, g3 at seat 6
      const table = createRoundTable({ seatCount: 8 });
      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Data'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Data'] });
      const g3 = createHostGuest({ id: 'g3', ranking: 3, tags: ['Data'] });
      const f1 = createHostGuest({ id: 'f1', ranking: 5 });
      const f2 = createHostGuest({ id: 'f2', ranking: 6 });
      const f3 = createHostGuest({ id: 'f3', ranking: 7 });
      const f4 = createHostGuest({ id: 'f4', ranking: 8 });
      const f5 = createHostGuest({ id: 'f5', ranking: 9 });
      const allGuests = [g1, g2, g3, f1, f2, f3, f4, f5];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'f1');
      seatToGuest.set(table.seats[2].id, 'f2');
      seatToGuest.set(table.seats[3].id, 'g2');
      seatToGuest.set(table.seats[4].id, 'f3');
      seatToGuest.set(table.seats[5].id, 'f4');
      seatToGuest.set(table.seats[6].id, 'g3');
      seatToGuest.set(table.seats[7].id, 'f5');

      const tagGroups = [createTagSitTogetherGroup('Data', ['g1', 'g2', 'g3'])];

      applyTagGroupOptimization(seatToGuest, [table], tagGroups, allGuests, comparator, new Map());

      // All 3 should form a connected chain
      expect(isConnectedChain(['g1', 'g2', 'g3'], [table], seatToGuest)).toBe(true);
    });

    it('forms contiguous chain for 4 members scattered on large round table', () => {
      const table = createRoundTable({ seatCount: 10 });
      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['AI'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['AI'] });
      const g3 = createHostGuest({ id: 'g3', ranking: 3, tags: ['AI'] });
      const g4 = createHostGuest({ id: 'g4', ranking: 4, tags: ['AI'] });
      const fillers = Array.from({ length: 6 }, (_, i) =>
        createHostGuest({ id: `f${i + 1}`, ranking: 10 + i })
      );
      const allGuests = [g1, g2, g3, g4, ...fillers];

      const seatToGuest = new Map<string, string>();
      // Scatter group members: seats 0, 3, 5, 8
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'f1');
      seatToGuest.set(table.seats[2].id, 'f2');
      seatToGuest.set(table.seats[3].id, 'g2');
      seatToGuest.set(table.seats[4].id, 'f3');
      seatToGuest.set(table.seats[5].id, 'g3');
      seatToGuest.set(table.seats[6].id, 'f4');
      seatToGuest.set(table.seats[7].id, 'f5');
      seatToGuest.set(table.seats[8].id, 'g4');
      seatToGuest.set(table.seats[9].id, 'f6');

      const tagGroups = [createTagSitTogetherGroup('AI', ['g1', 'g2', 'g3', 'g4'])];

      applyTagGroupOptimization(seatToGuest, [table], tagGroups, allGuests, comparator, new Map());

      // All 4 should form a connected chain
      expect(isConnectedChain(['g1', 'g2', 'g3', 'g4'], [table], seatToGuest)).toBe(true);
    });

    it('falls back gracefully when locked seat blocks contiguous path', () => {
      // 6-seat table, locked non-group seat in between potential paths
      const table = createRoundTable({
        seatCount: 6,
        seatOverrides: {
          1: { locked: true, assignedGuestId: 'locked1' },
          5: { locked: true, assignedGuestId: 'locked2' },
        },
      });

      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Cyber'] });
      const locked1 = createHostGuest({ id: 'locked1', ranking: 10 });
      const locked2 = createHostGuest({ id: 'locked2', ranking: 11 });
      const f1 = createHostGuest({ id: 'f1', ranking: 5 });
      const f2 = createHostGuest({ id: 'f2', ranking: 6 });
      const allGuests = [g1, g2, locked1, locked2, f1, f2];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');
      // seat 1 is locked to locked1
      seatToGuest.set(table.seats[2].id, 'f1');
      seatToGuest.set(table.seats[3].id, 'g2');
      seatToGuest.set(table.seats[4].id, 'f2');
      // seat 5 is locked to locked2

      const lockedGuestMap = new Map<string, any>();
      lockedGuestMap.set('locked1', {
        guestId: 'locked1', tableId: table.id, seatId: table.seats[1].id,
        seat: table.seats[1], table,
      });
      lockedGuestMap.set('locked2', {
        guestId: 'locked2', tableId: table.id, seatId: table.seats[5].id,
        seat: table.seats[5], table,
      });

      const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2'])];

      // Should not crash, should still try best-effort
      applyTagGroupOptimization(seatToGuest, [table], tagGroups, allGuests, comparator, lockedGuestMap);

      // Both guests should still be on the same table
      expect(findGuestTable('g1', [table], seatToGuest)).toBe(table.id);
      expect(findGuestTable('g2', [table], seatToGuest)).toBe(table.id);

      // All assigned guests should still be present
      const allAssigned = new Set(seatToGuest.values());
      expect(allAssigned.has('g1')).toBe(true);
      expect(allAssigned.has('g2')).toBe(true);
    });

    it('contiguous placement does not break other tag groups on same table', () => {
      const table = createRoundTable({ seatCount: 8 });
      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Cyber'] });
      const g3 = createHostGuest({ id: 'g3', ranking: 3, tags: ['Data'] });
      const g4 = createHostGuest({ id: 'g4', ranking: 4, tags: ['Data'] });
      const f1 = createHostGuest({ id: 'f1', ranking: 7 });
      const f2 = createHostGuest({ id: 'f2', ranking: 8 });
      const f3 = createHostGuest({ id: 'f3', ranking: 9 });
      const f4 = createHostGuest({ id: 'f4', ranking: 10 });
      const allGuests = [g1, g2, g3, g4, f1, f2, f3, f4];

      const seatToGuest = new Map<string, string>();
      // Interleave groups: g1, f1, g3, f2, g2, f3, g4, f4
      seatToGuest.set(table.seats[0].id, 'g1');
      seatToGuest.set(table.seats[1].id, 'f1');
      seatToGuest.set(table.seats[2].id, 'g3');
      seatToGuest.set(table.seats[3].id, 'f2');
      seatToGuest.set(table.seats[4].id, 'g2');
      seatToGuest.set(table.seats[5].id, 'f3');
      seatToGuest.set(table.seats[6].id, 'g4');
      seatToGuest.set(table.seats[7].id, 'f4');

      const tagGroups = [
        createTagSitTogetherGroup('Cyber', ['g1', 'g2']),
        createTagSitTogetherGroup('Data', ['g3', 'g4']),
      ];

      applyTagGroupOptimization(seatToGuest, [table], tagGroups, allGuests, comparator, new Map());

      // All guests should still be seated (no one lost)
      const allAssigned = new Set(seatToGuest.values());
      expect(allAssigned.size).toBe(8);
      expect(allAssigned.has('g1')).toBe(true);
      expect(allAssigned.has('g2')).toBe(true);
      expect(allAssigned.has('g3')).toBe(true);
      expect(allAssigned.has('g4')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('skips groups with fewer than 2 members', () => {
      const table = createRoundTable({ seatCount: 4 });
      const g1 = createHostGuest({ id: 'g1' });

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');

      const tagGroups = [createTagSitTogetherGroup('Solo', ['g1'])];

      const before = new Map(seatToGuest);
      applyTagGroupOptimization(seatToGuest, [table], tagGroups, [g1], comparator, new Map());
      expect(seatToGuest).toEqual(before);
    });

    it('handles group with guest not currently seated (deleted or excluded)', () => {
      const table = createRoundTable({ seatCount: 4 });
      const g1 = createHostGuest({ id: 'g1', tags: ['Cyber'] });

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(table.seats[0].id, 'g1');

      // g2 is in the group but not seated
      const tagGroups = [createTagSitTogetherGroup('Cyber', ['g1', 'g2-missing'])];

      // Should not crash
      const before = new Map(seatToGuest);
      applyTagGroupOptimization(seatToGuest, [table], tagGroups, [g1], comparator, new Map());
      // Only 1 seated member, so treated as <2 seated, should no-op
      expect(seatToGuest).toEqual(before);
    });

    it('does not swap with other tag group members during consolidation', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({ seatCount: 4 });

      // Group 1: g1 on t1, g2 on t2
      // Group 2: g3 on t1 (should not be displaced)
      const g1 = createHostGuest({ id: 'g1', ranking: 1, tags: ['Cyber'] });
      const g2 = createHostGuest({ id: 'g2', ranking: 2, tags: ['Cyber'] });
      const g3 = createHostGuest({ id: 'g3', ranking: 3, tags: ['Data'] });
      const g4 = createHostGuest({ id: 'g4', ranking: 4, tags: ['Data'] });
      const allGuests = [g1, g2, g3, g4];

      const seatToGuest = new Map<string, string>();
      seatToGuest.set(t1.seats[0].id, 'g1');
      seatToGuest.set(t1.seats[1].id, 'g3');
      seatToGuest.set(t1.seats[2].id, 'g4');
      seatToGuest.set(t2.seats[0].id, 'g2');

      const tagGroups = [
        createTagSitTogetherGroup('Cyber', ['g1', 'g2']),
        createTagSitTogetherGroup('Data', ['g3', 'g4']),
      ];

      applyTagGroupOptimization(seatToGuest, [t1, t2], tagGroups, allGuests, comparator, new Map());

      // g3 should still exist in the map (not lost)
      const g3Seated = Array.from(seatToGuest.values()).includes('g3');
      expect(g3Seated).toBe(true);
    });
  });
});
