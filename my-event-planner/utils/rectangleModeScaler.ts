// utils/rectangleModeScaler.ts
// Intelligent mode scaling for rectangle tables that respects growth configuration
// Non-growing sides preserve their exact modes, only growing sides scale their patterns

import { SeatMode } from '@/types/Seat';
import { RectangleGrowthConfig } from '@/types/Template';
import { detectPattern, DetectedPattern } from './patternDetector';
import { scalePattern } from './patternScaler';

// ============================================================================
// TYPES
// ============================================================================

export interface RectangleSeatsConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SideModesBreakdown {
  top: SeatMode[];
  right: SeatMode[];
  bottom: SeatMode[];
  left: SeatMode[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract modes for each side from a flat modes array
 * Rectangle seats are ordered: top (L→R), right (T→B), bottom (R→L), left (B→T)
 */
export function extractSideModes(
  modes: SeatMode[],
  seats: RectangleSeatsConfig
): SideModesBreakdown {
  let offset = 0;
  
  const top = modes.slice(offset, offset + seats.top);
  offset += seats.top;
  
  const right = modes.slice(offset, offset + seats.right);
  offset += seats.right;
  
  const bottom = modes.slice(offset, offset + seats.bottom);
  offset += seats.bottom;
  
  const left = modes.slice(offset, offset + seats.left);
  
  return { top, right, bottom, left };
}

/**
 * Combine side modes back into a flat array
 */
export function combineSideModes(sideModes: SideModesBreakdown): SeatMode[] {
  return [
    ...sideModes.top,
    ...sideModes.right,
    ...sideModes.bottom,
    ...sideModes.left,
  ];
}

/**
 * Scale a single side's modes using pattern detection
 */
function scaleSideModes(
  sideModes: SeatMode[],
  targetCount: number
): SeatMode[] {
  if (targetCount === 0) {
    return [];
  }
  
  if (sideModes.length === 0) {
    return Array(targetCount).fill('default' as SeatMode);
  }
  
  if (sideModes.length === targetCount) {
    return [...sideModes];
  }
  
  // Detect the pattern on this side and scale it
  const pattern = detectPattern(sideModes);
  return scalePattern(pattern, targetCount);
}

/**
 * Preserve side modes exactly (for non-growing sides)
 * If target count differs from current, we handle edge cases:
 * - If target < current: truncate (shouldn't happen for non-growing)
 * - If target > current: extend with the last mode (shouldn't happen for non-growing)
 */
function preserveSideModes(
  sideModes: SeatMode[],
  targetCount: number
): SeatMode[] {
  if (targetCount === 0) {
    return [];
  }
  
  if (sideModes.length === 0) {
    return Array(targetCount).fill('default' as SeatMode);
  }
  
  if (sideModes.length === targetCount) {
    return [...sideModes];
  }
  
  // For non-growing sides, this shouldn't happen, but handle gracefully
  if (targetCount < sideModes.length) {
    return sideModes.slice(0, targetCount);
  }
  
  // Extend with the last mode's value
  const lastMode = sideModes[sideModes.length - 1];
  return [...sideModes, ...Array(targetCount - sideModes.length).fill(lastMode)];
}

// ============================================================================
// MAIN SCALING FUNCTIONS
// ============================================================================

/**
 * Scale rectangle modes while respecting growth configuration
 * 
 * Key behavior:
 * - Non-growing sides: Preserve their modes EXACTLY
 * - Growing sides: Scale their patterns intelligently
 * 
 * @param baseModes - The original modes array from the template
 * @param baseSeats - The original seat configuration
 * @param targetSeats - The target seat configuration after scaling
 * @param growthConfig - Which sides are allowed to grow
 * @returns Scaled modes array
 */
export function scaleRectangleModesWithGrowth(
  baseModes: SeatMode[],
  baseSeats: RectangleSeatsConfig,
  targetSeats: RectangleSeatsConfig,
  growthConfig: RectangleGrowthConfig
): SeatMode[] {
  // Extract modes for each side
  const baseSideModes = extractSideModes(baseModes, baseSeats);
  
  // Scale or preserve each side based on growth config
  const scaledSideModes: SideModesBreakdown = {
    top: growthConfig.top
      ? scaleSideModes(baseSideModes.top, targetSeats.top)
      : preserveSideModes(baseSideModes.top, targetSeats.top),
    
    right: growthConfig.right
      ? scaleSideModes(baseSideModes.right, targetSeats.right)
      : preserveSideModes(baseSideModes.right, targetSeats.right),
    
    bottom: growthConfig.bottom
      ? scaleSideModes(baseSideModes.bottom, targetSeats.bottom)
      : preserveSideModes(baseSideModes.bottom, targetSeats.bottom),
    
    left: growthConfig.left
      ? scaleSideModes(baseSideModes.left, targetSeats.left)
      : preserveSideModes(baseSideModes.left, targetSeats.left),
  };
  
  return combineSideModes(scaledSideModes);
}

/**
 * Calculate target seat distribution when scaling
 * Only growing sides change; non-growing sides keep their count
 */
export function calculateScaledRectangleSeats(
  baseSeats: RectangleSeatsConfig,
  growthConfig: RectangleGrowthConfig,
  targetTotalSeats: number
): RectangleSeatsConfig {
  const baseTotal = baseSeats.top + baseSeats.bottom + baseSeats.left + baseSeats.right;
  const difference = targetTotalSeats - baseTotal;
  
  if (difference === 0) {
    return { ...baseSeats };
  }
  
  // Identify growing sides
  const growableSides: Array<'top' | 'bottom' | 'left' | 'right'> = [];
  if (growthConfig.top) growableSides.push('top');
  if (growthConfig.bottom) growableSides.push('bottom');
  if (growthConfig.left) growableSides.push('left');
  if (growthConfig.right) growableSides.push('right');
  
  if (growableSides.length === 0) {
    // No growable sides - return base config (can't scale)
    console.warn('No growable sides defined, cannot scale rectangle');
    return { ...baseSeats };
  }
  
  const result = { ...baseSeats };
  
  if (difference > 0) {
    // Adding seats - distribute evenly among growable sides
    let remaining = difference;
    let sideIndex = 0;
    
    while (remaining > 0) {
      const side = growableSides[sideIndex % growableSides.length];
      result[side]++;
      remaining--;
      sideIndex++;
    }
  } else {
    // Removing seats - remove from growable sides
    let toRemove = Math.abs(difference);
    let sideIndex = 0;
    let iterations = 0;
    const maxIterations = toRemove * growableSides.length * 2;
    
    while (toRemove > 0 && iterations < maxIterations) {
      const side = growableSides[sideIndex % growableSides.length];
      if (result[side] > 0) {
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
 * Full rectangle scaling: calculate new seat distribution and scale modes
 */
export function scaleRectangleTemplate(
  baseModes: SeatMode[],
  baseSeats: RectangleSeatsConfig,
  growthConfig: RectangleGrowthConfig,
  targetTotalSeats: number
): {
  seats: RectangleSeatsConfig;
  modes: SeatMode[];
} {
  // Calculate the new seat distribution
  const targetSeats = calculateScaledRectangleSeats(baseSeats, growthConfig, targetTotalSeats);
  
  // Scale the modes respecting growth configuration
  const scaledModes = scaleRectangleModesWithGrowth(
    baseModes,
    baseSeats,
    targetSeats,
    growthConfig
  );
  
  return {
    seats: targetSeats,
    modes: scaledModes,
  };
}

// ============================================================================
// DEBUGGING/VISUALIZATION HELPERS
// ============================================================================

/**
 * Get a visual representation of modes by side (for debugging)
 */
export function getModesVisualization(
  modes: SeatMode[],
  seats: RectangleSeatsConfig
): string {
  const sideModes = extractSideModes(modes, seats);
  
  const modeToChar = (m: SeatMode) => 
    m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D';
  
  const formatSide = (side: SeatMode[]) => 
    side.map(modeToChar).join('') || '(empty)';
  
  return [
    `Top:    [${formatSide(sideModes.top)}] (${sideModes.top.length})`,
    `Right:  [${formatSide(sideModes.right)}] (${sideModes.right.length})`,
    `Bottom: [${formatSide(sideModes.bottom)}] (${sideModes.bottom.length})`,
    `Left:   [${formatSide(sideModes.left)}] (${sideModes.left.length})`,
  ].join('\n');
}

/**
 * Validate that modes array length matches seat configuration
 */
export function validateModesLength(
  modes: SeatMode[],
  seats: RectangleSeatsConfig
): boolean {
  const expectedLength = seats.top + seats.right + seats.bottom + seats.left;
  return modes.length === expectedLength;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  extractSideModes,
  combineSideModes,
  scaleRectangleModesWithGrowth,
  calculateScaledRectangleSeats,
  scaleRectangleTemplate,
  getModesVisualization,
  validateModesLength,
};