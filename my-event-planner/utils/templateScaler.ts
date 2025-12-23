// utils/templateScaler.ts
// Utility functions for scaling table templates to different seat counts

import { 
  TableTemplate, 
  ScaledTemplateResult, 
  SeatModePattern,
  RectangleGrowthConfig,
  Direction,
  OrderingPattern,
} from '@/types/Template';
import { SeatMode } from '@/types/Seat';

/**
 * Generate seat ordering based on direction, ordering pattern, and start position
 * This is a shared utility used by both templates and manual table creation
 * 
 * @param count - Total number of seats
 * @param direction - 'clockwise' or 'counter-clockwise'
 * @param pattern - 'sequential', 'alternating', or 'opposite'
 * @param startPosition - Index of the starting seat (seat #1)
 * @param rectangleConfig - Optional rectangle configuration for opposite pattern
 */
export function generateOrdering(
  count: number,
  direction: Direction,
  pattern: OrderingPattern,
  startPosition: number,
  rectangleConfig?: { top: number; bottom: number; left: number; right: number }
): number[] {
  const result: number[] = new Array(count);

  if (pattern === 'sequential') {
    // Simple sequential ordering
    if (direction === 'clockwise') {
      for (let i = 0; i < count; i++) {
        const position = (startPosition + i) % count;
        result[position] = i + 1;
      }
    } else {
      for (let i = 0; i < count; i++) {
        const position = (startPosition - i + count) % count;
        result[position] = i + 1;
      }
    }
  } else if (pattern === 'alternating') {
    // Alternating pattern: Seat 1 at start, evens go one way, odds go the other
    result[startPosition] = 1;

    const odds: number[] = [];
    const evens: number[] = [];

    for (let i = 2; i <= count; i++) {
      if (i % 2 === 0) {
        evens.push(i);
      } else {
        odds.push(i);
      }
    }

    if (direction === 'clockwise') {
      for (let i = 0; i < evens.length; i++) {
        const position = (startPosition + 1 + i) % count;
        result[position] = evens[i];
      }
      for (let i = 0; i < odds.length; i++) {
        const position = (startPosition - 1 - i + count) % count;
        result[position] = odds[i];
      }
    } else {
      for (let i = 0; i < evens.length; i++) {
        const position = (startPosition - 1 - i + count) % count;
        result[position] = evens[i];
      }
      for (let i = 0; i < odds.length; i++) {
        const position = (startPosition + 1 + i) % count;
        result[position] = odds[i];
      }
    }
  } else if (pattern === 'opposite') {
    // Opposite pattern: Seat 1 faces Seat 2, Seat 3 next to Seat 1, Seat 4 opposite Seat 3, etc.
    if (rectangleConfig) {
      return generateOppositeOrderingRectangle(count, direction, startPosition, rectangleConfig);
    } else {
      return generateOppositeOrderingRound(count, direction, startPosition);
    }
  }

  return result;
}

/**
 * Generate opposite ordering for round tables
 * Seat 1 at start, Seat 2 directly opposite, then pairs alternate around
 */
function generateOppositeOrderingRound(
  count: number,
  direction: Direction,
  startPosition: number
): number[] {
  const result: number[] = new Array(count).fill(0);
  const halfCount = Math.floor(count / 2);
  
  let seatNumber = 1;
  const step = direction === 'clockwise' ? 1 : -1;
  
  // Place pairs: odd seats on one side, even seats opposite
  for (let i = 0; i < Math.ceil(count / 2); i++) {
    // Position for odd seat (1, 3, 5, ...)
    const oddPosition = (startPosition + step * i + count) % count;
    result[oddPosition] = seatNumber++;
    
    if (seatNumber <= count) {
      // Position for even seat (2, 4, 6, ...) - directly opposite
      const evenPosition = (oddPosition + halfCount) % count;
      result[evenPosition] = seatNumber++;
    }
  }
  
  return result;
}

/**
 * Generate opposite ordering for rectangle tables
 * Pairs seats across the table: top↔bottom, left↔right
 */
