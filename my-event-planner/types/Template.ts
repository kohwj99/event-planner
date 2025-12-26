// types/Template.ts
// Template type definitions for reusable table configurations
// ENHANCED with intelligent pattern detection and scaling

import { SeatMode } from './Seat';
import { EventType } from './Event';
import { DetectedPattern, PatternStrategy } from '@/utils/patternDetector';

export type Direction = 'clockwise' | 'counter-clockwise';

/**
 * Ordering pattern type
 * - 'sequential': Simple 1, 2, 3, 4... in direction
 * - 'alternating': Seat 1 at start, evens go one way, odds go the other
 * - 'opposite': Seat 1 faces Seat 2 (across table), Seat 3 next to Seat 1, Seat 4 opposite Seat 3, etc.
 */
export type OrderingPattern = 'sequential' | 'alternating' | 'opposite';

/**
 * Growth configuration for rectangle tables
 * Determines which sides can grow when scaling the template
 */
export interface RectangleGrowthConfig {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Base configuration for a table template
 */
export interface TemplateBaseConfig {
  type: 'round' | 'rectangle';
  
  // For round tables
  baseSeatCount?: number;
  
  // For rectangle tables
  baseSeats?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  
  // Growth configuration for rectangles (which sides can grow)
  growthSides?: RectangleGrowthConfig;
}

// ============================================================================
// ENHANCED SEAT MODE PATTERN SYSTEM
// ============================================================================

/**
 * LEGACY: Original pattern type (kept for backward compatibility)
 * @deprecated Use EnhancedSeatModePattern instead
 */
export interface LegacySeatModePattern {
  type: 'repeating' | 'alternating' | 'specific';
  pattern?: SeatMode[];
  alternatingModes?: [SeatMode, SeatMode];
  specificModes?: Record<number, SeatMode>;
  defaultMode: SeatMode;
}

/**
 * ENHANCED: New pattern system with intelligent scaling
 * 
 * The system detects the pattern type from the base configuration
 * and intelligently scales when seat count changes.
 */
export interface EnhancedSeatModePattern {
  // The detected strategy for scaling
  strategy: PatternStrategy;
  
  // The base seat modes at the template's base seat count
  // This is the source of truth for the pattern
  baseModes: SeatMode[];
  
  // Cached detected pattern information (regenerated when baseModes change)
  detectedPattern?: DetectedPattern;
  
  // For repeating-sequence: the minimal repeating unit
  sequence?: SeatMode[];
  
  // For ratio-based patterns: the proportion of each mode
  ratios?: {
    'host-only': number;
    'external-only': number;
    'default': number;
  };
  
  // For ratio-contiguous: the order of mode blocks
  blockOrder?: SeatMode[];
  
  // Default mode for fallback
  defaultMode: SeatMode;
}

/**
 * Union type supporting both legacy and enhanced patterns
 */
export type SeatModePattern = LegacySeatModePattern | EnhancedSeatModePattern;

/**
 * Type guard to check if a pattern is enhanced
 */
export function isEnhancedPattern(pattern: SeatModePattern): pattern is EnhancedSeatModePattern {
  return 'strategy' in pattern && 'baseModes' in pattern;
}

/**
 * Convert legacy pattern to enhanced pattern
 */
export function convertToEnhancedPattern(
  legacy: LegacySeatModePattern,
  baseSeatCount: number
): EnhancedSeatModePattern {
  let baseModes: SeatMode[] = [];
  
  switch (legacy.type) {
    case 'repeating':
      if (legacy.pattern && legacy.pattern.length > 0) {
        // Repeat the pattern to fill base seat count
        for (let i = 0; i < baseSeatCount; i++) {
          baseModes.push(legacy.pattern[i % legacy.pattern.length]);
        }
        return {
          strategy: 'repeating-sequence',
          baseModes,
          sequence: legacy.pattern,
          defaultMode: legacy.defaultMode,
        };
      }
      break;
      
    case 'alternating':
      if (legacy.alternatingModes) {
        for (let i = 0; i < baseSeatCount; i++) {
          baseModes.push(legacy.alternatingModes[i % 2]);
        }
        return {
          strategy: 'repeating-sequence',
          baseModes,
          sequence: [...legacy.alternatingModes],
          defaultMode: legacy.defaultMode,
        };
      }
      break;
      
    case 'specific':
      baseModes = Array(baseSeatCount).fill(legacy.defaultMode);
      if (legacy.specificModes) {
        Object.entries(legacy.specificModes).forEach(([pos, mode]) => {
          const index = parseInt(pos, 10);
          if (index >= 0 && index < baseSeatCount) {
            baseModes[index] = mode;
          }
        });
      }
      return {
        strategy: 'custom',
        baseModes,
        defaultMode: legacy.defaultMode,
      };
  }
  
  // Fallback
  return {
    strategy: 'uniform',
    baseModes: Array(baseSeatCount).fill(legacy.defaultMode),
    defaultMode: legacy.defaultMode,
  };
}

// ============================================================================
// COMPLETE TABLE TEMPLATE DEFINITION
// ============================================================================

/**
 * Complete table template definition
 */
export interface TableTemplate {
  id: string;
  name: string;
  description: string;
  
  // Session types this template is recommended for
  sessionTypes: EventType[];
  
  // Whether this is a built-in system template (cannot be deleted)
  isBuiltIn: boolean;
  
  // Whether this template was created by the user
  isUserCreated: boolean;
  
