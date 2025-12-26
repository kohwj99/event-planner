// utils/patternDetector.ts
// Intelligent pattern detection for seat mode configurations
// Analyzes user-configured seat modes and identifies the underlying pattern

import { SeatMode } from '@/types/Seat';

// ============================================================================
// PATTERN STRATEGY TYPES
// ============================================================================

export type PatternStrategy = 
  | 'repeating-sequence'  // A sequence that repeats: HHEEDD, HHEEDD, ...
  | 'ratio-interleaved'   // Maintains ratio with interleaving: HEHE or HHEHHE
  | 'ratio-contiguous'    // Maintains ratio with blocks: HHHHEEEE (first half H, second half E)
  | 'uniform'             // All seats same mode
  | 'custom';             // Irregular pattern - preserve positions proportionally

export interface ModeRatios {
  'host-only': number;
  'external-only': number;
  'default': number;
}

export interface DetectedPattern {
  strategy: PatternStrategy;
  
  // For repeating-sequence: the minimal repeating unit
  sequence?: SeatMode[];
  
  // For ratio-based patterns: the proportion of each mode
  ratios?: ModeRatios;
  
  // For ratio-contiguous: the order of mode blocks (e.g., ['host-only', 'external-only'])
  blockOrder?: SeatMode[];
  
  // For custom: the original modes for proportional scaling
  originalModes?: SeatMode[];
  
  // Confidence score (0-1) for pattern detection
  confidence: number;
  
