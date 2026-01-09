// src/utils/swapHelper.ts
import { Table } from '@/types/Table';
import { Seat, SeatMode } from '@/types/Seat';
import {
  validateSeatSwap,
  validateGuestSeatAssignment,
  GuestInfo,
  SeatSwapValidation,
} from '@/utils/seatValidation';

export interface SwapValidation {
  isValid: boolean;
  reasons: string[];
  canSwap: boolean;
  seatModeIssues?: {
    guest1CanSitInSeat2: boolean;
    guest2CanSitInSeat1: boolean;
    seat1Mode: SeatMode;
    seat2Mode: SeatMode;
  };
}

export interface ViolationPrediction {
  sitTogetherViolations: number;
  sitAwayViolations: number;
  totalViolations: number;
  details: any[];
}

/**
 * Validate if two seats can be swapped
 * This is a wrapper around the centralized validateSeatSwap function
 * for backward compatibility with existing code
 */
export function validateSwap(
  seat1: Seat | undefined,
  seat2: Seat | undefined,
  guestLookup?: Record<string, any>
): SwapValidation {
  // Basic checks without guest info
  if (!seat1 || !seat2) {
    return {
      isValid: false,
      reasons: ['One or both seats do not exist'],
      canSwap: false,
    };
  }

  if (seat1.id === seat2.id) {
    return {
      isValid: false,
      reasons: ['Cannot swap a seat with itself'],
      canSwap: false,
    };
  }

  const reasons: string[] = [];

  if (seat1.locked) {
    reasons.push(`Seat ${seat1.seatNumber} is locked`);
  }
  if (seat2.locked) {
    reasons.push(`Seat ${seat2.seatNumber} is locked`);
  }
  if (!seat1.assignedGuestId) {
    reasons.push(`Seat ${seat1.seatNumber} is empty`);
  }
  if (!seat2.assignedGuestId) {
    reasons.push(`Seat ${seat2.seatNumber} is empty`);
  }

  if (reasons.length > 0) {
    return {
      isValid: false,
      reasons,
      canSwap: false,
    };
  }

  // Check seat mode compatibility if we have guest information
  if (guestLookup && seat1.assignedGuestId && seat2.assignedGuestId) {
    const guest1 = guestLookup[seat1.assignedGuestId];
    const guest2 = guestLookup[seat2.assignedGuestId];

    const guest1Info: GuestInfo | null = guest1 ? {
      id: seat1.assignedGuestId,
      name: guest1.name,
      fromHost: guest1.fromHost ?? false,
    } : null;

    const guest2Info: GuestInfo | null = guest2 ? {
      id: seat2.assignedGuestId,
      name: guest2.name,
      fromHost: guest2.fromHost ?? false,
    } : null;

    // Use centralized validation
    const validation = validateSeatSwap(seat1, seat2, guest1Info, guest2Info);

    const seat1Mode: SeatMode = seat1.mode || 'default';
    const seat2Mode: SeatMode = seat2.mode || 'default';

    return {
      isValid: validation.canSwap,
      reasons: validation.reasons,
      canSwap: validation.canSwap,
      seatModeIssues: {
        guest1CanSitInSeat2: validation.guest1Validation?.canAssign ?? true,
        guest2CanSitInSeat1: validation.guest2Validation?.canAssign ?? true,
        seat1Mode,
        seat2Mode,
      },
    };
  }

  return {
    isValid: true,
    reasons: [],
    canSwap: true,
  };
}

/**
 * Get adjacent seat IDs for a seat
 */
function getAdjacentSeatIds(seat: Seat, allSeats: Seat[]): string[] {
  if (seat.adjacentSeats && seat.adjacentSeats.length > 0) {
    return seat.adjacentSeats;
  }
  return [];
}

/**
 * Check if two guests should sit away based on rules
 */
