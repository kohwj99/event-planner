// src/utils/violationDetector.ts - FIXED: Now handles rectangle table opposite and edge adjacencies
import { Table, RectangleSeatsConfig } from '@/types/Table';
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
// RECTANGLE TABLE ADJACENCY HELPERS
// ============================================================================

type RectangleSide = "top" | "bottom" | "left" | "right";

/**
 * Determines which side of a rectangle table a seat is on based on its position index.
 */
function getSeatSide(
  seatPosition: number,
  config: RectangleSeatsConfig
): RectangleSide | null {
  const { top, right, bottom, left } = config;
  
  if (seatPosition < top) {
    return "top";
  } else if (seatPosition < top + right) {
    return "right";
  } else if (seatPosition < top + right + bottom) {
    return "bottom";
  } else if (seatPosition < top + right + bottom + left) {
    return "left";
  }
  
  return null;
}

/**
 * Gets the index of a seat within its side (0-based from start of side)
 */
function getSeatIndexInSide(
  seatPosition: number,
  config: RectangleSeatsConfig
): number {
  const { top, right, bottom } = config;
  const side = getSeatSide(seatPosition, config);
  
  switch (side) {
    case "top":
      return seatPosition;
    case "right":
      return seatPosition - top;
    case "bottom":
      return seatPosition - top - right;
    case "left":
      return seatPosition - top - right - bottom;
    default:
      return -1;
  }
}

/**
 * Finds the seat position that is directly opposite to the given seat.
 * Returns null if the opposite side has a different number of seats.
 */
function getOppositeSeatPosition(
  seatPosition: number,
  config: RectangleSeatsConfig
): number | null {
  const { top, right, bottom, left } = config;
  const side = getSeatSide(seatPosition, config);
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  
  if (indexInSide < 0 || side === null) return null;
  
  switch (side) {
    case "top":
      if (top !== bottom) return null;
      const bottomStartPos = top + right;
      const oppositeBottomIndex = top - 1 - indexInSide;
      return bottomStartPos + oppositeBottomIndex;
      
    case "bottom":
      if (top !== bottom) return null;
      const oppositeTopIndex = bottom - 1 - indexInSide;
      return oppositeTopIndex;
      
    case "left":
      if (left !== right) return null;
      const rightStartPos = top;
      const oppositeRightIndex = left - 1 - indexInSide;
      return rightStartPos + oppositeRightIndex;
      
    case "right":
      if (left !== right) return null;
      const leftStartPos = top + right + bottom;
      const oppositeLeftIndex = right - 1 - indexInSide;
      return leftStartPos + oppositeLeftIndex;
      
    default:
      return null;
  }
}

/**
 * Gets edge/corner adjacent seats for corner seats on rectangle tables.
 */
function getEdgeAdjacentPositions(
  seatPosition: number,
  config: RectangleSeatsConfig
): number[] {
  const { top, right, bottom, left } = config;
  const side = getSeatSide(seatPosition, config);
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  
  if (!side) return [];
  
  const edgeSeats: number[] = [];
  
  switch (side) {
    case "top":
      if (indexInSide === 0 && left > 0) {
        edgeSeats.push(top + right + bottom + left - 1);
      }
      if (indexInSide === top - 1 && right > 0) {
        edgeSeats.push(top);
      }
      break;
      
    case "right":
      if (indexInSide === 0 && top > 0) {
        edgeSeats.push(top - 1);
      }
      if (indexInSide === right - 1 && bottom > 0) {
        edgeSeats.push(top + right);
      }
      break;
      
    case "bottom":
      if (indexInSide === 0 && right > 0) {
        edgeSeats.push(top + right - 1);
      }
      if (indexInSide === bottom - 1 && left > 0) {
        edgeSeats.push(top + right + bottom);
      }
      break;
      
    case "left":
      if (indexInSide === 0 && bottom > 0) {
        edgeSeats.push(top + right + bottom - 1);
      }
      if (indexInSide === left - 1 && top > 0) {
        edgeSeats.push(0);
      }
      break;
  }
  
  return edgeSeats;
}

/**
 * Gets the count of seats on a given side
 */
function getSideCount(side: RectangleSide, config: RectangleSeatsConfig): number {
  return config[side];
}

/**
 * Gets the starting position index for a given side
 */