  // Template thumbnail/preview color (for visual distinction)
  color?: string;
  
  // Base configuration
  baseConfig: TemplateBaseConfig;
  
  // Ordering configuration
  orderingDirection: Direction;
  orderingPattern: OrderingPattern;
  startPosition: number; // 0 = top/first position
  
  // Seat mode pattern (supports both legacy and enhanced)
  seatModePattern: SeatModePattern;
  
  // Scaling limits
  minSeats: number;
  maxSeats: number;
  
  // Created/updated timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Template creation input (without system fields)
 */
export type CreateTemplateInput = Omit<
  TableTemplate, 
  'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'
>;

/**
 * Template update input
 */
export type UpdateTemplateInput = Partial<Omit<
  TableTemplate, 
  'id' | 'isBuiltIn' | 'createdAt'
>>;

/**
 * Configuration for creating tables from a template
 */
export interface TemplateTableConfig {
  templateId: string;
  seatCount: number;
  quantity: number;
  label?: string;
}

/**
 * Result of scaling a template to a specific seat count
 */
export interface ScaledTemplateResult {
  type: 'round' | 'rectangle';
  seatCount: number;
  
  // For round tables
  roundSeats?: number;
  
  // For rectangle tables
  rectangleSeats?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  
  // Computed ordering
  seatOrdering: number[];
  
  // Computed seat modes (intelligently scaled)
  seatModes: SeatMode[];
  
  // Pattern information for display
  patternInfo?: {
    strategy: PatternStrategy;
    description: string;
  };
}

// ============================================================================
// DEFAULT PATTERNS (using enhanced format)
// ============================================================================

/**
 * Default seat mode patterns for quick selection
 */
export const DEFAULT_MODE_PATTERNS: Record<string, EnhancedSeatModePattern> = {
  allDefault: {
    strategy: 'uniform',
    baseModes: ['default'],
    defaultMode: 'default',
  },
  alternatingHostExternal: {
    strategy: 'repeating-sequence',
    baseModes: ['host-only', 'external-only'],
    sequence: ['host-only', 'external-only'],
    defaultMode: 'default',
  },
  hostOnlyFirst: {
    strategy: 'custom',
    baseModes: ['host-only', 'default'],
    defaultMode: 'default',
  },
  externalOnlyFirst: {
    strategy: 'custom',
    baseModes: ['external-only', 'default'],
    defaultMode: 'default',
  },
  fiftyFiftyInterleaved: {
    strategy: 'ratio-interleaved',
    baseModes: ['host-only', 'external-only'],
    ratios: { 'host-only': 0.5, 'external-only': 0.5, 'default': 0 },
    defaultMode: 'default',
  },
  fiftyFiftyContiguous: {
    strategy: 'ratio-contiguous',
    baseModes: ['host-only', 'host-only', 'external-only', 'external-only'],
    ratios: { 'host-only': 0.5, 'external-only': 0.5, 'default': 0 },
    blockOrder: ['host-only', 'external-only'],
    defaultMode: 'default',
  },
};

/**
 * Session type to color mapping for templates
 */
export const SESSION_TYPE_COLORS: Record<EventType, string> = {
  'Executive meeting': '#1e40af',
  'Bilateral Meeting': '#047857',
  'Meal': '#c2410c',
  'Phototaking': '#6b21a8',
};

/**
 * Session type descriptions
 */
export const SESSION_TYPE_DESCRIPTIONS: Record<EventType, string> = {
  'Executive meeting': 'Formal meetings with VIP seating priority',
  'Bilateral Meeting': 'One-on-one or small group discussions',
  'Meal': 'Dining arrangements with meal plan considerations',
  'Phototaking': 'Photo session arrangements',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create an enhanced pattern from an array of modes
 * Automatically detects the pattern type
 */
export function createEnhancedPatternFromModes(modes: SeatMode[]): EnhancedSeatModePattern {
  // Import dynamically to avoid circular dependencies
  // In actual use, detectPattern will be imported from patternDetector
  const defaultMode: SeatMode = modes.length > 0 
    ? modes.reduce((acc, m) => {
        const counts: Record<SeatMode, number> = { 'host-only': 0, 'external-only': 0, 'default': 0 };
        modes.forEach(mode => counts[mode]++);
        return counts[m] > counts[acc] ? m : acc;
      }, modes[0])
    : 'default';
  
  return {
    strategy: 'custom', // Will be properly detected by templateScaler
    baseModes: [...modes],
    defaultMode,
  };
}

/**
 * Get pattern description for display
 */
export function getPatternDescription(pattern: SeatModePattern): string {
  if (isEnhancedPattern(pattern)) {
    if (pattern.detectedPattern?.description) {
      return pattern.detectedPattern.description;
    }
    
    // Generate basic description
    const modeStr = pattern.baseModes
      .map(m => m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D')
      .join('');
    
    return `Pattern: ${modeStr}`;
  }
  
  // Legacy pattern
  switch (pattern.type) {
    case 'repeating':
      return pattern.pattern 
        ? `Repeating: ${pattern.pattern.map(m => m[0].toUpperCase()).join('')}`
        : 'All default';
    case 'alternating':
      return pattern.alternatingModes
        ? `Alternating: ${pattern.alternatingModes[0][0].toUpperCase()}/${pattern.alternatingModes[1][0].toUpperCase()}`
        : 'Alternating';
    case 'specific':
      return 'Specific positions';
    default:
      return 'Custom pattern';
  }
}