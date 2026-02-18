/**
 * autoFillTypes.ts
 *
 * Internal shared types for the autoFill algorithm modules.
 * Contains types that are implementation details (not part of the public API).
 * Public-facing types (SortRule, ProximityRules, etc.) live in types/Event.ts.
 */

/**
 * Tracks the location of a guest who is locked into a specific seat.
 * Used during placement and optimization to ensure locked guests are never moved.
 */
export interface LockedGuestLocation {
  guestId: string;
  tableId: string;
  seatId: string;
  seat: any;
  table: any;
}