function shouldSitAway(
  guest1Id: string,
  guest2Id: string,
  sitAwayRules: any[]
): boolean {
  return sitAwayRules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

/**
 * Predict violations after a hypothetical swap
 */
export function predictViolationsAfterSwap(
  tables: Table[],
  seat1TableId: string,
  seat1Id: string,
  seat2TableId: string,
  seat2Id: string,
  proximityRules: { sitTogether: any[]; sitAway: any[] }
): ViolationPrediction {
  // Create a deep copy of tables for simulation
  const simulatedTables = JSON.parse(JSON.stringify(tables)) as Table[];

  // Find the seats in the simulation
  const table1 = simulatedTables.find((t) => t.id === seat1TableId);
  const table2 = simulatedTables.find((t) => t.id === seat2TableId);
  const simSeat1 = table1?.seats.find((s) => s.id === seat1Id);
  const simSeat2 = table2?.seats.find((s) => s.id === seat2Id);

  if (!simSeat1 || !simSeat2) {
    return {
      sitTogetherViolations: 0,
      sitAwayViolations: 0,
      totalViolations: 0,
      details: [],
    };
  }

  // Perform the swap
  const tempGuestId = simSeat1.assignedGuestId;
  simSeat1.assignedGuestId = simSeat2.assignedGuestId;
  simSeat2.assignedGuestId = tempGuestId;

  // Check violations
  let sitTogetherViolations = 0;
  let sitAwayViolations = 0;
  const details: any[] = [];

  // Check all seats for violations
  simulatedTables.forEach((table) => {
    table.seats.forEach((seat) => {
      if (!seat.assignedGuestId) return;

      const adjacentSeatIds = getAdjacentSeatIds(seat, table.seats);
      const adjacentGuestIds = adjacentSeatIds
        .map((adjId) => {
          const adjSeat = table.seats.find((s) => s.id === adjId);
          return adjSeat?.assignedGuestId;
        })
        .filter(Boolean) as string[];

      // Check sit-together violations
      proximityRules.sitTogether.forEach((rule) => {
        if (rule.guest1Id === seat.assignedGuestId) {
          if (!adjacentGuestIds.includes(rule.guest2Id)) {
            // Check if guest2 is seated at all
            const isGuest2Seated = simulatedTables.some((t) =>
              t.seats.some((s) => s.assignedGuestId === rule.guest2Id)
            );
            if (isGuest2Seated) {
              sitTogetherViolations++;
              details.push({
                type: 'sit-together',
                guest1Id: rule.guest1Id,
                guest2Id: rule.guest2Id,
                tableId: table.id,
                seatId: seat.id,
              });
            }
          }
        }
      });

      // Check sit-away violations
      adjacentGuestIds.forEach((adjGuestId) => {
        if (shouldSitAway(seat.assignedGuestId!, adjGuestId, proximityRules.sitAway)) {
          sitAwayViolations++;
          details.push({
            type: 'sit-away',
            guest1Id: seat.assignedGuestId,
            guest2Id: adjGuestId,
            tableId: table.id,
            seatId: seat.id,
          });
        }
      });
    });
  });

  // Remove duplicate violations (each violation is counted twice)
  sitTogetherViolations = Math.ceil(sitTogetherViolations / 2);
  sitAwayViolations = Math.ceil(sitAwayViolations / 2);

  return {
    sitTogetherViolations,
    sitAwayViolations,
    totalViolations: sitTogetherViolations + sitAwayViolations,
    details,
  };
}

/**
 * Get all valid swap candidates for a seat
 * Uses centralized validation for seat mode checks
 */
export function getSwapCandidates(
  tables: Table[],
  sourceTableId: string,
  sourceSeatId: string,
  guestLookup: Record<string, any>,
  proximityRules: { sitTogether: any[]; sitAway: any[] }
) {
  const sourceTable = tables.find((t) => t.id === sourceTableId);
  const sourceSeat = sourceTable?.seats.find((s) => s.id === sourceSeatId);

  if (!sourceSeat || !sourceSeat.assignedGuestId) {
    return [];
  }

  const sourceGuest = guestLookup[sourceSeat.assignedGuestId];
  const candidates: any[] = [];

  tables.forEach((table) => {
    table.seats.forEach((seat) => {
      // Skip the source seat
      if (seat.id === sourceSeatId) return;

      // Skip empty seats
      if (!seat.assignedGuestId) return;

      const targetGuest = guestLookup[seat.assignedGuestId];

      // Validate the swap including seat mode using centralized validation
      const validation = validateSwap(sourceSeat, seat, guestLookup);

      // Only include candidates that pass validation (including seat mode)
      if (validation.canSwap) {
        // Predict violations
        const prediction = predictViolationsAfterSwap(
          tables,
          sourceTableId,
          sourceSeatId,
          table.id,
          seat.id,
          proximityRules
        );

        candidates.push({
          tableId: table.id,
          tableLabel: table.label,
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          seatMode: seat.mode || 'default',
          guestId: seat.assignedGuestId,
          guest: targetGuest,
          validation,
          violationsAfterSwap: prediction.details,
          violationCount: prediction.totalViolations,
        });
      }
    });
  });

  // Sort by violation count (ascending) - best swaps first
  candidates.sort((a, b) => a.violationCount - b.violationCount);

  return candidates;
}

/**
 * Get incompatible swap candidates (for display purposes)
 * These are candidates that fail ONLY due to seat mode restrictions
 */
export function getIncompatibleSwapCandidates(
  tables: Table[],
  sourceTableId: string,
  sourceSeatId: string,
  guestLookup: Record<string, any>
) {
  const sourceTable = tables.find((t) => t.id === sourceTableId);
  const sourceSeat = sourceTable?.seats.find((s) => s.id === sourceSeatId);

  if (!sourceSeat || !sourceSeat.assignedGuestId) {
    return [];
  }

  const sourceGuest = guestLookup[sourceSeat.assignedGuestId];
  const sourceGuestInfo: GuestInfo = {
    id: sourceSeat.assignedGuestId,
    name: sourceGuest?.name,
    fromHost: sourceGuest?.fromHost ?? false,
  };

  const incompatibleCandidates: any[] = [];

  tables.forEach((table) => {
    table.seats.forEach((seat) => {
      // Skip the source seat
      if (seat.id === sourceSeatId) return;

      // Skip empty seats
      if (!seat.assignedGuestId) return;

      // Skip locked seats
      if (seat.locked || sourceSeat.locked) return;

      const targetGuest = guestLookup[seat.assignedGuestId];
      const targetGuestInfo: GuestInfo = {
        id: seat.assignedGuestId,
        name: targetGuest?.name,
        fromHost: targetGuest?.fromHost ?? false,
      };

      // Use centralized validation to check seat mode compatibility
      const validation = validateSeatSwap(sourceSeat, seat, sourceGuestInfo, targetGuestInfo);

      // Only include if it fails due to seat mode (check if reasons mention seat mode issues)
      if (!validation.canSwap) {
        const hasSeatModeIssue = validation.reasons.some(
          (reason) => 
            reason.includes('cannot be assigned') || 
            reason.includes('cannot sit') ||
            reason.includes('host-only') ||
            reason.includes('external-only')
        );

        if (hasSeatModeIssue) {
          incompatibleCandidates.push({
            tableId: table.id,
            tableLabel: table.label,
            seatId: seat.id,
            seatNumber: seat.seatNumber,
            seatMode: seat.mode || 'default',
            sourceSeatMode: sourceSeat.mode || 'default',
            guestId: seat.assignedGuestId,
            guest: targetGuest,
            seatModeValidation: {
              isCompatible: false,
              guest1CanSitInSeat2: validation.guest1Validation?.canAssign ?? false,
              guest2CanSitInSeat1: validation.guest2Validation?.canAssign ?? false,
              seat1Mode: sourceSeat.mode || 'default',
              seat2Mode: seat.mode || 'default',
              reasons: validation.reasons,
            },
            reasons: validation.reasons,
          });
        }
      }
    });
  });

  return incompatibleCandidates;
}