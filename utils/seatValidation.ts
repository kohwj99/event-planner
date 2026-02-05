// utils/seatValidation.ts
// Centralized validation functions for seat assignments and swaps

import { Seat, SeatMode, canGuestSitInSeat } from '@/types/Seat';

/**
 * Result of a seat assignment validation
 */
export interface SeatAssignmentValidation {
  canAssign: boolean;
  reason: string | null;
  seatMode: SeatMode;
  guestType: 'host' | 'external' | null;
}

/**
 * Result of a seat swap validation
 */
export interface SeatSwapValidation {
  canSwap: boolean;
  reasons: string[];
  guest1Validation: SeatAssignmentValidation | null;
  guest2Validation: SeatAssignmentValidation | null;
}

/**
 * Guest information needed for validation
 */
export interface GuestInfo {
  id: string;
  name?: string;
  fromHost: boolean;
}

/**
 * Validate if a guest can be assigned to a seat based on seat mode
 * This is the core validation function used by both assign and swap operations
 * 
 * @param guest - The guest to validate (or null to clear the seat)
 * @param seat - The seat to validate against
 * @returns Validation result with canAssign boolean and reason if invalid
 */
export function validateGuestSeatAssignment(
  guest: GuestInfo | null | undefined,
  seat: Seat | undefined
): SeatAssignmentValidation {
  // If no seat provided, invalid
  if (!seat) {
    return {
      canAssign: false,
      reason: 'Seat not found',
      seatMode: 'default',
      guestType: null,
    };
  }

  const seatMode: SeatMode = seat.mode || 'default';

  // If clearing the seat (guest is null), always allowed
  if (!guest) {
    return {
      canAssign: true,
      reason: null,
      seatMode,
      guestType: null,
    };
  }

  const guestType: 'host' | 'external' = guest.fromHost ? 'host' : 'external';

  // Check if seat is locked
  if (seat.locked) {
    return {
      canAssign: false,
      reason: `Seat ${seat.seatNumber} is locked`,
      seatMode,
      guestType,
    };
  }

  // Check seat mode compatibility
  const canSit = canGuestSitInSeat(guest.fromHost, seatMode);

  if (!canSit) {
    const guestTypeLabel = guest.fromHost ? 'Host' : 'External';
    const seatRequirement = seatMode === 'host-only' 
      ? 'host guests only' 
      : 'external guests only';
    
    return {
      canAssign: false,
      reason: `${guest.name || 'Guest'} (${guestTypeLabel}) cannot be assigned to this seat (${seatRequirement})`,
      seatMode,
      guestType,
    };
  }

  return {
    canAssign: true,
    reason: null,
    seatMode,
    guestType,
  };
}

/**
 * Validate if two seats can be swapped based on seat modes and guest types
 * Checks both directions: guest1 -> seat2 and guest2 -> seat1
 * 
 * @param seat1 - First seat in the swap
 * @param seat2 - Second seat in the swap
 * @param guest1 - Guest currently in seat1
 * @param guest2 - Guest currently in seat2
 * @returns Validation result with canSwap boolean and reasons if invalid
 */
export function validateSeatSwap(
  seat1: Seat | undefined,
  seat2: Seat | undefined,
  guest1: GuestInfo | null | undefined,
  guest2: GuestInfo | null | undefined
): SeatSwapValidation {
  const reasons: string[] = [];

  // Basic seat validation
  if (!seat1 || !seat2) {
    return {
      canSwap: false,
      reasons: ['One or both seats not found'],
      guest1Validation: null,
      guest2Validation: null,
    };
  }

  if (seat1.id === seat2.id) {
    return {
      canSwap: false,
      reasons: ['Cannot swap a seat with itself'],
      guest1Validation: null,
      guest2Validation: null,
    };
  }

  // Check locked seats
  if (seat1.locked) {
    reasons.push(`Seat ${seat1.seatNumber} is locked`);
  }
  if (seat2.locked) {
    reasons.push(`Seat ${seat2.seatNumber} is locked`);
  }

  // Check empty seats
  if (!guest1) {
    reasons.push(`Seat ${seat1.seatNumber} is empty`);
  }
  if (!guest2) {
    reasons.push(`Seat ${seat2.seatNumber} is empty`);
  }

  // If we have basic validation failures, return early
  if (reasons.length > 0) {
    return {
      canSwap: false,
      reasons,
      guest1Validation: null,
      guest2Validation: null,
    };
  }

  // Validate seat mode compatibility for both directions
  // guest1 needs to be able to sit in seat2
  const guest1ToSeat2 = validateGuestSeatAssignment(guest1, { ...seat2, locked: false });
  // guest2 needs to be able to sit in seat1  
  const guest2ToSeat1 = validateGuestSeatAssignment(guest2, { ...seat1, locked: false });

  if (!guest1ToSeat2.canAssign) {
    reasons.push(guest1ToSeat2.reason || 'Guest 1 cannot sit in seat 2');
  }

  if (!guest2ToSeat1.canAssign) {
    reasons.push(guest2ToSeat1.reason || 'Guest 2 cannot sit in seat 1');
  }

  return {
    canSwap: reasons.length === 0,
    reasons,
    guest1Validation: guest1ToSeat2,
    guest2Validation: guest2ToSeat1,
  };
}

