// types/TemplateV2.ts
// V2 Template System - COMPLETELY INDEPENDENT from V1
// Clean separation between Circle and Rectangle templates
// Features: Scaling direction controls, allocation strategies, no min/max constraints

// ============================================================================
// SHARED TYPE RE-EXPORTS (from your existing types)
// ============================================================================

// Re-export SeatMode from Seat.ts - this is a shared type, not V1-specific
export type SeatMode = 'default' | 'host-only' | 'external-only';

// Re-export EventType from Event.ts - this is a shared type, not V1-specific
export type EventType = 'Executive meeting' | 'Bilateral Meeting' | 'Meal' | 'Phototaking';

// ============================================================================
// V2 CORE ENUMS AND TYPES
// ============================================================================

/**
 * Direction for seat ordering traversal
 */
export type DirectionV2 = 'clockwise' | 'counter-clockwise';

/**
 * Ordering pattern types
 * - 'sequential': Simple 1, 2, 3, 4... in direction
 * - 'alternating': Seat 1 at start, evens go one way, odds go the other  
 * - 'opposite': Seat 1 faces Seat 2 across table, Seat 3 next to Seat 1, etc.
 * - 'center-outward': Seat 1 at center, then alternating outward
 * - 'manual': User-defined ordering (stored explicitly)
 */
export type OrderingPatternTypeV2 = 'sequential' | 'alternating' | 'opposite' | 'center-outward' | 'manual';

/**
 * Seat mode pattern types
 * - 'uniform': All seats have the same mode
 * - 'alternating': Modes alternate (e.g., H, E, H, E)
 * - 'repeating': A sequence repeats (e.g., H, H, E, E, H, H, E, E)
 * - 'ratio': Maintains ratio distribution (e.g., 50% H, 50% E)
 * - 'per-side': Different mode configuration per side (rectangle only)
 * - 'manual': User-defined modes (stored explicitly per seat)
 */
export type ModePatternTypeV2 = 'uniform' | 'alternating' | 'repeating' | 'ratio' | 'per-side' | 'manual';

/**
 * Allocation strategy for multi-side scaling
 * - 'round-robin': Sides take turns receiving new seats based on priority
 * - 'proportional': Seats distributed based on current proportions
 * - 'priority': Seats added to highest priority side first until full
 */
export type AllocationStrategyV2 = 'round-robin' | 'proportional' | 'priority';

// ============================================================================
// SEAT ORDERING PATTERN
// ============================================================================

/**
 * Configuration for seat ordering patterns
 */
export interface SeatOrderingPatternV2 {
  type: OrderingPatternTypeV2;
  direction: DirectionV2;
  
  // Which position is seat #1 (0-indexed from top/start)
  startPosition: number;
  
  // For 'manual' pattern: explicit ordering array
  // Index = physical position, Value = seat number
  manualOrdering?: number[];
}

// ============================================================================
// SEAT MODE PATTERN
// ============================================================================

/**
 * Configuration for seat mode patterns
 */
export interface SeatModePatternV2 {
  type: ModePatternTypeV2;
  defaultMode: SeatMode;
  
  // For 'alternating': the two modes to alternate between
  alternatingModes?: [SeatMode, SeatMode];
  
  // For 'repeating': the sequence to repeat
  repeatingSequence?: SeatMode[];
  
  // For 'ratio': the desired ratio of each mode (should sum to 1)
  ratios?: {
    'host-only': number;
    'external-only': number;
    'default': number;
  };
  
  // For 'manual': explicit modes per position
  manualModes?: SeatMode[];
}

// ============================================================================
// RECTANGLE SIDE CONFIGURATION
// ============================================================================

/**
 * Configuration for one side of a rectangle table
 */
export interface RectangleSideConfigV2 {
  // Number of seats on this side (base configuration)
  seatCount: number;
  
  // Whether this side participates in scaling
  scalable: boolean;
  
  // Whether this side is enabled (false = no seats regardless of seatCount)
  enabled: boolean;
  
  // Priority for seat allocation across sides (lower = higher priority, receives seats first)
  allocationPriority: number;
  
  // Manual modes for this side only
  manualSideModes?: SeatMode[];
}

/**
 * Defines which edge of which side receives a new seat during scaling
 * For horizontal sides (top/bottom): 'start' = left edge, 'end' = right edge
 * For vertical sides (left/right): 'start' = top edge, 'end' = bottom edge
 */
export interface InsertionPointV2 {
  side: SideKeyV2;
  edge: 'start' | 'end';
}

