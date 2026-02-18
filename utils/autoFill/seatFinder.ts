/**
 * seatFinder.ts
 *
 * Spatial query functions for seats and guest locations:
 * - Seat adjacency lookup (which seats are next to a given seat)
 * - Guest-to-guest adjacency check (are two guests sitting next to each other)
 * - Finding which seat a guest occupies (searching across all tables)
 * - BFS-based contiguous seat search (finding connected empty seats for clusters)
 * - Table-level queries (available seats, cluster member counts)
 *
 * These functions are used by multiple algorithm phases (placement, sit-together
 * optimization, sit-away optimization, and violation checking).
 */

import { LockedGuestLocation } from './autoFillTypes';

/**
 * Get all seats adjacent to a given seat.
 * Uses the seat's adjacentSeats array (pre-computed seat IDs) to look up actual seat objects.
 */
export function getAdjacentSeats(seat: any, allSeats: any[]): any[] {
  if (!seat.adjacentSeats || seat.adjacentSeats.length === 0) return [];
  return seat.adjacentSeats
    .map((adjId: string) => allSeats.find((s) => s.id === adjId))
    .filter(Boolean);
}

/**
 * Check if two guests are currently adjacent (on the same table and in neighboring seats).
 * Considers both the seatToGuest assignment map and locked seat assignments.
 */
export function areGuestsAdjacent(
  guest1Id: string,
  guest2Id: string,
  tables: any[],
  seatToGuest: Map<string, string>,
  _lockedGuestMap: Map<string, LockedGuestLocation>
): boolean {
  const loc1 = findGuestSeat(guest1Id, tables, seatToGuest);
  const loc2 = findGuestSeat(guest2Id, tables, seatToGuest);

  if (!loc1 || !loc2) return false;
  if (loc1.table.id !== loc2.table.id) return false;

  const adjacentSeats = getAdjacentSeats(loc1.seat, loc1.table.seats);
  return adjacentSeats.some(adjSeat => {
    const adjGuestId = seatToGuest.get(adjSeat.id) || (adjSeat.locked ? adjSeat.assignedGuestId : null);
    return adjGuestId === guest2Id;
  });
}

/**
 * Find the seat where a guest is currently assigned.
 * Checks both the seatToGuest map (for newly assigned guests) and
 * locked seats (for pre-locked guests).
 */
export function findGuestSeat(
  guestId: string,
  tables: any[],
  seatToGuest: Map<string, string>
): { seat: any; table: any } | null {
  for (const table of tables) {
    for (const seat of table.seats) {
      if (seatToGuest.get(seat.id) === guestId) {
        return { seat, table };
      }
      // Also check locked seats
      if (seat.locked && seat.assignedGuestId === guestId) {
        return { seat, table };
      }
    }
  }
  return null;
}

/**
 * Find contiguous empty seats starting from a given seat using BFS.
 * Returns up to `count` connected seats that are not locked.
 */
export function findContiguousSeats(
  startSeat: any,
  allSeats: any[],
  count: number,
  _seatToGuest: Map<string, string>,
  _guests: any[],
  _lockedGuestMap: Map<string, LockedGuestLocation>
): any[] {
  const result: any[] = [startSeat];
  const visited = new Set<string>([startSeat.id]);

  // BFS to find adjacent seats
  while (result.length < count) {
    let foundNext = false;

    for (const currentSeat of result) {
      const adjacentSeats = getAdjacentSeats(currentSeat, allSeats);

      for (const adjSeat of adjacentSeats) {
        if (visited.has(adjSeat.id)) continue;
        if (adjSeat.locked) continue;

        visited.add(adjSeat.id);
        result.push(adjSeat);
        foundNext = true;

        if (result.length >= count) break;
      }

      if (result.length >= count) break;
    }

    if (!foundNext) break;
  }

  return result;
}

/**
 * Find contiguous seats on a table that can accommodate a cluster.
 * Prioritizes starting from a locked anchor seat if a cluster member is locked on this table.
 * Uses BFS to find connected seats, skipping locked seats (except the anchor).
 * Returns seats in order of how they should be filled (adjacent to each other).
 */
export function findContiguousSeatsForCluster(
  table: any,
  clusterSize: number,
  seatToGuest: Map<string, string>,
  clusterGuestIds: string[],
  guestLookup: Map<string, any>,
  lockedGuestMap: Map<string, LockedGuestLocation>
): { seats: any[]; anchorSeat: any } | null {
  const allSeats = table.seats || [];

  // First, check if any cluster member is already locked on this table
  let lockedAnchor: any = null;
  for (const guestId of clusterGuestIds) {
    if (lockedGuestMap.has(guestId)) {
      const lockedLoc = lockedGuestMap.get(guestId)!;
      if (lockedLoc.tableId === table.id) {
        lockedAnchor = lockedLoc.seat;
        break;
      }
    }
  }

  // Try to find contiguous seats starting from the locked anchor or any seat
  const startSeats = lockedAnchor ? [lockedAnchor] : allSeats.filter((s: any) => !s.locked);

  for (const startSeat of startSeats) {
    const contiguousSeats: any[] = [];
    const visited = new Set<string>();
    const queue = [startSeat];

    while (queue.length > 0 && contiguousSeats.length < clusterSize) {
      const currentSeat = queue.shift()!;

      if (visited.has(currentSeat.id)) continue;
      visited.add(currentSeat.id);

      // Check if this seat can be used (empty, or occupied by a non-cluster guest, or occupied by a cluster guest)
      const isLocked = currentSeat.locked;

      // Can use if: not locked (unless it's our locked anchor), or is empty, or has a cluster member
      if (isLocked && currentSeat.id !== lockedAnchor?.id) continue;

      contiguousSeats.push(currentSeat);

      // Add adjacent seats to queue
      const adjacentSeats = getAdjacentSeats(currentSeat, allSeats);
      for (const adjSeat of adjacentSeats) {
        if (!visited.has(adjSeat.id)) {
          queue.push(adjSeat);
        }
      }
    }

    if (contiguousSeats.length >= clusterSize) {
      return {
        seats: contiguousSeats.slice(0, clusterSize),
        anchorSeat: lockedAnchor || startSeat
      };
    }
  }

  return null;
}

/**
 * Get all available (not locked) seats on a table.
 */
export function getAvailableSeatsOnTable(
  table: any,
  _seatToGuest: Map<string, string>
): any[] {
  return (table.seats || []).filter((s: any) => !s.locked);
}

/**
 * Count how many guests from a cluster are currently on a specific table.
 * Checks both the seatToGuest map and locked seat assignments.
 */
export function countClusterGuestsOnTable(
  tableId: string,
  clusterGuestIds: string[],
  tables: any[],
  seatToGuest: Map<string, string>,
  _lockedGuestMap: Map<string, LockedGuestLocation>
): number {
  let count = 0;
  for (const guestId of clusterGuestIds) {
    const loc = findGuestSeat(guestId, tables, seatToGuest);
    if (loc && loc.table.id === tableId) {
      count++;
    }
  }
  return count;
}
