// src/utils/swapHelper.ts
import { Table } from '@/types/Table';
import { Seat } from '@/types/Seat';

export interface SwapValidation {
  isValid: boolean;
  reasons: string[];
  canSwap: boolean;
}

export interface ViolationPrediction {
  sitTogetherViolations: number;
  sitAwayViolations: number;
  totalViolations: number;
  details: any[];
}

/**
 * Validate if two seats can be swapped
 */
export function validateSwap(
  seat1: Seat | undefined,
  seat2: Seat | undefined
): SwapValidation {
  const reasons: string[] = [];
  let isValid = true;

  // Check if seats exist
  if (!seat1 || !seat2) {
    reasons.push('One or both seats do not exist');
    isValid = false;
    return { isValid, reasons, canSwap: false };
  }

  // Check if seats are the same
  if (seat1.id === seat2.id) {
    reasons.push('Cannot swap a seat with itself');
    isValid = false;
  }

  // Check if either seat is locked
  if (seat1.locked) {
    reasons.push(`Seat ${seat1.seatNumber} is locked`);
    isValid = false;
  }
  if (seat2.locked) {
    reasons.push(`Seat ${seat2.seatNumber} is locked`);
    isValid = false;
  }

  // Check if both seats have guests
  if (!seat1.assignedGuestId) {
    reasons.push(`Seat ${seat1.seatNumber} is empty`);
    isValid = false;
  }
  if (!seat2.assignedGuestId) {
    reasons.push(`Seat ${seat2.seatNumber} is empty`);
    isValid = false;
  }

  return {
    isValid,
    reasons,
    canSwap: isValid && reasons.length === 0,
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
 * Check if two guests should sit together based on rules
 */
function shouldSitTogether(
  guest1Id: string,
  guest2Id: string,
  sitTogetherRules: any[]
): boolean {
  return sitTogetherRules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
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

  const candidates: any[] = [];

  tables.forEach((table) => {
    table.seats.forEach((seat) => {
      // Skip the source seat
      if (seat.id === sourceSeatId) return;

      // Skip empty seats
      if (!seat.assignedGuestId) return;

      // Validate the swap
      const validation = validateSwap(sourceSeat, seat);

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
          guestId: seat.assignedGuestId,
          guest: guestLookup[seat.assignedGuestId],
          validation,

          // FIX
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