function getSideStartPosition(side: RectangleSide, config: RectangleSeatsConfig): number {
  const { top, right, bottom } = config;
  switch (side) {
    case "top": return 0;
    case "right": return top;
    case "bottom": return top + right;
    case "left": return top + right + bottom;
    default: return 0;
  }
}

/**
 * Gets the same-side neighbors for a seat (respecting side boundaries)
 */
function getSameSideNeighbors(
  seatPosition: number,
  config: RectangleSeatsConfig
): number[] {
  const side = getSeatSide(seatPosition, config);
  if (!side) return [];
  
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  const sideCount = getSideCount(side, config);
  const sideStart = getSideStartPosition(side, config);
  
  const neighbors: number[] = [];
  
  if (indexInSide > 0) {
    neighbors.push(sideStart + indexInSide - 1);
  }
  
  if (indexInSide < sideCount - 1) {
    neighbors.push(sideStart + indexInSide + 1);
  }
  
  return neighbors;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all adjacent seat IDs for a given seat, including enhanced adjacency for rectangle tables.
 * 
 * For round tables: Uses seat.adjacentSeats (left/right neighbors)
 * For rectangle tables: Computes same-side neighbors + opposite seat + edge adjacencies
 */
function getAllAdjacentSeatIds(seat: Seat, table: Table): string[] {
  const adjacentIds = new Set<string>();
  
  // First, add the standard adjacentSeats (this should already include enhanced adjacency
  // if generateTable was updated, but we compute it here as a fallback/verification)
  if (seat.adjacentSeats) {
    seat.adjacentSeats.forEach(id => adjacentIds.add(id));
  }
  
  // For rectangle tables, ensure we include opposite and edge adjacencies
  if (table.shape === "rectangle" && table.rectangleSeats && seat.position !== undefined) {
    const config = table.rectangleSeats;
    const seatPosition = seat.position;
    
    // Add same-side neighbors
    const sideNeighbors = getSameSideNeighbors(seatPosition, config);
    sideNeighbors.forEach(pos => {
      const neighborSeat = table.seats.find(s => s.position === pos);
      if (neighborSeat) {
        adjacentIds.add(neighborSeat.id);
      }
    });
    
    // Add opposite seat
    const oppositePosition = getOppositeSeatPosition(seatPosition, config);
    if (oppositePosition !== null) {
      const oppositeSeat = table.seats.find(s => s.position === oppositePosition);
      if (oppositeSeat) {
        adjacentIds.add(oppositeSeat.id);
      }
    }
    
    // Add edge adjacencies
    const edgePositions = getEdgeAdjacentPositions(seatPosition, config);
    edgePositions.forEach(pos => {
      const edgeSeat = table.seats.find(s => s.position === pos);
      if (edgeSeat) {
        adjacentIds.add(edgeSeat.id);
      }
    });
  }
  
  return Array.from(adjacentIds);
}

/**
 * Get adjacent seats as Seat objects
 */
function getAdjacentSeats(seat: Seat, table: Table): Seat[] {
  const adjacentIds = getAllAdjacentSeatIds(seat, table);
  return adjacentIds
    .map(adjId => table.seats.find(s => s.id === adjId))
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
 * Get ALL sit-together partners for a guest
 */
function getAllSitTogetherPartners(
  guestId: string,
  rules: ProximityRules['sitTogether']
): string[] {
  const partners: string[] = [];
  for (const rule of rules) {
    if (rule.guest1Id === guestId && !partners.includes(rule.guest2Id)) {
      partners.push(rule.guest2Id);
    }
    if (rule.guest2Id === guestId && !partners.includes(rule.guest1Id)) {
      partners.push(rule.guest1Id);
    }
  }
  return partners;
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

/**
 * Check if two seats are adjacent on a table (used for quick adjacency checks)
 */
function areSeatsAdjacent(seat1: Seat, seat2: Seat, table: Table): boolean {
  const adjacentIds = getAllAdjacentSeatIds(seat1, table);
  return adjacentIds.includes(seat2.id);
}

// ============================================================================
// MAIN VIOLATION DETECTION
// ============================================================================

/**
 * PRIMARY FUNCTION: Detect all proximity violations in the current seating arrangement
 * 
 * FIXED: Now properly checks all adjacency types for rectangle tables including:
 * - Same-side neighbors
 * - Opposite seats (when opposite side has same seat count)
 * - Edge/corner adjacencies
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

      // FIXED: Get adjacent seats using enhanced adjacency for rectangle tables
      const adjacentSeats = getAdjacentSeats(seat, table);

      // Get adjacent guest IDs (handles locked seats)
      const adjacentGuestIds = adjacentSeats
        .map((s) => s.assignedGuestId)
        .filter(Boolean) as string[];

      // ===================================================================
      // CHECK SIT-TOGETHER VIOLATIONS
      // ===================================================================
      const togetherPartners = getAllSitTogetherPartners(guestId, proximityRules.sitTogether);
      
      for (const partnerId of togetherPartners) {
        const partner = guestLookup[partnerId];
        
        // Check if partner is NOT adjacent (including opposite seats for rectangle tables)
        if (partner && !adjacentGuestIds.includes(partnerId)) {
          // Verify partner is seated somewhere (not just absent from guest list)
          const partnerIsSeated = tables.some((t) =>
            t.seats.some((s) => s.assignedGuestId === partnerId)
          );

          if (partnerIsSeated) {
            // Avoid duplicate violations (A-B and B-A)
            if (!isDuplicateViolation(violations, 'sit-together', guestId, partnerId)) {
              violations.push({
                type: 'sit-together',
                guest1Id: guestId,
                guest2Id: partnerId,
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
      // CHECK SIT-AWAY VIOLATIONS (including opposite seats for rectangle tables)
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
 * FIXED: Deep cloning now preserves table shape and rectangleSeats config
 * for proper adjacency calculation after swap.
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
  // Deep clone tables for simulation (preserves shape and rectangleSeats)
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

  // Detect violations in simulated arrangement (now properly handles rectangle tables)
  return detectProximityViolations(simulatedTables, proximityRules, guestLookup);
}

// ============================================================================
// SEAT ASSIGNMENT SIMULATION
// ============================================================================

/**
 * Simulate assigning a guest to a seat and detect resulting violations.
 * 
 * FIXED: Properly accounts for opposite and edge adjacencies on rectangle tables.
 * 
 * @param tables - All tables
 * @param tableId - Target table ID
 * @param seatId - Target seat ID
 * @param guestId - Guest to assign
 * @param proximityRules - Proximity rules
 * @param guestLookup - Guest lookup map
 * @returns Array of violations that would exist after the assignment
 */
export function detectViolationsAfterAssignment(
  tables: Table[],
  tableId: string,
  seatId: string,
  guestId: string,
  proximityRules: ProximityRules,
  guestLookup: Record<string, any>
): ProximityViolation[] {
  // Deep clone tables for simulation
  const simulatedTables = JSON.parse(JSON.stringify(tables)) as Table[];

  // Find table and seat in simulation
  const simTable = simulatedTables.find((t) => t.id === tableId);
  const simSeat = simTable?.seats.find((s) => s.id === seatId);

  if (!simTable || !simSeat) {
    console.warn('Assignment simulation failed: table or seat not found');
    return [];
  }

  // Perform the assignment in simulation
  simSeat.assignedGuestId = guestId;

  // Detect violations in simulated arrangement
  return detectProximityViolations(simulatedTables, proximityRules, guestLookup);
}

// ============================================================================
// QUICK ADJACENCY CHECK
// ============================================================================

/**
 * Quick check if two guests would be adjacent if placed in specific seats.
 * Useful for pre-validation before assignments.
 * 
 * FIXED: Properly handles rectangle table adjacency including opposite seats.
 */
export function wouldBeAdjacent(
  table: Table,
  seat1Id: string,
  seat2Id: string
): boolean {
  const seat1 = table.seats.find(s => s.id === seat1Id);
  const seat2 = table.seats.find(s => s.id === seat2Id);
  
  if (!seat1 || !seat2) return false;
  
  return areSeatsAdjacent(seat1, seat2, table);
}

/**
 * Get all seat IDs that are adjacent to a given seat (for UI highlighting, etc.)
 * 
 * FIXED: Returns enhanced adjacency for rectangle tables.
 */
export function getAdjacentSeatIds(table: Table, seatId: string): string[] {
  const seat = table.seats.find(s => s.id === seatId);
  if (!seat) return [];
  
  return getAllAdjacentSeatIds(seat, table);
}

// ============================================================================
// VIOLATION COUNTING & ANALYSIS
// ============================================================================

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

/**
 * Get violations grouped by table
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
 * FIXED: Now properly validates against rectangle table adjacency.
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

  // Detect violations (now properly handles rectangle table adjacency)
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