/**
 * Complete configuration for all 4 sides of a rectangle table
 * 
 * Visual representation (looking down at table):
 * 
 *           TOP (seats face down ↓)
 *         [0] [1] [2] [3] →
 *    LEFT                    RIGHT
 *    [0]↓                    ↓[0]
 *    [1]                      [1]
 *    [2]                      [2]
 *         ← [3] [2] [1] [0]
 *          BOTTOM (seats face up ↑)
 */
export interface RectangleSidesConfigV2 {
  top: RectangleSideConfigV2;
  right: RectangleSideConfigV2;
  bottom: RectangleSideConfigV2;
  left: RectangleSideConfigV2;
}

/**
 * Scaling configuration for rectangle tables
 */
export interface RectangleScalingConfigV2 {
  // Strategy for distributing new seats across sides
  allocationStrategy: AllocationStrategyV2;
  
  // Whether to alternate between opposite sides (top↔bottom, left↔right)
  alternateOppositeSides: boolean;
  
  // Global insertion order: defines the sequence of edges where new seats are added
  // This pattern repeats as the table scales up
  // Example: [{ side: 'bottom', edge: 'start' }, { side: 'top', edge: 'start' }]
  // means seats alternate between bottom-left and top-left edges
  insertionOrder?: InsertionPointV2[];
}

// ============================================================================
// CIRCLE TABLE CONFIG
// ============================================================================

/**
 * Configuration for circle/round tables
 */
export interface CircleTableConfigV2 {
  type: 'circle';
  
  // Base number of seats (initial configuration)
  baseSeatCount: number;
  
  // Seat ordering pattern
  orderingPattern: SeatOrderingPatternV2;
  
  // Seat mode pattern
  modePattern: SeatModePatternV2;
}

// ============================================================================
// RECTANGLE TABLE CONFIG
// ============================================================================

/**
 * Configuration for rectangle tables
 */
export interface RectangleTableConfigV2 {
  type: 'rectangle';
  
  // Configuration for each side
  sides: RectangleSidesConfigV2;
  
  // Scaling configuration
  scalingConfig: RectangleScalingConfigV2;
  
  // Seat ordering pattern
  orderingPattern: SeatOrderingPatternV2;
  
  // Seat mode pattern
  modePattern: SeatModePatternV2;
}

// ============================================================================
// UNIFIED TABLE CONFIG
// ============================================================================

export type TableConfigV2 = CircleTableConfigV2 | RectangleTableConfigV2;

// ============================================================================
// TABLE TEMPLATE V2
// ============================================================================

/**
 * Complete table template definition
 */
export interface TableTemplateV2 {
  id: string;
  name: string;
  description: string;
  
  // Session types this template is recommended for
  sessionTypes: EventType[];
  
  // Whether this is a built-in system template
  isBuiltIn: boolean;
  
  // Whether this template was created by the user
  isUserCreated: boolean;
  
  // Template color for display
  color?: string;
  
