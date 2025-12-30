// utils/centerAnchoredScaler.ts
// Handles center-anchored scaling for rectangle tables
// Key feature: Seat 1 stays at its relative position (e.g., center)
// New seats are added at the EDGES, ordering radiates OUTWARD from center

import { Direction, OrderingPattern } from '@/types/Template';

// ============================================================================
// TYPES
// ============================================================================

export type AnchorMode = 'edge' | 'center';

export interface SideAnchor {
  side: 'top' | 'bottom' | 'left' | 'right';
  relativePosition: 'start' | 'center' | 'end' | number; // number = specific ratio (0-1)
}

export interface RectangleSeats {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface CenterAnchoredConfig {
  anchorMode: AnchorMode;
  anchor?: SideAnchor;
  // For center mode, which sides can grow (new seats added at edges)
  growthSides?: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine which side a position belongs to and its index on that side
 */
export function getPositionInfo(
  position: number,
  seats: RectangleSeats
): { side: 'top' | 'bottom' | 'left' | 'right'; indexOnSide: number; sideSize: number } {
  const { top, bottom, left, right } = seats;
  
  if (position < top) {
    return { side: 'top', indexOnSide: position, sideSize: top };
  }
  if (position < top + right) {
    return { side: 'right', indexOnSide: position - top, sideSize: right };
  }
  if (position < top + right + bottom) {
    return { side: 'bottom', indexOnSide: position - top - right, sideSize: bottom };
  }
  return { side: 'left', indexOnSide: position - top - right - bottom, sideSize: left };
}

/**
 * Get the absolute position for a side and index
 */
export function getAbsolutePosition(
  side: 'top' | 'bottom' | 'left' | 'right',
  indexOnSide: number,
  seats: RectangleSeats
): number {
  const { top, right, bottom } = seats;
  
  switch (side) {
    case 'top':
      return indexOnSide;
    case 'right':
      return top + indexOnSide;
    case 'bottom':
      return top + right + indexOnSide;
    case 'left':
      return top + right + bottom + indexOnSide;
  }
}

/**
 * Calculate the center index for a given side size
 */
export function getCenterIndex(sideSize: number): number {
  return Math.floor((sideSize - 1) / 2);
}

/**
 * Calculate the relative position (0-1) of an index on a side
 */
export function getRelativePosition(indexOnSide: number, sideSize: number): number {
  if (sideSize <= 1) return 0.5;
  return indexOnSide / (sideSize - 1);
}

/**
 * Calculate the index on a side for a given relative position
 */
export function getIndexFromRelative(relativePosition: number, sideSize: number): number {
  if (sideSize <= 1) return 0;
  return Math.round(relativePosition * (sideSize - 1));
}

/**
 * Detect if a position is at the center of its side
 */
export function isAtCenter(position: number, seats: RectangleSeats): boolean {
  const info = getPositionInfo(position, seats);
  const centerIndex = getCenterIndex(info.sideSize);
  return info.indexOnSide === centerIndex;
}

/**
 * Detect the anchor from a start position
 */
export function detectAnchor(startPosition: number, seats: RectangleSeats): SideAnchor {
  const info = getPositionInfo(startPosition, seats);
  const relPos = getRelativePosition(info.indexOnSide, info.sideSize);
  
  // Determine relative position type
  let relativePosition: 'start' | 'center' | 'end' | number;
  
  if (info.indexOnSide === 0) {
    relativePosition = 'start';
  } else if (info.indexOnSide === info.sideSize - 1) {
    relativePosition = 'end';
  } else if (Math.abs(relPos - 0.5) < 0.1) {
    relativePosition = 'center';
  } else {
    relativePosition = relPos;
  }
  
  return {
    side: info.side,
    relativePosition,
  };
}

// ============================================================================
// SCALING FUNCTIONS
// ============================================================================

/**
 * Scale rectangle seats with center-anchored logic
 * Adds new seats at the EDGES of each side, preserving center positions
 */
export function scaleRectangleSeatsCenterAnchored(
  baseSeats: RectangleSeats,
  targetCount: number,
  growthSides: { top: boolean; bottom: boolean; left: boolean; right: boolean }
): RectangleSeats {
  const baseTotal = baseSeats.top + baseSeats.bottom + baseSeats.left + baseSeats.right;
  const difference = targetCount - baseTotal;
  
  if (difference === 0) {
    return { ...baseSeats };
  }
  
  const growableSides: Array<'top' | 'bottom' | 'left' | 'right'> = [];
  if (growthSides.top) growableSides.push('top');
  if (growthSides.bottom) growableSides.push('bottom');
  if (growthSides.left) growableSides.push('left');
  if (growthSides.right) growableSides.push('right');
  
  if (growableSides.length === 0) {
    return { ...baseSeats };
  }
  
  const result = { ...baseSeats };
  
  if (difference > 0) {
    // Adding seats - distribute evenly across growable sides
    let remaining = difference;
    let sideIndex = 0;
    
    while (remaining > 0) {
      const side = growableSides[sideIndex % growableSides.length];
      result[side]++;
      remaining--;
      sideIndex++;
    }
  } else {
    // Removing seats - from edges
    let toRemove = Math.abs(difference);
    let sideIndex = 0;
    let iterations = 0;
    const maxIterations = toRemove * growableSides.length;
    
    while (toRemove > 0 && iterations < maxIterations) {
      const side = growableSides[sideIndex % growableSides.length];
      if (result[side] > 1) { // Keep at least 1 seat per side
        result[side]--;
        toRemove--;
      }
      sideIndex++;
      iterations++;
    }
  }
  
  return result;
}

/**
 * Calculate the new start position after scaling, maintaining relative position
 */
export function calculateScaledStartPosition(
  anchor: SideAnchor,
  newSeats: RectangleSeats
): number {
  const sideSize = newSeats[anchor.side];
  
  let indexOnSide: number;
  
  if (anchor.relativePosition === 'start') {
    indexOnSide = 0;
  } else if (anchor.relativePosition === 'end') {
    indexOnSide = sideSize - 1;
  } else if (anchor.relativePosition === 'center') {
    indexOnSide = getCenterIndex(sideSize);
  } else {
    // Numeric relative position (0-1)
    indexOnSide = getIndexFromRelative(anchor.relativePosition, sideSize);
  }
  
  return getAbsolutePosition(anchor.side, indexOnSide, newSeats);
}

// ============================================================================
// CENTER-OUTWARD ORDERING
// ============================================================================

/**
 * Generate ordering that radiates outward from the center/anchor position
 * This ensures seat 1 stays at center, with subsequent seats going outward
 */
export function generateCenterOutwardOrdering(
  seats: RectangleSeats,
  anchor: SideAnchor,
  direction: Direction
): number[] {
  const total = seats.top + seats.bottom + seats.left + seats.right;
  const result: number[] = new Array(total).fill(0);
  
  // Get start position from anchor
  const startPosition = calculateScaledStartPosition(anchor, seats);
  const startInfo = getPositionInfo(startPosition, seats);
  
  // Generate ordering for each side, starting from the anchor side
  // and radiating outward from the anchor position
  
  let seatNumber = 1;
  const visited = new Set<number>();
  
  // First, handle the anchor side with center-outward ordering
  const anchorSideOrdering = generateSideOrderingFromCenter(
    anchor.side,
    startInfo.indexOnSide,
    seats[anchor.side],
    seats,
    direction
  );
  
  for (const pos of anchorSideOrdering) {
    if (!visited.has(pos)) {
      result[pos] = seatNumber++;
      visited.add(pos);
    }
  }
  
  // Then handle remaining sides in order (clockwise or counter-clockwise from anchor)
  const sideOrder = getSideOrder(anchor.side, direction);
  
  for (const side of sideOrder) {
    if (side === anchor.side) continue;
    
    const sideSize = seats[side];
    if (sideSize === 0) continue;
    
    // For non-anchor sides, order from center outward as well
    const centerIndex = getCenterIndex(sideSize);
    const sideOrdering = generateSideOrderingFromCenter(
      side,
      centerIndex,
      sideSize,
      seats,
      direction
    );
    
    for (const pos of sideOrdering) {
      if (!visited.has(pos)) {
        result[pos] = seatNumber++;
        visited.add(pos);
      }
    }
  }
  
  return result;
}

/**
 * Generate ordering for a single side, radiating from a center index
 */
function generateSideOrderingFromCenter(
  side: 'top' | 'bottom' | 'left' | 'right',
  centerIndex: number,
  sideSize: number,
  seats: RectangleSeats,
  direction: Direction
): number[] {
  const positions: number[] = [];
  
  if (sideSize === 0) return positions;
  
  // Start with center
  positions.push(getAbsolutePosition(side, centerIndex, seats));
  
  // Alternate left and right from center
  let leftOffset = 1;
  let rightOffset = 1;
  
  while (positions.length < sideSize) {
    const leftIndex = centerIndex - leftOffset;
    const rightIndex = centerIndex + rightOffset;
    
    if (direction === 'clockwise') {
      // Right first, then left
      if (rightIndex < sideSize) {
        positions.push(getAbsolutePosition(side, rightIndex, seats));
        rightOffset++;
      }
      if (leftIndex >= 0 && positions.length < sideSize) {
        positions.push(getAbsolutePosition(side, leftIndex, seats));
        leftOffset++;
      }
    } else {
      // Left first, then right
      if (leftIndex >= 0) {
        positions.push(getAbsolutePosition(side, leftIndex, seats));
        leftOffset++;
      }
      if (rightIndex < sideSize && positions.length < sideSize) {
        positions.push(getAbsolutePosition(side, rightIndex, seats));
        rightOffset++;
      }
    }
    
    // Safety check to prevent infinite loop
    if (leftIndex < 0 && rightIndex >= sideSize) break;
  }
  
  return positions;
}

/**
 * Get the order of sides based on starting side and direction
 */
function getSideOrder(
  startSide: 'top' | 'bottom' | 'left' | 'right',
  direction: Direction
): Array<'top' | 'bottom' | 'left' | 'right'> {
  const clockwiseOrder: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'right', 'bottom', 'left'];
  const startIndex = clockwiseOrder.indexOf(startSide);
  
