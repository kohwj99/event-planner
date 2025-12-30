// utils/templateScaler.ts
// ENHANCED: Utility functions for scaling table templates with intelligent pattern recognition
// NOW SUPPORTS: Center-anchored scaling for rectangle tables (VIP seating at center)

import { 
  TableTemplate, 
  ScaledTemplateResult, 
  SeatModePattern,
  RectangleGrowthConfig,
  Direction,
  OrderingPattern,
  isEnhancedPattern,
  convertToEnhancedPattern,
  EnhancedSeatModePattern,
} from '@/types/Template';
import { SeatMode } from '@/types/Seat';
import { 
  detectPattern, 
  DetectedPattern,
  calculateRatios,
  findRepeatingUnit,
} from './patternDetector';
import { 
  scalePattern, 
  detectAndScale,
  modesToString,
} from './patternScaler';
import {
  scaleRectangleModesWithGrowth,
  calculateScaledRectangleSeats,
  RectangleSeatsConfig,
} from './rectangleModeScaler';
import {
  isAtCenter,
  detectAnchor,
  generateCenterAnchoredOrdering,
} from './centerAnchoredScaler';

// ============================================================================
// SEAT ORDERING GENERATION
// ============================================================================

/**
 * Generate seat ordering based on direction, ordering pattern, and start position
 * This is a shared utility used by both templates and manual table creation
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
  
  for (let i = 0; i < Math.ceil(count / 2); i++) {
    const oddPosition = (startPosition + step * i + count) % count;
    result[oddPosition] = seatNumber++;
    
    if (seatNumber <= count) {
      const evenPosition = (oddPosition + halfCount) % count;
      result[evenPosition] = seatNumber++;
    }
  }
  
  return result;
}

/**
 * Generate opposite ordering for rectangle tables
 */