function generateOppositeOrderingRectangle(
  count: number,
  direction: Direction,
  startPosition: number,
  config: { top: number; bottom: number; left: number; right: number }
): number[] {
  const result: number[] = new Array(count).fill(0);
  const { top, bottom, left, right } = config;
  
  // Build seat position map with side info
  interface SeatInfo {
    position: number;
    side: 'top' | 'bottom' | 'left' | 'right';
    indexOnSide: number;
  }
  
  const seatInfos: SeatInfo[] = [];
  let pos = 0;
  
  // Top seats (left to right)
  for (let i = 0; i < top; i++) {
    seatInfos.push({ position: pos++, side: 'top', indexOnSide: i });
  }
  // Right seats (top to bottom)
  for (let i = 0; i < right; i++) {
    seatInfos.push({ position: pos++, side: 'right', indexOnSide: i });
  }
  // Bottom seats (right to left)
  for (let i = 0; i < bottom; i++) {
    seatInfos.push({ position: pos++, side: 'bottom', indexOnSide: i });
  }
  // Left seats (bottom to top)
  for (let i = 0; i < left; i++) {
    seatInfos.push({ position: pos++, side: 'left', indexOnSide: i });
  }
  
  // Find the opposite position for a given seat
  const getOppositePosition = (seatInfo: SeatInfo): number | null => {
    const { side, indexOnSide } = seatInfo;
    
    if (side === 'top' && bottom > 0) {
      // Opposite is bottom, seats are mirrored (left-to-right vs right-to-left)
      const oppositeIndex = top - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < bottom) {
        const bottomStart = top + right;
        return bottomStart + oppositeIndex;
      }
    } else if (side === 'bottom' && top > 0) {
      // Opposite is top
      const oppositeIndex = bottom - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < top) {
        return oppositeIndex;
      }
    } else if (side === 'left' && right > 0) {
      // Opposite is right, seats are mirrored
      const oppositeIndex = left - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < right) {
        return top + oppositeIndex;
      }
    } else if (side === 'right' && left > 0) {
      // Opposite is left
      const oppositeIndex = right - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < left) {
        const leftStart = top + right + bottom;
        return leftStart + oppositeIndex;
      }
    }
    
    return null;
  };
  
  // Start from the start position and work around the table
  const startInfo = seatInfos.find(s => s.position === startPosition);
  if (!startInfo) {
    // Fallback to sequential if invalid start position
    return generateOrdering(count, direction, 'sequential', 0);
  }
  
  let seatNumber = 1;
  const visited = new Set<number>();
  const step = direction === 'clockwise' ? 1 : -1;
  
  // Process seats in pairs (seat and its opposite)
  for (let i = 0; i < count && seatNumber <= count; i++) {
    const currentPos = (startPosition + step * i + count) % count;
    
    if (visited.has(currentPos)) continue;
    
    // Assign seat number to current position
    result[currentPos] = seatNumber++;
    visited.add(currentPos);
    
    if (seatNumber <= count) {
      // Find and assign opposite seat
      const currentInfo = seatInfos.find(s => s.position === currentPos);
      if (currentInfo) {
        const oppositePos = getOppositePosition(currentInfo);
        if (oppositePos !== null && !visited.has(oppositePos)) {
          result[oppositePos] = seatNumber++;
          visited.add(oppositePos);
        }
      }
    }
  }
  
  // Fill any remaining unvisited positions (edge cases)
  for (let i = 0; i < count; i++) {
    if (result[i] === 0) {
      result[i] = seatNumber++;
    }
  }
  
  return result;
}

/**
 * Generate a visual pattern preview string
 */
export function generatePatternPreview(
  count: number,
  direction: Direction,
  pattern: OrderingPattern,
  rectangleConfig?: { top: number; bottom: number; left: number; right: number }
): string {
  const ordering = generateOrdering(count, direction, pattern, 0, rectangleConfig);
  const maxShow = Math.min(12, count);
  const preview = ordering.slice(0, maxShow).join(' → ');
  return count > maxShow ? `${preview} ...` : preview;
}

/**
 * Generate seat modes based on a pattern and seat count
 */
export function generateSeatModes(
  pattern: SeatModePattern,
  seatCount: number
): SeatMode[] {
  const modes: SeatMode[] = new Array(seatCount).fill(pattern.defaultMode);

  switch (pattern.type) {
    case 'repeating':
      if (pattern.pattern && pattern.pattern.length > 0) {
        for (let i = 0; i < seatCount; i++) {
          modes[i] = pattern.pattern[i % pattern.pattern.length];
        }
      }
      break;

    case 'alternating':
      if (pattern.alternatingModes) {
        for (let i = 0; i < seatCount; i++) {
          modes[i] = pattern.alternatingModes[i % 2];
        }
      }
      break;

    case 'specific':
      if (pattern.specificModes) {
        Object.entries(pattern.specificModes).forEach(([pos, mode]) => {
          const index = parseInt(pos, 10);
          if (index >= 0 && index < seatCount) {
            modes[index] = mode;
          }
        });
      }
      break;
  }

  return modes;
}

/**
 * Scale rectangle seats based on growth configuration
 * Returns the new seat distribution for each side
 */