  const orderedSides: Array<'top' | 'bottom' | 'left' | 'right'> = [];
  
  for (let i = 0; i < 4; i++) {
    const index = direction === 'clockwise'
      ? (startIndex + i) % 4
      : (startIndex - i + 4) % 4;
    orderedSides.push(clockwiseOrder[index]);
  }
  
  return orderedSides;
}

// ============================================================================
// ALTERNATING CENTER-OUTWARD (for bilateral seating)
// ============================================================================

/**
 * Generate ordering for bilateral/opposite seating with center anchor
 * Seat 1 at center of one side, Seat 2 opposite, then outward
 */
export function generateCenterOutwardOppositeOrdering(
  seats: RectangleSeats,
  anchor: SideAnchor,
  direction: Direction
): number[] {
  const total = seats.top + seats.bottom + seats.left + seats.right;
  const result: number[] = new Array(total).fill(0);
  
  const startPosition = calculateScaledStartPosition(anchor, seats);
  const startInfo = getPositionInfo(startPosition, seats);
  
  let seatNumber = 1;
  const visited = new Set<number>();
  
  // Determine opposite side
  const oppositeSide = getOppositeSide(anchor.side);
  const oppositeSideSize = seats[oppositeSide];
  
  // Get center indices for both sides
  const anchorCenterIndex = startInfo.indexOnSide;
  const oppositeCenterIndex = getCenterIndex(oppositeSideSize);
  
  // Generate pairs: anchor center, opposite center, then outward
  const maxPairs = Math.max(seats[anchor.side], oppositeSideSize);
  
  for (let offset = 0; offset <= maxPairs; offset++) {
    // Anchor side positions (center ± offset)
    const anchorPositions: number[] = [];
    if (offset === 0) {
      anchorPositions.push(getAbsolutePosition(anchor.side, anchorCenterIndex, seats));
    } else {
      const leftIdx = anchorCenterIndex - offset;
      const rightIdx = anchorCenterIndex + offset;
      
      if (direction === 'clockwise') {
        if (rightIdx < seats[anchor.side]) {
          anchorPositions.push(getAbsolutePosition(anchor.side, rightIdx, seats));
        }
        if (leftIdx >= 0) {
          anchorPositions.push(getAbsolutePosition(anchor.side, leftIdx, seats));
        }
      } else {
        if (leftIdx >= 0) {
          anchorPositions.push(getAbsolutePosition(anchor.side, leftIdx, seats));
        }
        if (rightIdx < seats[anchor.side]) {
          anchorPositions.push(getAbsolutePosition(anchor.side, rightIdx, seats));
        }
      }
    }
    
    // Opposite side positions (center ± offset, mirrored)
    const oppositePositions: number[] = [];
    if (oppositeSideSize > 0) {
      if (offset === 0) {
        oppositePositions.push(getAbsolutePosition(oppositeSide, oppositeCenterIndex, seats));
      } else {
        // Mirror the offset for opposite side
        const leftIdx = oppositeCenterIndex - offset;
        const rightIdx = oppositeCenterIndex + offset;
        
        // Opposite side ordering is reversed (mirror image)
        if (direction === 'clockwise') {
          if (leftIdx >= 0) {
            oppositePositions.push(getAbsolutePosition(oppositeSide, leftIdx, seats));
          }
          if (rightIdx < oppositeSideSize) {
            oppositePositions.push(getAbsolutePosition(oppositeSide, rightIdx, seats));
          }
        } else {
          if (rightIdx < oppositeSideSize) {
            oppositePositions.push(getAbsolutePosition(oppositeSide, rightIdx, seats));
          }
          if (leftIdx >= 0) {
            oppositePositions.push(getAbsolutePosition(oppositeSide, leftIdx, seats));
          }
        }
      }
    }
    
    // Interleave: anchor, opposite, anchor, opposite...
    const maxLen = Math.max(anchorPositions.length, oppositePositions.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < anchorPositions.length && !visited.has(anchorPositions[i])) {
        result[anchorPositions[i]] = seatNumber++;
        visited.add(anchorPositions[i]);
      }
      if (i < oppositePositions.length && !visited.has(oppositePositions[i])) {
        result[oppositePositions[i]] = seatNumber++;
        visited.add(oppositePositions[i]);
      }
    }
  }
  
