import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAdjacentSeats,
  areGuestsAdjacent,
  findGuestSeat,
  findContiguousSeats,
  findContiguousSeatsForCluster,
  getAvailableSeatsOnTable,
  countClusterGuestsOnTable,
} from '@/utils/autoFill/seatFinder';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import { createHostGuest, resetGuestCounter } from '../factories/guestFactory';

beforeEach(() => {
  resetTableCounter();
  resetGuestCounter();
});

describe('getAdjacentSeats', () => {
  it('returns adjacent seat objects from IDs', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seat0 = table.seats[0];
    const adjacent = getAdjacentSeats(seat0, table.seats);
    // Seat 0 should be adjacent to seat 3 (prev) and seat 1 (next)
    expect(adjacent).toHaveLength(2);
    expect(adjacent.map((s: { id: string }) => s.id)).toContain(table.seats[1].id);
    expect(adjacent.map((s: { id: string }) => s.id)).toContain(table.seats[3].id);
  });

  it('returns empty array when no adjacentSeats defined', () => {
    const seat = { id: 's1', adjacentSeats: undefined };
    expect(getAdjacentSeats(seat, [])).toEqual([]);
  });

  it('filters out invalid/missing seat IDs', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seat = { ...table.seats[0], adjacentSeats: ['nonexistent', table.seats[1].id] };
    const adjacent = getAdjacentSeats(seat, table.seats);
    expect(adjacent).toHaveLength(1);
    expect(adjacent[0].id).toBe(table.seats[1].id);
  });
});

describe('areGuestsAdjacent', () => {
  it('returns true when guests are in neighboring seats on same table', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[1].id, 'g2');

    expect(areGuestsAdjacent('g1', 'g2', [table], seatToGuest, new Map())).toBe(true);
  });

  it('returns false when guests are on different tables', () => {
    const t1 = createRoundTable({ seatCount: 4 });
    const t2 = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(t1.seats[0].id, 'g1');
    seatToGuest.set(t2.seats[0].id, 'g2');

    expect(areGuestsAdjacent('g1', 'g2', [t1, t2], seatToGuest, new Map())).toBe(false);
  });

  it('returns false when on same table but not adjacent', () => {
    const table = createRoundTable({ seatCount: 6 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[3].id, 'g2'); // 3 seats apart on a 6-seat table

    expect(areGuestsAdjacent('g1', 'g2', [table], seatToGuest, new Map())).toBe(false);
  });

  it('returns false when either guest is not seated', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');

    expect(areGuestsAdjacent('g1', 'g2', [table], seatToGuest, new Map())).toBe(false);
  });

  it('detects adjacency with locked guest via assignedGuestId', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 1: { locked: true, assignedGuestId: 'g2' } },
    });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    // g2 is locked in seat 1, which is adjacent to seat 0

    expect(areGuestsAdjacent('g1', 'g2', [table], seatToGuest, new Map())).toBe(true);
  });
});

describe('findGuestSeat', () => {
  it('finds guest in seatToGuest map', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[2].id, 'g1');

    const result = findGuestSeat('g1', [table], seatToGuest);
    expect(result).not.toBeNull();
    expect(result!.seat.id).toBe(table.seats[2].id);
    expect(result!.table.id).toBe(table.id);
  });

  it('finds guest in locked seat via assignedGuestId', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 0: { locked: true, assignedGuestId: 'g1' } },
    });
    const seatToGuest = new Map<string, string>();

    const result = findGuestSeat('g1', [table], seatToGuest);
    expect(result).not.toBeNull();
    expect(result!.seat.id).toBe(table.seats[0].id);
  });

  it('returns null for unseated guest', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();

    expect(findGuestSeat('nobody', [table], seatToGuest)).toBeNull();
  });
});

