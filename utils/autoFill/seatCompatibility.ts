/**
 * seatCompatibility.ts
 *
 * Validates whether a guest can sit in a given seat based on seat mode restrictions
 * (host-only, external-only, default) and provides candidate selection functions
 * that filter guests by assignment status, host/external type, and seat mode compatibility.
 *
 * These functions are used during initial placement and optimization passes to
 * ensure seat mode constraints are always respected.
 */

import { SeatMode, canGuestSitInSeat } from '@/types/Seat';

/**
 * Check if a guest can be placed in a seat based on the seat's mode restriction.
 * Delegates to the canonical canGuestSitInSeat from types/Seat.
 */
export function canPlaceGuestInSeat(guest: any, seat: any): boolean {
  const mode: SeatMode = seat.mode || 'default';
  const guestFromHost = guest.fromHost === true;
  return canGuestSitInSeat(guestFromHost, mode);
}

/**
 * Find the next unassigned guest from candidates who is compatible with the given seat.
 * Returns the first match (candidates are pre-sorted by priority).
 */
export function getNextCompatibleGuest(
  allCandidates: any[],
  assignedGuests: Set<string>,
  seat: any
): any | null {
  const available = allCandidates.filter(g =>
    !assignedGuests.has(g.id) && canPlaceGuestInSeat(g, seat)
  );
  if (available.length === 0) return null;
  return available[0];
}

/**
 * Find the next unassigned guest of a specific type (host or external)
 * who is compatible with the given seat.
 */
export function getNextCompatibleGuestOfType(
  allCandidates: any[],
  assignedGuests: Set<string>,
  isHost: boolean,
  seat: any
): any | null {
  const available = allCandidates.filter(g =>
    !assignedGuests.has(g.id) &&
    g.fromHost === isHost &&
    canPlaceGuestInSeat(g, seat)
  );
  if (available.length === 0) return null;
  return available[0];
}

/**
 * Get the next unassigned guest from a unified (host + external) candidate list.
 * Candidates are assumed to be pre-sorted by the comparator.
 */
export function getNextGuestFromUnifiedList(
  allCandidates: any[],
  assignedGuests: Set<string>,
  _comparator: (a: any, b: any) => number
): any | null {
  const available = allCandidates.filter(g => !assignedGuests.has(g.id));
  if (available.length === 0) return null;
  return available[0];
}

/**
 * Get the next unassigned guest of a specific type (host or external)
 * from a unified candidate list. Does not check seat mode compatibility.
 */
export function getNextGuestOfType(
  allCandidates: any[],
  assignedGuests: Set<string>,
  isHost: boolean
): any | null {
  const available = allCandidates.filter(g =>
    !assignedGuests.has(g.id) && g.fromHost === isHost
  );
  if (available.length === 0) return null;
  return available[0];
}
