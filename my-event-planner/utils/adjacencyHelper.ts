/**
 * Adjacency Helper Functions
 * 
 * FIXED: Properly handles rectangle table adjacency including:
 * - Same-side neighbors (seats immediately beside on the same edge)
 * - Opposite seats (for sides with matching seat counts)  
 * - Edge/corner adjacencies (for corner seats connecting to perpendicular sides)
 * 
 * Adjacency rules for rectangle tables:
 * 
 * NON-EDGE SEATS:
 * - Adjacent to seats directly beside on the same side
 * - Adjacent to the seat directly opposite (if opposite side has same seat count)
 * 
 * EDGE SEATS (corner positions):
 * - Adjacent to the seat beside on the same side
 * - Adjacent to the opposite seat (if opposite side has same seat count)
 * - Adjacent to the nearest seat on the perpendicular side at the corner
 */

import { Table, RectangleSeatsConfig } from "@/types/Table";
import { Seat } from "@/types/Seat";

// ============================================================================
// EXPORTED TYPES
// ============================================================================

/**
 * Which side of a rectangle table a seat is on
 */
export type RectangleSide = "top" | "bottom" | "left" | "right";

/**
 * Type of adjacency relationship
 */
export type AdjacencyType = "side" | "opposite" | "edge";

/**
 * Enhanced adjacency information
 */
export interface EnhancedAdjacency {
  seatId: string;
  guestId: string;
  adjacencyType: AdjacencyType;
}

// ============================================================================
// SIDE DETECTION HELPERS
// ============================================================================

/**
 * Determines which side of a rectangle table a seat is on based on its position index.
 * Seats are arranged: top (L→R), right (T→B), bottom (R→L), left (B→T)
 */
