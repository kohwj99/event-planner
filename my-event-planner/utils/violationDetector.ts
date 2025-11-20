// src/utils/violationDetector.ts - STREAMLINED & COMPREHENSIVE
import { Table } from '@/types/Table';
import { Seat } from '@/types/Seat';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Check if two guests should sit together based on rules
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
 * Check if two guests should sit away based on rules
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
 * Check if a violation has already been reported (to avoid duplicates)
 */
function isDuplicateViolation(
  violations: ProximityViolation[],
  type: 'sit-together' | 'sit-away',
  guest1Id: string,
  guest2Id: string
): boolean {
  return violations.some(
    (v) =>
      v.type === type &&
      ((v.guest1Id === guest1Id && v.guest2Id === guest2Id) ||
        (v.guest1Id === guest2Id && v.guest2Id === guest1Id))
  );
}

// ============================================================================
// MAIN VIOLATION DETECTION
// ============================================================================

/**
 * PRIMARY FUNCTION: Detect all proximity violations in the current seating arrangement
 * 
 * This function:
 * 1. Checks sit-together violations (guests who should be adjacent but aren't)
 * 2. Checks sit-away violations (guests who shouldn't be adjacent but are)
 * 3. Handles both locked and unlocked seats
 * 4. Avoids duplicate violation reporting
 * 
 * @param tables - All tables with their current seating
 * @param proximityRules - Sit-together and sit-away rules
 * @param guestLookup - Map of guest IDs to guest objects
 * @returns Array of all violations found
 */
export function detectProximityViolations(
  tables: Table[],
  proximityRules: ProximityRules,
  guestLookup: Record<string, any>
): ProximityViolation[] {
  const violations: ProximityViolation[] = [];

  // Iterate through all tables and seats
  for (const table of tables) {
    const seats = table.seats || [];

    for (const seat of seats) {
      // Get guest ID (handles both locked and unlocked seats)
      const guestId = seat.assignedGuestId;
      if (!guestId) continue;

      const guest = guestLookup[guestId];
      if (!guest) continue;

      // Get adjacent seats
      const adjacentSeats = getAdjacentSeats(seat, seats);

      // Get adjacent guest IDs (handles locked seats)
      const adjacentGuestIds = adjacentSeats
        .map((s) => s.assignedGuestId)
        .filter(Boolean) as string[];

      // ===================================================================
      // CHECK SIT-TOGETHER VIOLATIONS
      // ===================================================================
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      
      if (togetherPartner) {
        const partner = guestLookup[togetherPartner];
        
        // Check if partner is NOT adjacent
        if (partner && !adjacentGuestIds.includes(togetherPartner)) {
          // Verify partner is seated somewhere (not just absent from guest list)
          const partnerIsSeated = tables.some((t) =>
            t.seats.some((s) => s.assignedGuestId === togetherPartner)
          );

          if (partnerIsSeated) {
            // Avoid duplicate violations (A-B and B-A)
            if (!isDuplicateViolation(violations, 'sit-together', guestId, togetherPartner)) {
              violations.push({
                type: 'sit-together',
                guest1Id: guestId,
                guest2Id: togetherPartner,
                guest1Name: guest.name,
                guest2Name: partner.name,
                tableId: table.id,
                tableLabel: table.label,
                seat1Id: seat.id,
                reason: `${guest.name} and ${partner.name} should sit together but are not adjacent`,
              });
            }
          }
        }
      }

      // ===================================================================
      // CHECK SIT-AWAY VIOLATIONS
      // ===================================================================
      for (const adjGuestId of adjacentGuestIds) {
        if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
          const adjGuest = guestLookup[adjGuestId];
          const adjSeat = seats.find((s) => s.assignedGuestId === adjGuestId);

          if (adjGuest && adjSeat) {
            // Avoid duplicate violations (A-B and B-A)
            if (!isDuplicateViolation(violations, 'sit-away', guestId, adjGuestId)) {
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
                reason: `${guest.name} and ${adjGuest.name} should not sit together but are adjacent`,
              });
            }
          }
        }
      }
    }
  }

  return violations;
}

