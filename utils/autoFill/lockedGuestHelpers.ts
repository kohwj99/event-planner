/**
 * lockedGuestHelpers.ts
 *
 * Manages locked guest state during the autofill algorithm.
 * Locked guests are those pre-assigned to specific seats that should not be moved.
 *
 * Provides:
 * - Building a lookup map of all locked guest locations from table data
 * - Checking whether placing a guest in a seat would violate sit-away rules
 *   with adjacent locked guests (used during initial placement to avoid
 *   creating violations that can't be fixed later since locked seats are immovable)
 */

import { ProximityRules } from '@/types/Event';
import { LockedGuestLocation } from './autoFillTypes';
import { getSitAwayGuests } from './proximityRuleHelpers';
import { getAdjacentSeats } from './seatFinder';

/**
 * Build a map of guestId -> LockedGuestLocation for all locked seats across all tables.
 * A seat is considered locked if seat.locked === true and it has an assigned guest.
 */
export function buildLockedGuestMap(tables: any[]): Map<string, LockedGuestLocation> {
  const lockedMap = new Map<string, LockedGuestLocation>();

  for (const table of tables) {
    for (const seat of table.seats || []) {
      if (seat.locked && seat.assignedGuestId) {
        lockedMap.set(seat.assignedGuestId, {
          guestId: seat.assignedGuestId,
          tableId: table.id,
          seatId: seat.id,
          seat,
          table,
        });
      }
    }
  }

  return lockedMap;
}

/**
 * Check if placing a guest in a seat would violate any sit-away rules
 * with guests in adjacent locked seats.
 * Returns true if a violation would occur (placement should be avoided).
 */
export function wouldViolateSitAwayWithLocked(
  guestId: string,
  seat: any,
  allSeats: any[],
  lockedGuestMap: Map<string, LockedGuestLocation>,
  proximityRules: ProximityRules
): boolean {
  const sitAwayGuests = getSitAwayGuests(guestId, proximityRules.sitAway);
  if (sitAwayGuests.length === 0) return false;

  const adjacentSeats = getAdjacentSeats(seat, allSeats);

  for (const adjSeat of adjacentSeats) {
    if (adjSeat.locked && adjSeat.assignedGuestId) {
      if (sitAwayGuests.includes(adjSeat.assignedGuestId)) {
        return true;
      }
    }
  }

  return false;
}