export function getSeatSide(
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
export function getSeatIndexInSide(
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
 * Gets the count of seats on a given side
 */
export function getSideCount(side: RectangleSide, config: RectangleSeatsConfig): number {
  return config[side];
}

/**
 * Gets the starting position index for a given side
 */
export function getSideStartPosition(side: RectangleSide, config: RectangleSeatsConfig): number {
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
 * Gets the opposite side for a given side
 */
export function getOppositeSide(side: RectangleSide): RectangleSide {
  switch (side) {
    case "top": return "bottom";
    case "bottom": return "top";
    case "left": return "right";
    case "right": return "left";
  }
}

/**
 * Checks if a seat is at an edge/corner of its side
 */
export function isEdgeSeat(
  seatPosition: number,
  config: RectangleSeatsConfig
): { isFirstOnSide: boolean; isLastOnSide: boolean } {
  const side = getSeatSide(seatPosition, config);
  if (!side) return { isFirstOnSide: false, isLastOnSide: false };
  
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  const sideCount = getSideCount(side, config);
  
  return {
    isFirstOnSide: indexInSide === 0,
    isLastOnSide: indexInSide === sideCount - 1,
  };
}

// ============================================================================
// SAME-SIDE NEIGHBOR CALCULATION
// ============================================================================

/**
 * Gets the same-side neighbors for a seat (the seats immediately to the left and right
 * on the SAME side of the rectangle table).
 * 
 * Unlike circular wrapping, this respects side boundaries:
 * - First seat on a side only has one neighbor on that side (the next seat)
 * - Last seat on a side only has one neighbor on that side (the previous seat)
 * - Middle seats have two neighbors on the same side
 */
export function getSameSideNeighborPositions(
  seatPosition: number,
  config: RectangleSeatsConfig
): number[] {
  const side = getSeatSide(seatPosition, config);
  if (!side) return [];
  
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  const sideCount = getSideCount(side, config);
  const sideStart = getSideStartPosition(side, config);
  
  const neighbors: number[] = [];
  
  // Previous seat on same side (if not first seat)
  if (indexInSide > 0) {
    neighbors.push(sideStart + indexInSide - 1);
  }
  
  // Next seat on same side (if not last seat)
  if (indexInSide < sideCount - 1) {
    neighbors.push(sideStart + indexInSide + 1);
  }
  
  return neighbors;
}

// ============================================================================
// OPPOSITE SEAT CALCULATION
// ============================================================================

/**
 * Finds the seat position that is directly opposite to the given seat.
 * Returns null if:
 * - The opposite side has a different number of seats (can't determine direct opposite)
 * - The seat is on a side with no opposite seats
 * 
 * IMPORTANT: This implements the key adjacency rule for rectangle tables.
 * The opposite seat calculation accounts for the fact that seats are arranged
 * in different directions on opposite sides:
 * - Top goes L→R (index 0 = leftmost)
 * - Bottom goes R→L (index 0 = rightmost)
 * - Right goes T→B (index 0 = topmost)
 * - Left goes B→T (index 0 = bottommost)
 * 
 * So for a seat at top[i], the opposite is at bottom[top - 1 - i]
 */
export function getOppositeSeatPosition(
  seatPosition: number,
  config: RectangleSeatsConfig
): number | null {
  const { top, right, bottom, left } = config;
  const side = getSeatSide(seatPosition, config);
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  
  if (indexInSide < 0 || side === null) return null;
  
  switch (side) {
    case "top":
      // Opposite is bottom side - only if they have same count
      if (top !== bottom) return null;
      // Top goes L→R (index 0 = leftmost), Bottom goes R→L (index 0 = rightmost)
      // So top[i] is opposite to bottom[top - 1 - i]
      const bottomStartPos = top + right;
      const oppositeBottomIndex = top - 1 - indexInSide;
      return bottomStartPos + oppositeBottomIndex;
      
    case "bottom":
      // Opposite is top side - only if they have same count
      if (top !== bottom) return null;
      // Bottom goes R→L, Top goes L→R
      const oppositeTopIndex = bottom - 1 - indexInSide;
      return oppositeTopIndex;
      
    case "left":
      // Opposite is right side - only if they have same count
      if (left !== right) return null;
      // Left goes B→T (index 0 = bottom), Right goes T→B (index 0 = top)
      // So left[i] is opposite to right[left - 1 - i]
      const rightStartPos = top;
      const oppositeRightIndex = left - 1 - indexInSide;
      return rightStartPos + oppositeRightIndex;
      
    case "right":
      // Opposite is left side - only if they have same count
      if (left !== right) return null;
      // Right goes T→B, Left goes B→T
      const leftStartPos = top + right + bottom;
      const oppositeLeftIndex = right - 1 - indexInSide;
      return leftStartPos + oppositeLeftIndex;
      
    default:
      return null;
  }
}

// ============================================================================
// EDGE/CORNER ADJACENCY CALCULATION
// ============================================================================

/**
 * Gets edge/corner adjacent seat positions for seats at the corners of a rectangle table.
 * 
 * When a seat is at a corner (first or last seat on a side), it's adjacent to
 * the nearest seat on the perpendicular side at that corner.
 * 
 * Corner connections:
 * - Top-left corner: First seat of top ↔ Last seat of left
 * - Top-right corner: Last seat of top ↔ First seat of right
 * - Bottom-right corner: First seat of bottom ↔ Last seat of right
 * - Bottom-left corner: Last seat of bottom ↔ First seat of left
 */
export function getEdgeAdjacentSeatPositions(
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
      // First seat on top (left corner) - connects to last seat of left side
      if (indexInSide === 0 && left > 0) {
        edgeSeats.push(top + right + bottom + left - 1); // Last seat of left side
      }
      // Last seat on top (right corner) - connects to first seat of right side
      if (indexInSide === top - 1 && right > 0) {
        edgeSeats.push(top); // First seat of right side
      }
      break;
      
    case "right":
      // First seat on right (top corner) - connects to last seat of top side
      if (indexInSide === 0 && top > 0) {
        edgeSeats.push(top - 1); // Last seat of top side
      }
      // Last seat on right (bottom corner) - connects to first seat of bottom side
      if (indexInSide === right - 1 && bottom > 0) {
        edgeSeats.push(top + right); // First seat of bottom side
      }
      break;
      
    case "bottom":
      // First seat on bottom (right corner) - connects to last seat of right side
      if (indexInSide === 0 && right > 0) {
        edgeSeats.push(top + right - 1); // Last seat of right side
      }
      // Last seat on bottom (left corner) - connects to first seat of left side
      if (indexInSide === bottom - 1 && left > 0) {
        edgeSeats.push(top + right + bottom); // First seat of left side
      }
      break;
      
    case "left":
      // First seat on left (bottom corner) - connects to last seat of bottom side
      if (indexInSide === 0 && bottom > 0) {
        edgeSeats.push(top + right + bottom - 1); // Last seat of bottom side
      }
      // Last seat on left (top corner) - connects to first seat of top side
      if (indexInSide === left - 1 && top > 0) {
        edgeSeats.push(0); // First seat of top side
      }
      break;
  }
  
  return edgeSeats;
}

// ============================================================================
// COMPLETE ADJACENCY CALCULATION
// ============================================================================

/**
 * Computes all adjacent seat positions for a given seat on a rectangle table.
 * 
 * This combines all three types of adjacency:
 * 1. Same-side neighbors (seats immediately beside on the same edge)
 * 2. Opposite seat (if opposite side has the same number of seats)
 * 3. Edge/corner adjacencies (for corner seats, the adjacent seat on the perpendicular side)
 */
export function computeAllAdjacentPositions(
  seatPosition: number,
  config: RectangleSeatsConfig
): number[] {
  const adjacentPositions = new Set<number>();
  
  // 1. Add same-side neighbors
  const sideNeighbors = getSameSideNeighborPositions(seatPosition, config);
  sideNeighbors.forEach(pos => adjacentPositions.add(pos));
  
  // 2. Add opposite seat (if applicable)
  const oppositePosition = getOppositeSeatPosition(seatPosition, config);
  if (oppositePosition !== null) {
    adjacentPositions.add(oppositePosition);
  }
  
  // 3. Add edge/corner adjacencies
  const edgePositions = getEdgeAdjacentSeatPositions(seatPosition, config);
  edgePositions.forEach(pos => adjacentPositions.add(pos));
  
  return Array.from(adjacentPositions).sort((a, b) => a - b);
}

// ============================================================================
// ENHANCED ADJACENCY WITH GUEST INFORMATION
// ============================================================================

/**
 * Gets all enhanced adjacent seats for a given seat on a table.
 * 
 * For round tables: Returns left/right neighbors with "side" type
 * For rectangle tables: Returns side neighbors + opposite + edge adjacencies
 * 
 * Each adjacency includes the type (side, opposite, edge) for tracking purposes.
 */
export function getEnhancedAdjacentSeats(
  table: Table,
  seatId: string
): EnhancedAdjacency[] {
  const seat = table.seats.find(s => s.id === seatId);
  if (!seat) return [];
  
  const adjacencies: EnhancedAdjacency[] = [];
  
  if (table.shape === "round") {
    // For round tables, use the stored adjacentSeats (left/right neighbors)
    if (seat.adjacentSeats) {
      seat.adjacentSeats.forEach(adjSeatId => {
        const adjSeat = table.seats.find(s => s.id === adjSeatId);
        if (adjSeat?.assignedGuestId) {
          adjacencies.push({
            seatId: adjSeatId,
            guestId: adjSeat.assignedGuestId,
            adjacencyType: "side"
          });
        }
      });
    }
  } else if (table.shape === "rectangle" && table.rectangleSeats && seat.position !== undefined) {
    const config = table.rectangleSeats;
    const seatPosition = seat.position;
    
    // 1. Add same-side neighbors as "side" adjacency
    const sideNeighbors = getSameSideNeighborPositions(seatPosition, config);
    sideNeighbors.forEach(pos => {
      const neighborSeat = table.seats.find(s => s.position === pos);
      if (neighborSeat?.assignedGuestId) {
        adjacencies.push({
          seatId: neighborSeat.id,
          guestId: neighborSeat.assignedGuestId,
          adjacencyType: "side"
        });
      }
    });
    
    // 2. Add opposite seat as "opposite" adjacency
    const oppositePosition = getOppositeSeatPosition(seatPosition, config);
    if (oppositePosition !== null) {
      const oppositeSeat = table.seats.find(s => s.position === oppositePosition);
      if (oppositeSeat?.assignedGuestId) {
        adjacencies.push({
          seatId: oppositeSeat.id,
          guestId: oppositeSeat.assignedGuestId,
          adjacencyType: "opposite"
        });
      }
    }
    
    // 3. Add edge/corner adjacencies as "edge" adjacency
    const edgePositions = getEdgeAdjacentSeatPositions(seatPosition, config);
    edgePositions.forEach(edgePos => {
      const edgeSeat = table.seats.find(s => s.position === edgePos);
      if (edgeSeat?.assignedGuestId) {
        // Check not already included (shouldn't happen, but be safe)
        const alreadyIncluded = adjacencies.some(a => a.seatId === edgeSeat.id);
        if (!alreadyIncluded) {
          adjacencies.push({
            seatId: edgeSeat.id,
            guestId: edgeSeat.assignedGuestId,
            adjacencyType: "edge"
          });
        }
      }
    });
  }
  
  return adjacencies;
}

/**
 * Gets all adjacent guest IDs for a given seat (simplified version)
 * Returns unique guest IDs from all adjacency types
 */
export function getAllAdjacentGuestIds(
  table: Table,
  seatId: string
): string[] {
  const adjacencies = getEnhancedAdjacentSeats(table, seatId);
  const uniqueGuestIds = [...new Set(adjacencies.map(a => a.guestId))];
  return uniqueGuestIds;
}

/**
 * Gets adjacent guest IDs grouped by adjacency type
 */
export function getAdjacentGuestIdsByType(
  table: Table,
  seatId: string
): Record<AdjacencyType, string[]> {
  const adjacencies = getEnhancedAdjacentSeats(table, seatId);
  
  return {
    side: adjacencies.filter(a => a.adjacencyType === "side").map(a => a.guestId),
    opposite: adjacencies.filter(a => a.adjacencyType === "opposite").map(a => a.guestId),
    edge: adjacencies.filter(a => a.adjacencyType === "edge").map(a => a.guestId),
  };
}

/**
 * Gets all adjacent seat IDs for a given seat (regardless of whether occupied)
 * Useful for highlighting adjacent seats in the UI
 */
export function getAllAdjacentSeatIds(
  table: Table,
  seatId: string
): string[] {
  const seat = table.seats.find(s => s.id === seatId);
  if (!seat) return [];
  
  if (table.shape === "round") {
    return seat.adjacentSeats || [];
  }
  
  if (table.shape === "rectangle" && table.rectangleSeats && seat.position !== undefined) {
    const config = table.rectangleSeats;
    const adjacentPositions = computeAllAdjacentPositions(seat.position, config);
    return adjacentPositions
      .map(pos => table.seats.find(s => s.position === pos)?.id)
      .filter(Boolean) as string[];
  }
  
  return seat.adjacentSeats || [];
}

/**
 * Checks if two seats are adjacent on a table
 */
export function areSeatsAdjacent(
  table: Table,
  seat1Id: string,
  seat2Id: string
): boolean {
  const adjacentIds = getAllAdjacentSeatIds(table, seat1Id);
  return adjacentIds.includes(seat2Id);
}