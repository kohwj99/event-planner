// src/utils/violationDetector.ts
import { Table } from '@/types/Table';
import { Seat } from '@/types/Seat';

export interface ProximityViolation {
  type: 'sit-together' | 'sit-away';
  guest1Id: string;
  guest2Id: string;
  guest1Name: string;
  guest2Name: string;
  tableId: string;
  tableLabel: string;
  seat1Id?: string;
  seat2Id?: string;
  reason?: string;
}

export interface ProximityRules {
  sitTogether: Array<{ id: string; guest1Id: string; guest2Id: string }>;
  sitAway: Array<{ id: string; guest1Id: string; guest2Id: string }>;
}

/**
 * Get adjacent seats based on adjacentSeats property
 */
function getAdjacentSeats(seat: Seat, allSeats: Seat[]): Seat[] {
  if (!seat.adjacentSeats || seat.adjacentSeats.length === 0) return [];
  return seat.adjacentSeats
    .map((adjId: string) => allSeats.find((s) => s.id === adjId))
    .filter(Boolean) as Seat[];
}

/**
 * Check if two guests should sit together
 */
function shouldSitTogether(
  guest1Id: string,
  guest2Id: string,
  rules: ProximityRules['sitTogether']
): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

/**
 * Check if two guests should sit away
 */
function shouldSitAway(
  guest1Id: string,
  guest2Id: string,
  rules: ProximityRules['sitAway']
): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

/**
 * Get sit-together partner for a guest
 */
function getSitTogetherPartner(
  guestId: string,
  rules: ProximityRules['sitTogether']
): string | null {
  for (const rule of rules) {
    if (rule.guest1Id === guestId) return rule.guest2Id;
    if (rule.guest2Id === guestId) return rule.guest1Id;
  }
  return null;
}

/**
 * MAIN FUNCTION: Detect all proximity violations in the current seating arrangement
 */
export function detectProximityViolations(
  tables: Table[],
  proximityRules: ProximityRules,
  guestLookup: Record<string, any>
): ProximityViolation[] {
  const violations: ProximityViolation[] = [];

  for (const table of tables) {
    const seats = table.seats || [];

    for (const seat of seats) {
      // Get guest ID (from locked seat or regular assignment)
      const guestId = seat.locked && seat.assignedGuestId
        ? seat.assignedGuestId
        : seat.assignedGuestId;

      if (!guestId) continue;

      const guest = guestLookup[guestId];
      if (!guest) continue;

      // Get adjacent seats
      const adjacentSeats = getAdjacentSeats(seat, seats);

      // Get adjacent guest IDs
      const adjacentGuestIds = adjacentSeats
        .map((s) => {
          if (s.locked && s.assignedGuestId) return s.assignedGuestId;
          return s.assignedGuestId;
        })
        .filter(Boolean) as string[];

      // Check sit-together violations
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner) {
        const partner = guestLookup[togetherPartner];
        if (partner && !adjacentGuestIds.includes(togetherPartner)) {
          // Check if partner is seated at all
          const partnerAssigned = tables.some((t) =>
            t.seats.some((s) => s.assignedGuestId === togetherPartner)
          );

          if (partnerAssigned) {
            // Avoid duplicate violations
            const alreadyReported = violations.some(
              (v) =>
                v.type === 'sit-together' &&
                ((v.guest1Id === guestId && v.guest2Id === togetherPartner) ||
                  (v.guest1Id === togetherPartner && v.guest2Id === guestId))
            );

            if (!alreadyReported) {
              violations.push({
                type: 'sit-together',
                guest1Id: guestId,
                guest2Id: togetherPartner,
                guest1Name: guest.name,
                guest2Name: partner.name,
                tableId: table.id,
                tableLabel: table.label,
                seat1Id: seat.id,
              });
            }
          }
        }
      }

      // Check sit-away violations
      for (const adjGuestId of adjacentGuestIds) {
        if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
          const adjGuest = guestLookup[adjGuestId];
          const adjSeat = seats.find(
            (s) =>
              (s.locked && s.assignedGuestId === adjGuestId) ||
              s.assignedGuestId === adjGuestId
          );

          if (adjGuest && adjSeat) {
            // Avoid duplicate violations
            const alreadyReported = violations.some(
              (v) =>
                v.type === 'sit-away' &&
                ((v.guest1Id === guestId && v.guest2Id === adjGuestId) ||
                  (v.guest1Id === adjGuestId && v.guest2Id === guestId))
            );

            if (!alreadyReported) {
              violations.push({
                type: 'sit-away',
                guest1Id: guestId,
                guest2Id: adjGuestId,
                guest1Name: guest.name,
                guest2Name: adjGuest.name,
                tableId: table.id,
                tableLabel: table.label,
                seat1Id: seat.id,
                seat2Id: adjSeat.id,
              });
            }
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Simulate a swap and detect violations in the hypothetical arrangement
 */
export function detectViolationsAfterSwap(
  tables: Table[],
  table1Id: string,
  seat1Id: string,
  table2Id: string,
  seat2Id: string,
  proximityRules: ProximityRules,
  guestLookup: Record<string, any>
): ProximityViolation[] {
  // Deep clone tables for simulation
  const simulatedTables = JSON.parse(JSON.stringify(tables)) as Table[];

  // Find seats in simulation
  const simTable1 = simulatedTables.find((t) => t.id === table1Id);
  const simTable2 = simulatedTables.find((t) => t.id === table2Id);
  const simSeat1 = simTable1?.seats.find((s) => s.id === seat1Id);
  const simSeat2 = simTable2?.seats.find((s) => s.id === seat2Id);

  if (!simSeat1 || !simSeat2) {
    return [];
  }

  // Perform the swap in simulation
  const tempGuestId = simSeat1.assignedGuestId;
  simSeat1.assignedGuestId = simSeat2.assignedGuestId;
  simSeat2.assignedGuestId = tempGuestId;

  // Detect violations in simulated arrangement
  return detectProximityViolations(simulatedTables, proximityRules, guestLookup);
}

/**
 * Count violations by type
 */
export function countViolations(violations: ProximityViolation[]) {
  const sitTogetherCount = violations.filter((v) => v.type === 'sit-together').length;
  const sitAwayCount = violations.filter((v) => v.type === 'sit-away').length;

  return {
    sitTogether: sitTogetherCount,
    sitAway: sitAwayCount,
    total: sitTogetherCount + sitAwayCount,
  };
}