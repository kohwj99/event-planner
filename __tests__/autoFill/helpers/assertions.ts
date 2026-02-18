import { expect } from 'vitest';

/**
 * Assert that two guests are in adjacent seats.
 * Checks the seatToGuest map and seat.adjacentSeats arrays.
 */
export function expectGuestsAdjacent(
  guest1Id: string,
  guest2Id: string,
  tables: { id: string; seats: { id: string; adjacentSeats?: string[]; locked?: boolean; assignedGuestId?: string | null }[] }[],
  seatToGuest: Map<string, string>
): void {
  let seat1Id: string | null = null;
  let seat2Id: string | null = null;
  let seat1Adj: string[] = [];

  for (const table of tables) {
    for (const seat of table.seats) {
      const assigned = seatToGuest.get(seat.id) ?? (seat.locked ? seat.assignedGuestId : null);
      if (assigned === guest1Id) {
        seat1Id = seat.id;
        seat1Adj = seat.adjacentSeats ?? [];
      }
      if (assigned === guest2Id) {
        seat2Id = seat.id;
      }
    }
  }

  expect(seat1Id, `Guest ${guest1Id} should be seated`).not.toBeNull();
  expect(seat2Id, `Guest ${guest2Id} should be seated`).not.toBeNull();
  expect(seat1Adj, `Seat of ${guest1Id} should be adjacent to seat of ${guest2Id}`).toContain(seat2Id);
}

/**
 * Assert that two guests are NOT in adjacent seats.
 */
export function expectGuestsNotAdjacent(
  guest1Id: string,
  guest2Id: string,
  tables: { id: string; seats: { id: string; adjacentSeats?: string[]; locked?: boolean; assignedGuestId?: string | null }[] }[],
  seatToGuest: Map<string, string>
): void {
  let seat1Adj: string[] = [];
  let seat2Id: string | null = null;

  for (const table of tables) {
    for (const seat of table.seats) {
      const assigned = seatToGuest.get(seat.id) ?? (seat.locked ? seat.assignedGuestId : null);
      if (assigned === guest1Id) {
        seat1Adj = seat.adjacentSeats ?? [];
      }
      if (assigned === guest2Id) {
        seat2Id = seat.id;
      }
    }
  }

  if (seat2Id === null) return; // If either not seated, they can't be adjacent
  expect(seat1Adj).not.toContain(seat2Id);
}

/**
 * Get the guest ID assigned to a specific seat from the seatToGuest map.
 */
export function getGuestAtSeat(
  seatId: string,
  seatToGuest: Map<string, string>
): string | undefined {
  return seatToGuest.get(seatId);
}

/**
 * Get the seat ID where a specific guest is assigned.
 */
export function getSeatForGuest(
  guestId: string,
  seatToGuest: Map<string, string>
): string | undefined {
  for (const [seatId, gId] of seatToGuest.entries()) {
    if (gId === guestId) return seatId;
  }
  return undefined;
}

/**
 * Write seatToGuest assignments back to seat.assignedGuestId on tables.
 * Needed before calling performFinalViolationCheck which reads from seat objects.
 */
export function writeSeatAssignments(
  tables: { seats: { id: string; assignedGuestId?: string | null }[] }[],
  seatToGuest: Map<string, string>
): void {
  for (const table of tables) {
    for (const seat of table.seats) {
      const guestId = seatToGuest.get(seat.id);
      if (guestId) {
        seat.assignedGuestId = guestId;
      }
    }
  }
}
