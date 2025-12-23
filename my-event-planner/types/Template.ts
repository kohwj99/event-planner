// types/Template.ts
// Template type definitions for reusable table configurations

import { SeatMode } from './Seat';
import { EventType } from './Event';

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

/**
 * Seat mode pattern for templates
 * Can be a repeating pattern or specific positions
 */
export interface SeatModePattern {
  // 'repeating' = pattern repeats as seats scale
  // 'alternating' = alternates between modes
  // 'specific' = specific positions have specific modes
  type: 'repeating' | 'alternating' | 'specific';
  
  // For repeating pattern - this pattern repeats around the table
  pattern?: SeatMode[];
  
  // For alternating - the two modes to alternate between
  alternatingModes?: [SeatMode, SeatMode];
  
  // For specific - map of position index to mode
  specificModes?: Record<number, SeatMode>;
  
  // Default mode for unspecified seats
  defaultMode: SeatMode;
}

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
  orderingPattern: OrderingPattern; // 'sequential', 'alternating', or 'opposite'
  startPosition: number; // 0 = top/first position
  
  // Seat mode pattern
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
  
  // Computed seat modes
  seatModes: SeatMode[];
}

/**
 * Default seat mode patterns for quick selection
 */
export const DEFAULT_MODE_PATTERNS: Record<string, SeatModePattern> = {
  allDefault: {
    type: 'repeating',
    pattern: ['default'],
    defaultMode: 'default',
  },
  alternatingHostExternal: {
    type: 'alternating',
    alternatingModes: ['host-only', 'external-only'],
    defaultMode: 'default',
  },
  hostOnlyFirst: {
    type: 'specific',
    specificModes: { 0: 'host-only' },
    defaultMode: 'default',
  },
  externalOnlyFirst: {
    type: 'specific',
    specificModes: { 0: 'external-only' },
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