// ============================================================================
// SWAP SIMULATION
// ============================================================================

/**
 * Simulate a seat swap and detect violations in the hypothetical arrangement
 * 
 * Used by the swap modal to predict violations before actually performing a swap
 * 
 * @param tables - All tables
 * @param table1Id - First table ID
 * @param seat1Id - First seat ID
 * @param table2Id - Second table ID
 * @param seat2Id - Second seat ID
 * @param proximityRules - Proximity rules
 * @param guestLookup - Guest lookup map
 * @returns Array of violations that would exist after the swap
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
    console.warn('Swap simulation failed: seats not found');
    return [];
  }

  // Perform the swap in simulation
  const tempGuestId = simSeat1.assignedGuestId;
  simSeat1.assignedGuestId = simSeat2.assignedGuestId;
  simSeat2.assignedGuestId = tempGuestId;

  // Detect violations in simulated arrangement
  return detectProximityViolations(simulatedTables, proximityRules, guestLookup);
}

// ============================================================================
// VIOLATION COUNTING & ANALYSIS
// ============================================================================

/**
 * Count violations by type
 * 
 * @param violations - Array of violations
 * @returns Object with counts by type and total
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

/**
 * Get violations grouped by table
 * 
 * Useful for displaying table-specific violation information
 * 
 * @param violations - Array of violations
 * @returns Map of table IDs to their violations
 */
export function getViolationsByTable(
  violations: ProximityViolation[]
): Map<string, ProximityViolation[]> {
  const byTable = new Map<string, ProximityViolation[]>();

  for (const violation of violations) {
    const tableViolations = byTable.get(violation.tableId) || [];
    tableViolations.push(violation);
    byTable.set(violation.tableId, tableViolations);
  }

  return byTable;
}

/**
 * Get violations for a specific guest
 * 
 * Useful for showing a guest's specific proximity issues
 * 
 * @param violations - Array of violations
 * @param guestId - Guest ID to filter by
 * @returns Array of violations involving this guest
 */
export function getViolationsForGuest(
  violations: ProximityViolation[],
  guestId: string
): ProximityViolation[] {
  return violations.filter(
    (v) => v.guest1Id === guestId || v.guest2Id === guestId
  );
}

/**
 * Check if a specific seating arrangement would create violations
 * 
 * Used to validate manual seat assignments
 * 
 * @param tableId - Table ID
 * @param seatId - Seat ID
 * @param guestId - Guest to assign
 * @param tables - All tables
 * @param proximityRules - Proximity rules
 * @param guestLookup - Guest lookup map
 * @returns Object indicating if assignment is valid and why
 */
export function validateSeatAssignment(
  tableId: string,
  seatId: string,
  guestId: string,
  tables: Table[],
  proximityRules: ProximityRules,
  guestLookup: Record<string, any>
): {
  isValid: boolean;
  warnings: string[];
  violations: ProximityViolation[];
} {
  // Simulate the assignment
  const simulatedTables = JSON.parse(JSON.stringify(tables)) as Table[];
  const simTable = simulatedTables.find((t) => t.id === tableId);
  const simSeat = simTable?.seats.find((s) => s.id === seatId);

  if (!simTable || !simSeat) {
    return {
      isValid: false,
      warnings: ['Table or seat not found'],
      violations: [],
    };
  }

  // Store original guest ID
  const originalGuestId = simSeat.assignedGuestId;

  // Apply the assignment
  simSeat.assignedGuestId = guestId;

  // Detect violations
  const violations = detectProximityViolations(
    simulatedTables,
    proximityRules,
    guestLookup
  );

  // Get violations involving this guest
  const guestViolations = getViolationsForGuest(violations, guestId);

  // Restore original state
  simSeat.assignedGuestId = originalGuestId;

  const warnings: string[] = [];
  
  if (guestViolations.length > 0) {
    guestViolations.forEach((v) => {
      warnings.push(v.reason || 'Proximity rule violation');
    });
  }

  return {
    isValid: guestViolations.length === 0,
    warnings,
    violations: guestViolations,
  };
}