function generateOppositeOrderingRectangle(
  count: number,
  direction: Direction,
  startPosition: number,
  config: { top: number; bottom: number; left: number; right: number }
): number[] {
  const result: number[] = new Array(count).fill(0);
  const { top, bottom, left, right } = config;
  
  interface SeatInfo {
    position: number;
    side: 'top' | 'bottom' | 'left' | 'right';
    indexOnSide: number;
  }
  
  const seatInfos: SeatInfo[] = [];
  let pos = 0;
  
  for (let i = 0; i < top; i++) {
    seatInfos.push({ position: pos++, side: 'top', indexOnSide: i });
  }
  for (let i = 0; i < right; i++) {
    seatInfos.push({ position: pos++, side: 'right', indexOnSide: i });
  }
  for (let i = 0; i < bottom; i++) {
    seatInfos.push({ position: pos++, side: 'bottom', indexOnSide: i });
  }
  for (let i = 0; i < left; i++) {
    seatInfos.push({ position: pos++, side: 'left', indexOnSide: i });
  }
  
  const getOppositePosition = (seatInfo: SeatInfo): number | null => {
    const { side, indexOnSide } = seatInfo;
    
    if (side === 'top' && bottom > 0) {
      const oppositeIndex = top - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < bottom) {
        const bottomStart = top + right;
        return bottomStart + oppositeIndex;
      }
    } else if (side === 'bottom' && top > 0) {
      const oppositeIndex = bottom - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < top) {
        return oppositeIndex;
      }
    } else if (side === 'left' && right > 0) {
      const oppositeIndex = left - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < right) {
        return top + oppositeIndex;
      }
    } else if (side === 'right' && left > 0) {
      const oppositeIndex = right - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < left) {
        const leftStart = top + right + bottom;
        return leftStart + oppositeIndex;
      }
    }
    
    return null;
  };
  
  const startInfo = seatInfos.find(s => s.position === startPosition);
  if (!startInfo) {
    return generateOrdering(count, direction, 'sequential', 0);
  }
  
  let seatNumber = 1;
  const visited = new Set<number>();
  const step = direction === 'clockwise' ? 1 : -1;
  
  for (let i = 0; i < count && seatNumber <= count; i++) {
    const currentPos = (startPosition + step * i + count) % count;
    
    if (visited.has(currentPos)) continue;
    
    result[currentPos] = seatNumber++;
    visited.add(currentPos);
    
    if (seatNumber <= count) {
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

// ============================================================================
// ENHANCED SEAT MODE GENERATION
// ============================================================================

/**
 * Generate seat modes for ROUND tables using the enhanced pattern detection system
 */
export function generateSeatModes(
  pattern: SeatModePattern,
  targetSeatCount: number,
  baseSeatCount?: number
): SeatMode[] {
  // Handle enhanced patterns
  if (isEnhancedPattern(pattern)) {
    return generateEnhancedSeatModes(pattern, targetSeatCount);
  }
  
  // Handle legacy patterns by converting first
  const enhanced = convertToEnhancedPattern(pattern, baseSeatCount || targetSeatCount);
  return generateEnhancedSeatModes(enhanced, targetSeatCount);
}

/**
 * Generate seat modes from an enhanced pattern (for round tables)
 */
function generateEnhancedSeatModes(
  pattern: EnhancedSeatModePattern,
  targetSeatCount: number
): SeatMode[] {
  // If we have base modes, detect and scale them
  if (pattern.baseModes && pattern.baseModes.length > 0) {
    const detectedPattern = detectPattern(pattern.baseModes);
    return scalePattern(detectedPattern, targetSeatCount);
  }
  
  // If we have a sequence (for repeating patterns)
  if (pattern.sequence && pattern.sequence.length > 0) {
    const detectedPattern: DetectedPattern = {
      strategy: 'repeating-sequence',
      sequence: pattern.sequence,
      confidence: 1,
      description: `Repeating: ${modesToString(pattern.sequence)}`,
    };
    return scalePattern(detectedPattern, targetSeatCount);
  }
  
  // If we have ratios
  if (pattern.ratios) {
    const detectedPattern: DetectedPattern = {
      strategy: pattern.strategy === 'ratio-contiguous' ? 'ratio-contiguous' : 'ratio-interleaved',
      ratios: pattern.ratios,
      blockOrder: pattern.blockOrder,
      confidence: 1,
      description: 'Ratio-based pattern',
    };
    return scalePattern(detectedPattern, targetSeatCount);
  }
  
  // Fallback to all default
  return Array(targetSeatCount).fill(pattern.defaultMode);
}

/**
 * Generate seat modes for RECTANGLE tables with proper growth-aware scaling
 * This is the key function that ensures non-growing sides preserve their modes
 */
export function generateRectangleSeatModes(
  pattern: SeatModePattern,
  baseSeats: RectangleSeatsConfig,
  targetSeats: RectangleSeatsConfig,
  growthConfig: RectangleGrowthConfig
): SeatMode[] {
  // Get the base modes from the pattern
  let baseModes: SeatMode[];
  
  if (isEnhancedPattern(pattern)) {
    baseModes = pattern.baseModes || [];
  } else {
    // Convert legacy pattern to get base modes
    const baseTotal = baseSeats.top + baseSeats.bottom + baseSeats.left + baseSeats.right;
    const enhanced = convertToEnhancedPattern(pattern, baseTotal);
    baseModes = enhanced.baseModes || [];
  }
  
  // Ensure we have enough base modes
  const baseTotal = baseSeats.top + baseSeats.bottom + baseSeats.left + baseSeats.right;
  if (baseModes.length < baseTotal) {
    // Extend with default mode
    const defaultMode = isEnhancedPattern(pattern) ? pattern.defaultMode : pattern.defaultMode;
    while (baseModes.length < baseTotal) {
      baseModes.push(defaultMode);
    }
  } else if (baseModes.length > baseTotal) {
    baseModes = baseModes.slice(0, baseTotal);
  }
  
  // Use the rectangle-aware scaling
  return scaleRectangleModesWithGrowth(baseModes, baseSeats, targetSeats, growthConfig);
}

/**
 * Convenience function: Create scaled modes directly from a mode array
 */
export function scaleModesFromArray(
  currentModes: SeatMode[],
  targetSeatCount: number
): SeatMode[] {
  return detectAndScale(currentModes, targetSeatCount);
}

/**
 * Get pattern information for display
 */
export function getPatternInfo(modes: SeatMode[]): DetectedPattern {
  return detectPattern(modes);
}

// ============================================================================
// RECTANGLE SEAT SCALING (Updated to use new helper)
// ============================================================================

/**
 * Scale rectangle seats based on growth configuration
 * @deprecated Use calculateScaledRectangleSeats from rectangleModeScaler instead
 */
export function scaleRectangleSeats(
  baseSeats: { top: number; bottom: number; left: number; right: number },
  growthSides: RectangleGrowthConfig,
  targetSeatCount: number
): { top: number; bottom: number; left: number; right: number } {
  return calculateScaledRectangleSeats(baseSeats, growthSides, targetSeatCount);
}

/**
 * Calculate total seats for a rectangle configuration
 */
export function calculateRectangleTotal(
  seats: { top: number; bottom: number; left: number; right: number }
): number {
  return seats.top + seats.bottom + seats.left + seats.right;
}

// ============================================================================
// MAIN TEMPLATE SCALING FUNCTION WITH CENTER-ANCHORED SUPPORT
// ============================================================================

/**
 * Scale a template to a specific seat count
 * This is the main entry point for template scaling
 * 
 * ENHANCED: Now automatically detects and applies center-anchored scaling
 * for rectangle tables where seat 1 is positioned at the center of a side
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

  // Get base seat count for pattern detection
  const baseSeatCount = getTemplateBaseSeatCount(template);

  // Handle round vs rectangle differently
  if (template.baseConfig.type === 'round') {
    // ROUND TABLE - Use standard pattern scaling
    const seatOrdering = generateOrdering(
      clampedCount,
      template.orderingDirection,
      template.orderingPattern,
      template.startPosition
    );

    const seatModes = generateSeatModes(
      template.seatModePattern, 
      clampedCount, 
      baseSeatCount
    );
    
    const patternInfo = getPatternInfo(seatModes);

    return {
      type: 'round',
      seatCount: clampedCount,
      roundSeats: clampedCount,
      seatOrdering,
      seatModes,
      patternInfo: {
        strategy: patternInfo.strategy,
        description: patternInfo.description,
      },
    };
  } else {
    // RECTANGLE TABLE - Check for center-anchored scaling
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

    // Calculate target seat distribution
    const targetSeats = calculateScaledRectangleSeats(baseSeats, growthSides, clampedCount);
    const actualTotal = calculateRectangleTotal(targetSeats);

    // ✨ NEW: Detect if this is a center-anchored template
    const isCenterAnchored = isAtCenter(template.startPosition, baseSeats);
    
    let seatOrdering: number[];
    
    if (isCenterAnchored) {
      // 🎯 Use center-anchored ordering generation
      console.log('🎯 Center-anchored scaling detected - using smart center-outward ordering');
      seatOrdering = generateCenterAnchoredOrdering(
        baseSeats,
        targetSeats,
        template.startPosition,
        template.orderingDirection,
        template.orderingPattern
      );
    } else {
      // Use standard ordering generation
      seatOrdering = generateOrdering(
        actualTotal,
        template.orderingDirection,
        template.orderingPattern,
        template.startPosition,
        targetSeats
      );
    }

    // Generate seat modes with GROWTH-AWARE scaling
    const seatModes = generateRectangleSeatModes(
      template.seatModePattern,
      baseSeats,
      targetSeats,
      growthSides
    );
    
    const patternInfo = getPatternInfo(seatModes);

    return {
      type: 'rectangle',
      seatCount: actualTotal,
      rectangleSeats: targetSeats,
      seatOrdering,
      seatModes,
      patternInfo: {
        strategy: patternInfo.strategy,
        description: patternInfo.description,
      },
    };
  }
}

// ============================================================================
// TEMPLATE VALIDATION & HELPERS
// ============================================================================

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
  
  counts.push(template.minSeats);
  
  for (let i = template.minSeats + 2; i < template.maxSeats; i += 2) {
    if (i !== base) {
      counts.push(i);
    }
  }
  
  counts.push(base);
  counts.push(template.maxSeats);
  
  return [...new Set(counts)].sort((a, b) => a - b);
}

/**
 * Create an enhanced pattern from user-configured modes
 */
export function createPatternFromModes(modes: SeatMode[]): EnhancedSeatModePattern {
  const detected = detectPattern(modes);
  const ratios = calculateRatios(modes);
  
  return {
    strategy: detected.strategy,
    baseModes: [...modes],
    detectedPattern: detected,
    sequence: detected.sequence,
    ratios,
    blockOrder: detected.blockOrder,
    defaultMode: 'default',
  };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

export default {
  // Ordering
  generateOrdering,
  generatePatternPreview,
  
  // Mode generation (enhanced)
  generateSeatModes,
  generateRectangleSeatModes,
  scaleModesFromArray,
  getPatternInfo,
  createPatternFromModes,
  
  // Rectangle helpers
  scaleRectangleSeats,
  calculateRectangleTotal,
  
  // Main scaling (now with center-anchored support)
  scaleTemplate,
  
  // Validation & helpers
  validateTemplate,
  getTemplateBaseSeatCount,
  isValidSeatCount,
  getSuggestedSeatCounts,
};