  // Human-readable description
  description: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the ratios of each mode in the array
 */
export function calculateRatios(modes: SeatMode[]): ModeRatios {
  const counts = {
    'host-only': 0,
    'external-only': 0,
    'default': 0,
  };
  
  modes.forEach(mode => {
    counts[mode]++;
  });
  
  const total = modes.length || 1;
  
  return {
    'host-only': counts['host-only'] / total,
    'external-only': counts['external-only'] / total,
    'default': counts['default'] / total,
  };
}

/**
 * Check if all elements in the array are the same
 */
function isUniform(modes: SeatMode[]): boolean {
  if (modes.length === 0) return true;
  return modes.every(m => m === modes[0]);
}

/**
 * Find the Greatest Common Divisor of two numbers
 */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Find the GCD of an array of numbers
 */
function gcdArray(arr: number[]): number {
  return arr.reduce((acc, val) => gcd(acc, val), arr[0] || 1);
}

/**
 * Try to find the minimal repeating unit in a sequence
 * Returns null if no clean repeating pattern is found
 */
export function findRepeatingUnit(modes: SeatMode[]): SeatMode[] | null {
  const n = modes.length;
  if (n === 0) return null;
  if (n === 1) return [...modes];
  
  // Try all possible unit lengths from 1 to n/2
  for (let unitLen = 1; unitLen <= n / 2; unitLen++) {
    // Unit length must divide evenly into total length for a clean repeat
    if (n % unitLen !== 0) continue;
    
    const unit = modes.slice(0, unitLen);
    let isRepeating = true;
    
    // Check if this unit repeats throughout the entire array
    for (let i = unitLen; i < n; i++) {
      if (modes[i] !== unit[i % unitLen]) {
        isRepeating = false;
        break;
      }
    }
    
    if (isRepeating) {
      // Found the minimal repeating unit
      return unit;
    }
  }
  
  // No clean repeating pattern found
  return null;
}

/**
 * Check if a pattern is "interleaved" - modes are distributed throughout
 * rather than grouped in contiguous blocks
 * 
 * Interleaved: H,E,H,E,H,E or H,H,E,E,H,H,E,E (small groups repeating)
 * Contiguous: H,H,H,H,E,E,E,E (large blocks)
 */
export function isInterleaved(modes: SeatMode[]): boolean {
  if (modes.length < 4) return true; // Small arrays are considered interleaved
  
  // Count transitions between different modes
  let transitions = 0;
  for (let i = 1; i < modes.length; i++) {
    if (modes[i] !== modes[i - 1]) {
      transitions++;
    }
  }
  
  // If transitions are frequent (more than 1/4 of the length), it's interleaved
  // For perfectly interleaved (H,E,H,E), transitions = length - 1
  // For contiguous (HHHH,EEEE), transitions = number of distinct modes - 1
  const uniqueModes = new Set(modes).size;
  const minTransitions = uniqueModes - 1;
  const maxTransitions = modes.length - 1;
  
  // Normalize: 0 = perfectly contiguous, 1 = perfectly interleaved
  const interleavingScore = (transitions - minTransitions) / (maxTransitions - minTransitions || 1);
  
  return interleavingScore > 0.3; // Threshold for considering it interleaved
}

/**
 * Check if a pattern is contiguous (modes grouped in blocks)
 */
export function isContiguous(modes: SeatMode[]): boolean {
  return !isInterleaved(modes);
}

/**
 * Detect the order of contiguous blocks
 * For HHHHEEEEDD returns ['host-only', 'external-only', 'default']
 */
export function detectBlockOrder(modes: SeatMode[]): SeatMode[] {
  const order: SeatMode[] = [];
  let currentMode: SeatMode | null = null;
  
  for (const mode of modes) {
    if (mode !== currentMode) {
      order.push(mode);
      currentMode = mode;
    }
  }
  
  return order;
}

/**
 * Calculate interleaving group size
 * For H,H,E,E,H,H,E,E returns 2 (groups of 2)
 * For H,E,H,E returns 1
 */
export function detectGroupSize(modes: SeatMode[]): number {
  const repeatingUnit = findRepeatingUnit(modes);
  if (!repeatingUnit) return 1;
  
  // Find the group size within the repeating unit
  let groupSize = 1;
  for (let i = 1; i < repeatingUnit.length; i++) {
    if (repeatingUnit[i] === repeatingUnit[0]) {
      groupSize++;
    } else {
      break;
    }
  }
  
  return groupSize;
}

// ============================================================================
// MAIN PATTERN DETECTION
// ============================================================================

/**
 * Analyze a seat mode configuration and detect the underlying pattern
 */
export function detectPattern(modes: SeatMode[]): DetectedPattern {
  if (modes.length === 0) {
    return {
      strategy: 'uniform',
      ratios: { 'host-only': 0, 'external-only': 0, 'default': 1 },
      confidence: 1,
      description: 'Empty pattern (all default)',
    };
  }
  
  // 1. Check for uniform pattern (all same mode)
  if (isUniform(modes)) {
    return {
      strategy: 'uniform',
      ratios: calculateRatios(modes),
      confidence: 1,
      description: `All seats: ${modes[0]}`,
    };
  }
  
  // 2. Try to find a repeating sequence
  const repeatingUnit = findRepeatingUnit(modes);
  if (repeatingUnit && repeatingUnit.length < modes.length) {
    // Found a clean repeating pattern
    const groupSize = detectGroupSize(modes);
    const ratios = calculateRatios(modes);
    
    // Describe the pattern
    const unitDescription = repeatingUnit
      .map(m => m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D')
      .join(',');
    
    return {
      strategy: 'repeating-sequence',
      sequence: repeatingUnit,
      ratios,
      confidence: 1,
      description: `Repeating pattern: (${unitDescription}) × ${modes.length / repeatingUnit.length}`,
    };
  }
  
  // 3. Analyze if it's ratio-based (interleaved or contiguous)
  const ratios = calculateRatios(modes);
  const hasMultipleModes = Object.values(ratios).filter(r => r > 0).length > 1;
  
  if (hasMultipleModes) {
    if (isContiguous(modes)) {
      // Contiguous blocks pattern
      const blockOrder = detectBlockOrder(modes);
      const blockDescription = blockOrder
        .map(m => m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D')
        .join(' → ');
      
      const ratioStr = Object.entries(ratios)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `${Math.round(v * 100)}% ${k === 'host-only' ? 'H' : k === 'external-only' ? 'E' : 'D'}`)
        .join(', ');
      
      return {
        strategy: 'ratio-contiguous',
        ratios,
        blockOrder,
        confidence: 0.9,
        description: `Contiguous blocks (${blockDescription}): ${ratioStr}`,
      };
    } else {
      // Interleaved pattern
      const ratioStr = Object.entries(ratios)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `${Math.round(v * 100)}% ${k === 'host-only' ? 'H' : k === 'external-only' ? 'E' : 'D'}`)
        .join(', ');
      
      return {
        strategy: 'ratio-interleaved',
        ratios,
        confidence: 0.85,
        description: `Interleaved distribution: ${ratioStr}`,
      };
    }
  }
  
  // 4. Fallback to custom pattern
  return {
    strategy: 'custom',
    ratios: calculateRatios(modes),
    originalModes: [...modes],
    confidence: 0.7,
    description: 'Custom pattern (will scale proportionally)',
  };
}

/**
 * Generate a human-readable pattern summary for UI display
 */
export function getPatternSummary(modes: SeatMode[]): string {
  const pattern = detectPattern(modes);
  return pattern.description;
}

/**
 * Check if two patterns are equivalent
 */
export function patternsAreEquivalent(a: SeatMode[], b: SeatMode[]): boolean {
  const patternA = detectPattern(a);
  const patternB = detectPattern(b);
  
  if (patternA.strategy !== patternB.strategy) return false;
  
  if (patternA.strategy === 'repeating-sequence' && patternB.strategy === 'repeating-sequence') {
    // Compare sequences
    if (!patternA.sequence || !patternB.sequence) return false;
    if (patternA.sequence.length !== patternB.sequence.length) return false;
    return patternA.sequence.every((m, i) => m === patternB.sequence![i]);
  }
  
  if (patternA.ratios && patternB.ratios) {
    // Compare ratios (with tolerance)
    const tolerance = 0.05;
    return (
      Math.abs(patternA.ratios['host-only'] - patternB.ratios['host-only']) < tolerance &&
      Math.abs(patternA.ratios['external-only'] - patternB.ratios['external-only']) < tolerance &&
      Math.abs(patternA.ratios['default'] - patternB.ratios['default']) < tolerance
    );
  }
  
  return false;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  detectPattern,
  findRepeatingUnit,
  calculateRatios,
  isInterleaved,
  isContiguous,
  detectBlockOrder,
  detectGroupSize,
  getPatternSummary,
  patternsAreEquivalent,
};