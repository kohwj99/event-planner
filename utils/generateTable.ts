// utils/generateTable.ts - FIXED: Rectangle tables now include opposite and edge adjacencies
import { Table, RectangleSeatsConfig } from "@/types/Table";
import { Seat, SeatMode } from "@/types/Seat";

/**
 * Create a round table with custom seat ordering, adjacency tracking, and seat modes
 */
export function createRoundTable(
  id: string,
  centerX: number,
  centerY: number,
  radius: number,
  seatCount: number,
  label: string,
  seatOrdering?: number[], // Custom seat numbering
  seatModes?: SeatMode[] // Custom seat modes
): Table {
  const seats: Seat[] = [];
  const seatRadius = 12;
  
  // Scale table radius based on seat count
  const baseRadius = 60;
  const scaledRadius = Math.max(baseRadius, baseRadius * Math.sqrt(seatCount / 8));
  const seatDistance = scaledRadius + Math.max(30, 20 + seatCount / 2);
  
  // Use custom ordering or default (1, 2, 3, ...)
  const ordering = seatOrdering || Array.from({ length: seatCount }, (_, i) => i + 1);
  
  // Use custom modes or default ('default' for all)
  const modes = seatModes || Array.from({ length: seatCount }, () => 'default' as SeatMode);
  
  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2; // start top, clockwise
    const x = centerX + Math.cos(angle) * seatDistance;
    const y = centerY + Math.sin(angle) * seatDistance;
    
    // Calculate adjacent seats (previous and next in circle)
    const prevIndex = (i - 1 + seatCount) % seatCount;
    const nextIndex = (i + 1) % seatCount;
    const adjacentSeats = [
      `${id}-seat-${prevIndex + 1}`,
      `${id}-seat-${nextIndex + 1}`,
    ];
    
    seats.push({
      id: `${id}-seat-${i + 1}`,
      x,
      y,
      radius: seatRadius,
      label: `${ordering[i]}`,
      seatNumber: ordering[i],
      assignedGuestId: null,
      locked: false,
      selected: false,
      position: i,
      adjacentSeats,
      mode: modes[i] || 'default',
    });
  }

  return {
    id,
    x: centerX,
    y: centerY,
    radius: scaledRadius,
    label,
    shape: "round",
    seats,
  };
}

// ============================================================================
// RECTANGLE TABLE ADJACENCY HELPERS
// ============================================================================

type RectangleSide = "top" | "bottom" | "left" | "right";

/**
 * Determines which side of a rectangle table a seat is on based on its position index.
 * Seats are arranged: top (L→R), right (T→B), bottom (R→L), left (B→T)
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
 * Gets the opposite side for a given side
 */
function getOppositeSide(side: RectangleSide): RectangleSide {
  switch (side) {
    case "top": return "bottom";
    case "bottom": return "top";
    case "left": return "right";
    case "right": return "left";
  }
}

/**
 * Finds the seat position that is directly opposite to the given seat.
 * Returns null if the opposite side has a different number of seats.
 * 
 * IMPORTANT: This implements the key adjacency rule for rectangle tables:
 * - Top seat[i] is opposite to Bottom seat[top - 1 - i] (because bottom goes R→L)
 * - Left seat[i] is opposite to Right seat[left - 1 - i] (because right goes T→B, left goes B→T)
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

/**
 * Gets the same-side neighbors for a seat (the seats immediately to the left and right
 * on the SAME side of the rectangle table).
 * 
 * Unlike circular wrapping, this respects side boundaries:
 * - First seat on a side only has one neighbor on that side
 * - Last seat on a side only has one neighbor on that side
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

/**
 * Gets edge/corner adjacent seats for corner seats.
 * 
 * When a seat is at a corner of the rectangle:
 * - It connects to the nearest seat on the perpendicular side
 * 
 * Example: If seat is at top-left corner (first seat on top side),
 * it's adjacent to the last seat on the left side.
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
      // First seat (left corner) - connects to last seat of left side (if left side exists)
      if (indexInSide === 0 && left > 0) {
        edgeSeats.push(top + right + bottom + left - 1); // Last seat of left side
      }
      // Last seat (right corner) - connects to first seat of right side (if right side exists)
      if (indexInSide === top - 1 && right > 0) {
        edgeSeats.push(top); // First seat of right side
      }
      break;
      
    case "right":
      // First seat (top corner) - connects to last seat of top side (if top side exists)
      if (indexInSide === 0 && top > 0) {
        edgeSeats.push(top - 1); // Last seat of top side
      }
      // Last seat (bottom corner) - connects to first seat of bottom side (if bottom side exists)
      if (indexInSide === right - 1 && bottom > 0) {
        edgeSeats.push(top + right); // First seat of bottom side
      }
      break;
      
    case "bottom":
      // First seat (right corner) - connects to last seat of right side (if right side exists)
      if (indexInSide === 0 && right > 0) {
        edgeSeats.push(top + right - 1); // Last seat of right side
      }
      // Last seat (left corner) - connects to first seat of left side (if left side exists)
      if (indexInSide === bottom - 1 && left > 0) {
        edgeSeats.push(top + right + bottom); // First seat of left side
      }
      break;
      
    case "left":
      // First seat (bottom corner) - connects to last seat of bottom side (if bottom side exists)
      if (indexInSide === 0 && bottom > 0) {
        edgeSeats.push(top + right + bottom - 1); // Last seat of bottom side
      }
      // Last seat (top corner) - connects to first seat of top side (if top side exists)
      if (indexInSide === left - 1 && top > 0) {
        edgeSeats.push(0); // First seat of top side
      }
      break;
  }
  
  return edgeSeats;
}

/**
 * Computes all adjacent seat positions for a given seat on a rectangle table.
 * 
 * Adjacency for rectangle tables includes:
 * 1. Same-side neighbors (seats immediately beside on the same side)
 * 2. Opposite seat (if opposite side has the same number of seats)
 * 3. Edge/corner adjacencies (for corner seats, the adjacent seat on the perpendicular side)
 */