  // Handle side seats (left and right) if any remain
  const sideSides = anchor.side === 'top' || anchor.side === 'bottom'
    ? ['left', 'right'] as const
    : ['top', 'bottom'] as const;
  
  for (const side of sideSides) {
    const sideSize = seats[side];
    for (let i = 0; i < sideSize; i++) {
      const pos = getAbsolutePosition(side, i, seats);
      if (!visited.has(pos)) {
        result[pos] = seatNumber++;
        visited.add(pos);
      }
    }
  }
  
  return result;
}

function getOppositeSide(side: 'top' | 'bottom' | 'left' | 'right'): 'top' | 'bottom' | 'left' | 'right' {
  switch (side) {
    case 'top': return 'bottom';
    case 'bottom': return 'top';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}

// ============================================================================
// MAIN SCALING FUNCTION WITH CENTER ANCHOR
// ============================================================================

/**
 * Generate ordering for a scaled rectangle table with center-anchored logic
 * This is the main entry point for center-anchored scaling
 */
export function generateCenterAnchoredOrdering(
  baseSeats: RectangleSeats,
  targetSeats: RectangleSeats,
  baseStartPosition: number,
  direction: Direction,
  pattern: OrderingPattern
): number[] {
  // Detect anchor from base configuration
  const anchor = detectAnchor(baseStartPosition, baseSeats);
  
  // Use appropriate ordering function based on pattern
  if (pattern === 'opposite') {
    return generateCenterOutwardOppositeOrdering(targetSeats, anchor, direction);
  }
  
  // For sequential and alternating, use center-outward
  return generateCenterOutwardOrdering(targetSeats, anchor, direction);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Types
  // AnchorMode, SideAnchor, RectangleSeats, CenterAnchoredConfig
  
  // Helper functions
  getPositionInfo,
  getAbsolutePosition,
  getCenterIndex,
  getRelativePosition,
  getIndexFromRelative,
  isAtCenter,
  detectAnchor,
  
  // Scaling
  scaleRectangleSeatsCenterAnchored,
  calculateScaledStartPosition,
  
  // Ordering
  generateCenterOutwardOrdering,
  generateCenterOutwardOppositeOrdering,
  generateCenterAnchoredOrdering,
};