export function scaleRectangleSeats(
  baseSeats: { top: number; bottom: number; left: number; right: number },
  growthSides: RectangleGrowthConfig,
  targetSeatCount: number
): { top: number; bottom: number; left: number; right: number } {
  const baseTotal = baseSeats.top + baseSeats.bottom + baseSeats.left + baseSeats.right;
  const difference = targetSeatCount - baseTotal;

  if (difference === 0) {
    return { ...baseSeats };
  }

  // Count how many sides can grow
  const growableSides: Array<'top' | 'bottom' | 'left' | 'right'> = [];
  if (growthSides.top) growableSides.push('top');
  if (growthSides.bottom) growableSides.push('bottom');
  if (growthSides.left) growableSides.push('left');
  if (growthSides.right) growableSides.push('right');

  if (growableSides.length === 0) {
    // No sides can grow, return base (clamped)
    console.warn('No growable sides defined, returning base configuration');
    return { ...baseSeats };
  }

  const result = { ...baseSeats };

  if (difference > 0) {
    // Growing: distribute extra seats among growable sides
    let remaining = difference;
    let sideIndex = 0;

    while (remaining > 0) {
      const side = growableSides[sideIndex % growableSides.length];
      result[side]++;
      remaining--;
      sideIndex++;
    }
  } else {
    // Shrinking: remove seats from growable sides (but don't go below 0)
    let toRemove = Math.abs(difference);
    let sideIndex = 0;
    let iterations = 0;
    const maxIterations = toRemove * growableSides.length;

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
 * Calculate total seats for a rectangle configuration
 */
export function calculateRectangleTotal(
  seats: { top: number; bottom: number; left: number; right: number }
): number {
  return seats.top + seats.bottom + seats.left + seats.right;
}

/**
 * Scale a template to a specific seat count
 */
export function scaleTemplate(
  template: TableTemplate,
  targetSeatCount: number
): ScaledTemplateResult {
  // Clamp to min/max
  const clampedCount = Math.max(
    template.minSeats,
    Math.min(template.maxSeats, targetSeatCount)
  );

  // Prepare rectangle config if applicable
  let rectangleConfig: { top: number; bottom: number; left: number; right: number } | undefined;
  
  if (template.baseConfig.type === 'rectangle') {
    const baseSeats = template.baseConfig.baseSeats || {
      top: 2,
      bottom: 2,
      left: 1,
      right: 1,
    };
    
    const growthSides = template.baseConfig.growthSides || {
      top: true,
      bottom: true,
      left: false,
      right: false,
    };

    rectangleConfig = scaleRectangleSeats(baseSeats, growthSides, clampedCount);
  }

  // Generate ordering with rectangle config for opposite pattern
  const seatOrdering = generateOrdering(
    clampedCount,
    template.orderingDirection,
    template.orderingPattern,
    template.startPosition,
    rectangleConfig
  );

  // Generate seat modes
  const seatModes = generateSeatModes(template.seatModePattern, clampedCount);

  if (template.baseConfig.type === 'round') {
    return {
      type: 'round',
      seatCount: clampedCount,
      roundSeats: clampedCount,
      seatOrdering,
      seatModes,
    };
  } else {
    return {
      type: 'rectangle',
      seatCount: calculateRectangleTotal(rectangleConfig!),
      rectangleSeats: rectangleConfig,
      seatOrdering,
      seatModes,
    };
  }
}

/**
 * Validate a template configuration
 */
export function validateTemplate(template: Partial<TableTemplate>): string[] {
  const errors: string[] = [];

  if (!template.name?.trim()) {
    errors.push('Template name is required');
  }

  if (!template.baseConfig) {
    errors.push('Base configuration is required');
  } else {
    if (template.baseConfig.type === 'round') {
      const seats = template.baseConfig.baseSeatCount || 0;
      if (seats < 2) {
        errors.push('Round table must have at least 2 seats');
      }
    } else {
      const base = template.baseConfig.baseSeats;
      if (!base || (base.top + base.bottom + base.left + base.right) < 2) {
        errors.push('Rectangle table must have at least 2 seats');
      }
    }
  }

  if (template.minSeats !== undefined && template.maxSeats !== undefined) {
    if (template.minSeats > template.maxSeats) {
      errors.push('Minimum seats cannot be greater than maximum seats');
    }
    if (template.minSeats < 2) {
      errors.push('Minimum seats must be at least 2');
    }
  }

  if (!template.sessionTypes || template.sessionTypes.length === 0) {
    errors.push('At least one session type must be selected');
  }

  return errors;
}

/**
 * Get the base seat count for a template
 */
export function getTemplateBaseSeatCount(template: TableTemplate): number {
  if (template.baseConfig.type === 'round') {
    return template.baseConfig.baseSeatCount || 8;
  } else {
    const base = template.baseConfig.baseSeats || { top: 2, bottom: 2, left: 1, right: 1 };
    return base.top + base.bottom + base.left + base.right;
  }
}

/**
 * Check if a seat count is valid for a template
 */
export function isValidSeatCount(template: TableTemplate, seatCount: number): boolean {
  return seatCount >= template.minSeats && seatCount <= template.maxSeats;
}

/**
 * Get suggested seat counts for a template (for UI dropdowns)
 */
export function getSuggestedSeatCounts(template: TableTemplate): number[] {
  const counts: number[] = [];
  const base = getTemplateBaseSeatCount(template);
  
  // Add min, base, and max
  counts.push(template.minSeats);
  
  // Add intermediate values
  for (let i = template.minSeats + 2; i < template.maxSeats; i += 2) {
    if (i !== base) {
      counts.push(i);
    }
  }
  
  counts.push(base);
  counts.push(template.maxSeats);
  
  // Sort and dedupe
  return [...new Set(counts)].sort((a, b) => a - b);
}