function computeRectangleAdjacency(
  seatPosition: number,
  config: RectangleSeatsConfig
): number[] {
  const adjacentPositions = new Set<number>();
  
  // 1. Add same-side neighbors
  const sideNeighbors = getSameSideNeighbors(seatPosition, config);
  sideNeighbors.forEach(pos => adjacentPositions.add(pos));
  
  // 2. Add opposite seat (if applicable)
  const oppositePosition = getOppositeSeatPosition(seatPosition, config);
  if (oppositePosition !== null) {
    adjacentPositions.add(oppositePosition);
  }
  
  // 3. Add edge/corner adjacencies
  const edgePositions = getEdgeAdjacentPositions(seatPosition, config);
  edgePositions.forEach(pos => adjacentPositions.add(pos));
  
  return Array.from(adjacentPositions).sort((a, b) => a - b);
}

/**
 * Create a rectangular table with custom seat ordering, adjacency tracking, and seat modes
 * 
 * FIXED: Now computes proper adjacency for rectangle tables including:
 * - Same-side neighbors (seats beside on the same edge)
 * - Opposite seats (for sides with matching seat counts)
 * - Corner/edge adjacencies (for seats at table corners)
 */
export function createRectangleTable(
  id: string,
  centerX: number,
  centerY: number,
  top: number,
  bottom: number,
  left: number,
  right: number,
  label: string,
  seatOrdering?: number[], // Custom seat numbering
  seatModes?: SeatMode[] // Custom seat modes
): Table {
  const seats: Seat[] = [];
  const seatRadius = 12;
  
  // Calculate dimensions based on seat counts
  const minSeatSpacing = 40;
  const padding = 30;
  
  const horizontalSeats = Math.max(top, bottom);
  const width = horizontalSeats > 0 
    ? Math.max(160, horizontalSeats * minSeatSpacing + 2 * padding) 
    : 160;
  
  const verticalSeats = Math.max(left, right);
  const height = verticalSeats > 0 
    ? Math.max(100, verticalSeats * minSeatSpacing + 2 * padding) 
    : 100;
  
  const totalSeats = top + bottom + left + right;
  
  // Use custom ordering or default
  const ordering = seatOrdering || Array.from({ length: totalSeats }, (_, i) => i + 1);
  
  // Use custom modes or default
  const modes = seatModes || Array.from({ length: totalSeats }, () => 'default' as SeatMode);
  
  const seatOffset = seatRadius * 2.5;
  let seatIndex = 0;
  
  // Store the config for adjacency calculation
  const config: RectangleSeatsConfig = { top, bottom, left, right };
  
  // Helper to push seats with position tracking (adjacency computed later)
  const pushSeat = (x: number, y: number) => {
    if (seatIndex >= totalSeats) return;
    
    seats.push({
      id: `${id}-seat-${seatIndex + 1}`,
      x,
      y,
      radius: seatRadius,
      label: `${ordering[seatIndex]}`,
      seatNumber: ordering[seatIndex],
      assignedGuestId: null,
      locked: false,
      selected: false,
      position: seatIndex,
      adjacentSeats: [], // Will be computed below
      mode: modes[seatIndex] || 'default',
    });
    seatIndex++;
  };
  
  // Top seats (left to right)
  if (top > 0) {
    const spacing = width / (top + 1);
    for (let i = 0; i < top; i++) {
      const x = centerX - width / 2 + spacing * (i + 1);
      const y = centerY - height / 2 - seatOffset;
      pushSeat(x, y);
    }
  }
  
  // Right seats (top to bottom)
  if (right > 0) {
    const spacing = height / (right + 1);
    for (let i = 0; i < right; i++) {
      const x = centerX + width / 2 + seatOffset;
      const y = centerY - height / 2 + spacing * (i + 1);
      pushSeat(x, y);
    }
  }
  
  // Bottom seats (right to left)
  if (bottom > 0) {
    const spacing = width / (bottom + 1);
    for (let i = 0; i < bottom; i++) {
      const x = centerX + width / 2 - spacing * (i + 1);
      const y = centerY + height / 2 + seatOffset;
      pushSeat(x, y);
    }
  }
  
  // Left seats (bottom to top)
  if (left > 0) {
    const spacing = height / (left + 1);
    for (let i = 0; i < left; i++) {
      const x = centerX - width / 2 - seatOffset;
      const y = centerY + height / 2 - spacing * (i + 1);
      pushSeat(x, y);
    }
  }
  
  // FIXED: Compute proper adjacency for rectangle tables
  // This includes same-side neighbors, opposite seats, and edge adjacencies
  for (let i = 0; i < seats.length; i++) {
    const adjacentPositions = computeRectangleAdjacency(i, config);
    seats[i].adjacentSeats = adjacentPositions
      .filter(pos => pos >= 0 && pos < seats.length)
      .map(pos => seats[pos].id);
  }

  return {
    id,
    x: centerX,
    y: centerY,
    radius: 0,
    label,
    shape: "rectangle",
    width,
    height,
    seats,
    rectangleSeats: config,
  };
}