describe('findContiguousSeats', () => {
  it('returns startSeat when count=1', () => {
    const table = createRoundTable({ seatCount: 4 });
    const result = findContiguousSeats(table.seats[0], table.seats, 1, new Map(), [], new Map());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(table.seats[0].id);
  });

  it('finds 3 connected seats via BFS', () => {
    const table = createRoundTable({ seatCount: 6 });
    const result = findContiguousSeats(table.seats[0], table.seats, 3, new Map(), [], new Map());
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('skips locked seats', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 1: { locked: true } },
    });
    const result = findContiguousSeats(table.seats[0], table.seats, 3, new Map(), [], new Map());
    // Seat 1 is locked, BFS should skip it
    const resultIds = result.map((s: { id: string }) => s.id);
    expect(resultIds).not.toContain(table.seats[1].id);
  });

  it('returns partial result when not enough contiguous seats exist', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: {
        1: { locked: true },
        3: { locked: true },
      },
    });
    // Only seat 0 is reachable without crossing locked seats (seat 2 is across locked seats)
    const result = findContiguousSeats(table.seats[0], table.seats, 4, new Map(), [], new Map());
    expect(result.length).toBeLessThan(4);
  });
});

describe('findContiguousSeatsForCluster', () => {
  it('starts from locked anchor seat when cluster member is locked', () => {
    const table = createRoundTable({
      seatCount: 6,
      seatOverrides: { 2: { locked: true, assignedGuestId: 'g1' } },
    });
    const seatToGuest = new Map<string, string>();
    const lockedMap = new Map([['g1', { guestId: 'g1', tableId: table.id, seatId: table.seats[2].id, seat: table.seats[2], table }]]);

    const result = findContiguousSeatsForCluster(table, 3, seatToGuest, ['g1', 'g2', 'g3'], new Map(), lockedMap);
    expect(result).not.toBeNull();
    expect(result!.anchorSeat.id).toBe(table.seats[2].id);
  });

  it('finds contiguous seats from any unlocked seat when no anchor', () => {
    const table = createRoundTable({ seatCount: 6 });
    const result = findContiguousSeatsForCluster(table, 3, new Map(), ['g1', 'g2', 'g3'], new Map(), new Map());
    expect(result).not.toBeNull();
    expect(result!.seats).toHaveLength(3);
  });

  it('returns null when table cannot accommodate cluster size', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: {
        0: { locked: true },
        1: { locked: true },
        2: { locked: true },
      },
    });
    // Only 1 unlocked seat, need 3
    const result = findContiguousSeatsForCluster(table, 3, new Map(), ['g1', 'g2', 'g3'], new Map(), new Map());
    expect(result).toBeNull();
  });
});

describe('getAvailableSeatsOnTable', () => {
  it('returns all non-locked seats', () => {
    const table = createRoundTable({
      seatCount: 4,
      seatOverrides: { 0: { locked: true }, 2: { locked: true } },
    });
    const available = getAvailableSeatsOnTable(table, new Map());
    expect(available).toHaveLength(2);
  });

  it('returns empty array when all seats are locked', () => {
    const table = createRoundTable({
      seatCount: 3,
      seatOverrides: { 0: { locked: true }, 1: { locked: true }, 2: { locked: true } },
    });
    const available = getAvailableSeatsOnTable(table, new Map());
    expect(available).toHaveLength(0);
  });
});

describe('countClusterGuestsOnTable', () => {
  it('counts cluster members currently on specified table', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'g1');
    seatToGuest.set(table.seats[1].id, 'g2');
    seatToGuest.set(table.seats[2].id, 'g3');

    const count = countClusterGuestsOnTable(table.id, ['g1', 'g3', 'g5'], [table], seatToGuest, new Map());
    expect(count).toBe(2); // g1 and g3
  });

  it('returns 0 when no cluster members are on the table', () => {
    const table = createRoundTable({ seatCount: 4 });
    const seatToGuest = new Map<string, string>();
    seatToGuest.set(table.seats[0].id, 'other');

    const count = countClusterGuestsOnTable(table.id, ['g1', 'g2'], [table], seatToGuest, new Map());
    expect(count).toBe(0);
  });
});