/**
 * Get list of seat modes that are compatible with a guest type
 * Useful for filtering which seats a guest can be assigned to
 * 
 * @param fromHost - Whether the guest is from the host company
 * @returns Array of compatible seat modes
 */
export function getCompatibleSeatModes(fromHost: boolean): SeatMode[] {
  if (fromHost) {
    return ['default', 'host-only'];
  } else {
    return ['default', 'external-only'];
  }
}

/**
 * Check if a seat mode is compatible with a guest type
 * 
 * @param seatMode - The seat's mode
 * @param fromHost - Whether the guest is from the host company
 * @returns true if the guest can sit in the seat
 */
export function isSeatModeCompatible(seatMode: SeatMode | undefined, fromHost: boolean): boolean {
  const mode = seatMode || 'default';
  return canGuestSitInSeat(fromHost, mode);
}

/**
 * Get a human-readable description of why a seat mode is incompatible
 * 
 * @param seatMode - The seat's mode
 * @param fromHost - Whether the guest is from the host company
 * @returns Description string or null if compatible
 */
export function getSeatModeIncompatibilityReason(
  seatMode: SeatMode | undefined,
  fromHost: boolean
): string | null {
  const mode = seatMode || 'default';
  
  if (canGuestSitInSeat(fromHost, mode)) {
    return null;
  }

  const guestType = fromHost ? 'Host guests' : 'External guests';
  
  if (mode === 'host-only') {
    return `${guestType} cannot be seated in host-only seats`;
  }
  
  if (mode === 'external-only') {
    return `${guestType} cannot be seated in external-only seats`;
  }

  return null;
}

/**
 * Filter a list of guests to only those compatible with a seat's mode
 * 
 * @param guests - Array of guests to filter
 * @param seatMode - The seat's mode
 * @returns Filtered array of compatible guests
 */
export function filterGuestsBySeatMode<T extends { fromHost: boolean }>(
  guests: T[],
  seatMode: SeatMode | undefined
): T[] {
  const mode = seatMode || 'default';
  
  // Default mode accepts all guests
  if (mode === 'default') {
    return guests;
  }

  return guests.filter((guest) => canGuestSitInSeat(guest.fromHost, mode));
}

/**
 * Partition guests into compatible and incompatible groups based on seat mode
 * Useful for UI that wants to show incompatible guests as disabled
 * 
 * @param guests - Array of guests to partition
 * @param seatMode - The seat's mode
 * @returns Object with compatible and incompatible arrays
 */
export function partitionGuestsBySeatMode<T extends { fromHost: boolean }>(
  guests: T[],
  seatMode: SeatMode | undefined
): { compatible: T[]; incompatible: T[] } {
  const mode = seatMode || 'default';
  
  // Default mode accepts all guests
  if (mode === 'default') {
    return { compatible: guests, incompatible: [] };
  }

  const compatible: T[] = [];
  const incompatible: T[] = [];

  guests.forEach((guest) => {
    if (canGuestSitInSeat(guest.fromHost, mode)) {
      compatible.push(guest);
    } else {
      incompatible.push(guest);
    }
  });

  return { compatible, incompatible };
}