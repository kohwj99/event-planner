/**
 * Adjacency Helper Functions
 * 
 * Provides utilities for calculating enhanced adjacency for Boss Tracking.
 * For rectangle tables, this includes:
 * - Left/Right neighbors (existing behavior)
 * - Opposite seat (for tracking who sits across from tracked guest)
 * - Edge seats (corner seats when tracked guest is at table edge)
 */

import { Table, RectangleSeatsConfig } from "@/types/Table";
import { Seat } from "@/types/Seat";

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
 * Finds the seat position that is directly opposite to the given seat.
 * Returns null if:
 * - The opposite side has a different number of seats (can't determine direct opposite)
 * - The seat is on a side with no opposite seats
 */
export function getOppositeSeatPosition(
  seatPosition: number,
  config: RectangleSeatsConfig
): number | null {
  const { top, right, bottom, left } = config;
  const side = getSeatSide(seatPosition, config);
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  
  if (indexInSide < 0) return null;
  
  switch (side) {
    case "top":
      // Opposite is bottom side
      if (top !== bottom) return null; // Unequal seats, can't determine opposite
      // Top goes L→R (index 0 = leftmost), Bottom goes R→L (index 0 = rightmost)
      // So top[i] is opposite to bottom[top - 1 - i]
      const bottomStartPos = top + right;
      const oppositeBottomIndex = top - 1 - indexInSide;
      return bottomStartPos + oppositeBottomIndex;
      
    case "bottom":
      // Opposite is top side
      if (top !== bottom) return null;
      // Bottom goes R→L, Top goes L→R
      const oppositeTopIndex = bottom - 1 - indexInSide;
      return oppositeTopIndex;
      
    case "left":
      // Opposite is right side
      if (left !== right) return null;
      // Left goes B→T (index 0 = bottom), Right goes T→B (index 0 = top)
      // So left[i] is opposite to right[left - 1 - i]
      const rightStartPos = top;
      const oppositeRightIndex = left - 1 - indexInSide;
      return rightStartPos + oppositeRightIndex;
      
    case "right":
      // Opposite is left side
      if (left !== right) return null;
      // Right goes T→B, Left goes B→T
      const leftStartPos = top + right + bottom;
      const oppositeLeftIndex = right - 1 - indexInSide;
      return leftStartPos + oppositeLeftIndex;
      
    default:
      return null;
  }
}

/**
 * Checks if a seat is at an edge/corner of the rectangle table.
 * Returns the adjacent corner seats if the seat is at the edge.
 */
export function getEdgeAdjacentSeatPositions(
  seatPosition: number,
  config: RectangleSeatsConfig
): number[] {
  const { top, right, bottom, left } = config;
  const side = getSeatSide(seatPosition, config);
  const indexInSide = getSeatIndexInSide(seatPosition, config);
  const totalSeats = top + right + bottom + left;
  
  const edgeSeats: number[] = [];
  
  // Helper to get seat at specific side and index
  const getSeatAtSideIndex = (targetSide: RectangleSide, targetIndex: number): number | null => {
    const sideCount = {
      top: top,
      right: right,
      bottom: bottom,
      left: left
    }[targetSide];
    
    if (targetIndex < 0 || targetIndex >= sideCount) return null;
    
    const sideStart = {
      top: 0,
      right: top,
      bottom: top + right,
      left: top + right + bottom
    }[targetSide];
    
    return sideStart + targetIndex;
  };
  
  switch (side) {
    case "top":
      // First seat (left edge) - check if left side has seats
      if (indexInSide === 0 && left > 0) {
        edgeSeats.push(getSeatAtSideIndex("left", left - 1)!); // Top of left side
      }
      // Last seat (right edge) - check if right side has seats
      if (indexInSide === top - 1 && right > 0) {
        edgeSeats.push(getSeatAtSideIndex("right", 0)!); // Top of right side
      }
      break;
      
    case "right":
      // First seat (top edge) - check if top side has seats
      if (indexInSide === 0 && top > 0) {
        edgeSeats.push(getSeatAtSideIndex("top", top - 1)!); // Right end of top
      }
      // Last seat (bottom edge) - check if bottom side has seats
      if (indexInSide === right - 1 && bottom > 0) {
        edgeSeats.push(getSeatAtSideIndex("bottom", 0)!); // Right end of bottom
      }
      break;
      
    case "bottom":
      // First seat (right edge) - check if right side has seats
      if (indexInSide === 0 && right > 0) {
        edgeSeats.push(getSeatAtSideIndex("right", right - 1)!); // Bottom of right
      }
      // Last seat (left edge) - check if left side has seats
      if (indexInSide === bottom - 1 && left > 0) {
        edgeSeats.push(getSeatAtSideIndex("left", 0)!); // Bottom of left
      }
      break;
      
    case "left":
      // First seat (bottom edge) - check if bottom side has seats
      if (indexInSide === 0 && bottom > 0) {
        edgeSeats.push(getSeatAtSideIndex("bottom", bottom - 1)!); // Left end of bottom
      }
      // Last seat (top edge) - check if top side has seats
      if (indexInSide === left - 1 && top > 0) {
        edgeSeats.push(getSeatAtSideIndex("top", 0)!); // Left end of top
      }
      break;
  }
  
  return edgeSeats;
}

/**
 * Gets all enhanced adjacent seats for a given seat on a table.
 * For round tables: only returns left/right (existing adjacentSeats)
 * For rectangle tables: returns left/right + opposite + edge adjacencies
 */
export function getEnhancedAdjacentSeats(
  table: Table,
  seatId: string
): EnhancedAdjacency[] {
  const seat = table.seats.find(s => s.id === seatId);
  if (!seat) return [];
  
  const adjacencies: EnhancedAdjacency[] = [];
  
  // Always include existing adjacent seats (left/right neighbors) - these are "side" adjacencies
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
  
  // For rectangle tables, add opposite and edge adjacencies
  if (table.shape === "rectangle" && table.rectangleSeats) {
    const config = table.rectangleSeats;
    const seatPosition = seat.position;
    
    if (seatPosition !== undefined) {
      // Check for opposite seat
      const oppositePosition = getOppositeSeatPosition(seatPosition, config);
      if (oppositePosition !== null) {
        const oppositeSeat = table.seats.find(s => s.position === oppositePosition);
        if (oppositeSeat?.assignedGuestId) {
          // Don't add if already in adjacentSeats (shouldn't happen, but be safe)
          if (!seat.adjacentSeats?.includes(oppositeSeat.id)) {
            adjacencies.push({
              seatId: oppositeSeat.id,
              guestId: oppositeSeat.assignedGuestId,
              adjacencyType: "opposite"
            });
          }
        }
      }
      
      // Check for edge adjacencies
      const edgePositions = getEdgeAdjacentSeatPositions(seatPosition, config);
      edgePositions.forEach(edgePos => {
        const edgeSeat = table.seats.find(s => s.position === edgePos);
        if (edgeSeat?.assignedGuestId) {
          // Don't add if already included
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
  }
  
  return adjacencies;
}

/**
 * Gets all adjacent guest IDs for a given seat (simplified version for basic tracking)
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