  // The actual configuration
  config: TableConfigV2;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new template
 */
export interface CreateTemplateInputV2 {
  name: string;
  description: string;
  sessionTypes: EventType[];
  isUserCreated: boolean;
  color?: string;
  config: TableConfigV2;
}

/**
 * Input for updating a template
 */
export interface UpdateTemplateInputV2 {
  name?: string;
  description?: string;
  sessionTypes?: EventType[];
  color?: string;
  config?: TableConfigV2;
}

// ============================================================================
// SCALED RESULT TYPES
// ============================================================================

/**
 * Individual seat info in scaled result
 */
export interface ScaledSeatV2 {
  position: number;
  seatNumber: number;
  mode: SeatMode;
}

/**
 * Side seat info for rectangles
 */
export interface SideSeatV2 {
  positionOnSide: number;
  seatNumber: number;
  mode: SeatMode;
}

/**
 * Result of scaling a circle template
 */
export interface ScaledCircleResultV2 {
  type: 'circle';
  seatCount: number;
  seats: ScaledSeatV2[];
  seatOrdering: number[];
  seatModes: SeatMode[];
}

/**
 * Result of scaling a rectangle template
 */
export interface ScaledRectangleResultV2 {
  type: 'rectangle';
  seatCount: number;
  sideSeats: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  sides: {
    top: SideSeatV2[];
    right: SideSeatV2[];
    bottom: SideSeatV2[];
    left: SideSeatV2[];
  };
  seatOrdering: number[];
  seatModes: SeatMode[];
}

export type ScaledResultV2 = ScaledCircleResultV2 | ScaledRectangleResultV2;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isCircleConfigV2(config: TableConfigV2): config is CircleTableConfigV2 {
  return config.type === 'circle';
}

export function isRectangleConfigV2(config: TableConfigV2): config is RectangleTableConfigV2 {
  return config.type === 'rectangle';
}

export function isCircleResultV2(result: ScaledResultV2): result is ScaledCircleResultV2 {
  return result.type === 'circle';
}

export function isRectangleResultV2(result: ScaledResultV2): result is ScaledRectangleResultV2 {
  return result.type === 'rectangle';
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createDefaultSideConfigV2(
  seatCount: number,
  scalable: boolean = true,
  enabled: boolean = true,
  allocationPriority: number = 0
): RectangleSideConfigV2 {
  return {
    seatCount,
    scalable,
    enabled,
    allocationPriority,
  };
}

export function createDefaultCircleConfigV2(seatCount: number = 8): CircleTableConfigV2 {
  return {
    type: 'circle',
    baseSeatCount: seatCount,
    orderingPattern: {
      type: 'sequential',
      direction: 'clockwise',
      startPosition: 0,
    },
    modePattern: {
      type: 'uniform',
      defaultMode: 'default',
    },
  };
}

export function createDefaultRectangleConfigV2(
  top: number = 3,
  bottom: number = 3,
  left: number = 1,
  right: number = 1
): RectangleTableConfigV2 {
  return {
    type: 'rectangle',
    sides: {
      top: createDefaultSideConfigV2(top, true, true, 0),
      right: createDefaultSideConfigV2(right, false, right > 0, 2),
      bottom: createDefaultSideConfigV2(bottom, true, true, 1),
      left: createDefaultSideConfigV2(left, false, left > 0, 3),
    },
    scalingConfig: {
      allocationStrategy: 'round-robin',
      alternateOppositeSides: true,
    },
    orderingPattern: {
      type: 'sequential',
      direction: 'clockwise',
      startPosition: 0,
    },
    modePattern: {
      type: 'uniform',
      defaultMode: 'default',
    },
  };
}

export function createBilateralConfigV2(seatsPerSide: number = 4): RectangleTableConfigV2 {
  return {
    type: 'rectangle',
    sides: {
      top: {
        seatCount: seatsPerSide,
        scalable: true,
        enabled: true,
        allocationPriority: 0,
      },
      right: createDefaultSideConfigV2(0, false, false, 2),
      bottom: {
        seatCount: seatsPerSide,
        scalable: true,
        enabled: true,
        allocationPriority: 1,
      },
      left: createDefaultSideConfigV2(0, false, false, 3),
    },
    scalingConfig: {
      allocationStrategy: 'round-robin',
      alternateOppositeSides: true,
    },
    orderingPattern: {
      type: 'opposite',
      direction: 'clockwise',
      startPosition: 0,
    },
    modePattern: {
      type: 'uniform',
      defaultMode: 'default',
    },
  };
}

export function createDefaultTemplateV2(
  type: 'circle' | 'rectangle',
  name: string = 'New Template'
): TableTemplateV2 {
  const now = new Date().toISOString();
  
  return {
    id: `template-v2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: '',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: false,
    isUserCreated: true,
    config: type === 'circle' 
      ? createDefaultCircleConfigV2()
      : createDefaultRectangleConfigV2(),
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getTotalSeatCountV2(config: TableConfigV2): number {
  if (isCircleConfigV2(config)) {
    return config.baseSeatCount;
  } else {
    const { sides } = config;
    return (
      (sides.top.enabled ? sides.top.seatCount : 0) +
      (sides.right.enabled ? sides.right.seatCount : 0) +
      (sides.bottom.enabled ? sides.bottom.seatCount : 0) +
      (sides.left.enabled ? sides.left.seatCount : 0)
    );
  }
}

export type SideKeyV2 = 'top' | 'right' | 'bottom' | 'left';

export function getScalableSidesV2(config: RectangleTableConfigV2): SideKeyV2[] {
  const { sides } = config;
  const scalable: SideKeyV2[] = [];
  if (sides.top.scalable && sides.top.enabled) scalable.push('top');
  if (sides.right.scalable && sides.right.enabled) scalable.push('right');
  if (sides.bottom.scalable && sides.bottom.enabled) scalable.push('bottom');
  if (sides.left.scalable && sides.left.enabled) scalable.push('left');
  return scalable;
}

export function getSidesByPriorityV2(config: RectangleTableConfigV2): SideKeyV2[] {
  const scalable = getScalableSidesV2(config);
  return scalable.sort((a, b) => 
    config.sides[a].allocationPriority - config.sides[b].allocationPriority
  );
}

export function validateTemplateV2(template: TableTemplateV2): string[] {
  const errors: string[] = [];
  
  if (!template.name?.trim()) {
    errors.push('Template name is required');
  }
  
  const config = template.config;
  const totalSeats = getTotalSeatCountV2(config);
  
  if (totalSeats < 2) {
    errors.push('Table must have at least 2 seats');
  }
  
  if (isRectangleConfigV2(config)) {
    const enabledSides = (['top', 'right', 'bottom', 'left'] as SideKeyV2[]).filter(
      side => config.sides[side].enabled
    );
    if (enabledSides.length === 0) {
      errors.push('At least one side must be enabled');
    }
  }
  
  if (!template.sessionTypes || template.sessionTypes.length === 0) {
    errors.push('At least one session type must be selected');
  }
  
  return errors;
}

// ============================================================================
// SCALING HELPERS
// ============================================================================

/**
 * Add a seat to a side at a specific edge
 * @param currentSeats Current seat modes array for the side
 * @param edge Which edge to add the seat ('start' = left/top, 'end' = right/bottom)
 * @param defaultMode Mode for the new seat
 */
export function addSeatAtEdgeV2(
  currentSeats: SeatMode[],
  edge: 'start' | 'end',
  defaultMode: SeatMode = 'default'
): SeatMode[] {
  const newSeats = [...currentSeats];
  if (edge === 'start') {
    newSeats.unshift(defaultMode);
  } else {
    newSeats.push(defaultMode);
  }
  return newSeats;
}

/**
 * Get default insertion order for scalable sides (alternates between sides)
 */
export function getDefaultInsertionOrderV2(scalableSides: SideKeyV2[]): InsertionPointV2[] {
  const order: InsertionPointV2[] = [];
  
  for (const side of scalableSides) {
    order.push({ side, edge: 'start' });
    order.push({ side, edge: 'end' });
  }
  
  return order;
}

/**
 * Get the edge label for display
 */
export function getEdgeLabelV2(side: SideKeyV2, edge: 'start' | 'end'): string {
  const isHorizontal = side === 'top' || side === 'bottom';
  if (isHorizontal) {
    return edge === 'start' ? 'Left' : 'Right';
  } else {
    return edge === 'start' ? 'Top' : 'Bottom';
  }
}

/**
 * Get full label for an insertion point
 */
export function getInsertionPointLabelV2(point: InsertionPointV2): string {
  const sideLabel = point.side.charAt(0).toUpperCase() + point.side.slice(1);
  const edgeLabel = getEdgeLabelV2(point.side, point.edge);
  return `${sideLabel}-${edgeLabel}`;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SESSION_TYPE_COLORS_V2: Record<EventType, string> = {
  'Executive meeting': '#1976d2',
  'Bilateral Meeting': '#7b1fa2',
  'Meal': '#388e3c',
  'Phototaking': '#f57c00',
};

export const ORDERING_PRESETS_V2 = {
  sequentialClockwise: { type: 'sequential' as const, direction: 'clockwise' as const },
  sequentialCounterClockwise: { type: 'sequential' as const, direction: 'counter-clockwise' as const },
  alternatingClockwise: { type: 'alternating' as const, direction: 'clockwise' as const },
  alternatingCounterClockwise: { type: 'alternating' as const, direction: 'counter-clockwise' as const },
  oppositeClockwise: { type: 'opposite' as const, direction: 'clockwise' as const },
  centerOutward: { type: 'center-outward' as const, direction: 'clockwise' as const },
};

export const MODE_PATTERN_PRESETS_V2 = {
  allDefault: { type: 'uniform' as const, defaultMode: 'default' as const },
  allHost: { type: 'uniform' as const, defaultMode: 'host-only' as const },
  allExternal: { type: 'uniform' as const, defaultMode: 'external-only' as const },
  alternatingHE: { type: 'alternating' as const, defaultMode: 'default' as const, alternatingModes: ['host-only', 'external-only'] as [SeatMode, SeatMode] },
  fiftyFifty: { type: 'ratio' as const, defaultMode: 'default' as const, ratios: { 'host-only': 0.5, 'external-only': 0.5, 'default': 0 } },
};