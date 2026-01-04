// utils/templateScalerV2.ts
// V2 Template Scaler - Properly handles scaling with:
// - Preserved seat ordering (base seats keep their order)
// - Insertion order for new seats (added at specified edges)
// - Mode pattern propagation (new seats inherit pattern)

import {
  TableTemplateV2,
  TableConfigV2,
  CircleTableConfigV2,
  RectangleTableConfigV2,
  RectangleSideConfigV2,
  InsertionPointV2,
  SeatMode,
  SideKeyV2,
  ScaledResultV2,
  ScaledCircleResultV2,
  ScaledRectangleResultV2,
  ScaledSeatV2,
  SideSeatV2,
  isCircleConfigV2,
  isRectangleConfigV2,
  getTotalSeatCountV2,
} from '@/types/TemplateV2';

// ============================================================================
// SCALE OPTIONS
// ============================================================================

export interface ScaleOptionsV2 {
  // Target seat count
  targetSeatCount: number;
  
  // Override insertion order (optional - uses template's if not provided)
  insertionOrder?: InsertionPointV2[];
  
  // Mode to use for new seats (optional - uses pattern propagation if not provided)
  defaultModeForNewSeats?: SeatMode;
  
  // Whether to propagate the mode pattern to new seats
  propagateModePattern?: boolean;
}

// ============================================================================
// CIRCLE TABLE SCALING
// ============================================================================

function scaleCircleTable(
  config: CircleTableConfigV2,
  options: ScaleOptionsV2
): ScaledCircleResultV2 {
  const baseSeatCount = config.baseSeatCount;
  const targetSeatCount = Math.max(2, options.targetSeatCount);
  
  // Get base ordering and modes from config
  const baseOrdering = config.orderingPattern.type === 'manual' && config.orderingPattern.manualOrdering
    ? [...config.orderingPattern.manualOrdering]
    : generateSequentialOrdering(baseSeatCount);
  
  const baseModes = config.modePattern.type === 'manual' && config.modePattern.manualModes
    ? [...config.modePattern.manualModes]
    : generateModePattern(baseSeatCount, config.modePattern);
  
  if (targetSeatCount === baseSeatCount) {
    return buildCircleResult(baseOrdering, baseModes);
  }
  
  if (targetSeatCount > baseSeatCount) {
    // SCALING UP - Add seats
    const seatsToAdd = targetSeatCount - baseSeatCount;
    const newOrdering = [...baseOrdering];
    const newModes = [...baseModes];
    
    // For circle tables, add seats alternating around the table
    // New seats get the next available order numbers
    let nextOrderNum = Math.max(...baseOrdering) + 1;
    
    for (let i = 0; i < seatsToAdd; i++) {
      // Insert at alternating positions (center-outward pattern)
      const insertPos = i % 2 === 0 ? 0 : newOrdering.length;
      
      newOrdering.splice(insertPos, 0, nextOrderNum++);
      
      // Propagate mode pattern
      const modeForNewSeat = options.propagateModePattern !== false
        ? getModeFromPattern(baseModes, i, options.defaultModeForNewSeats)
        : (options.defaultModeForNewSeats || 'default');
      
      newModes.splice(insertPos, 0, modeForNewSeat);
    }
    
    return buildCircleResult(newOrdering, newModes);
  } else {
    // SCALING DOWN - Remove seats (from highest order numbers)
    const seatsToRemove = baseSeatCount - targetSeatCount;
    const orderingWithIndex = baseOrdering.map((order, idx) => ({ order, idx }));
    
    // Sort by order number descending to find highest-numbered seats
    orderingWithIndex.sort((a, b) => b.order - a.order);
    
    // Get indices to remove (highest order numbers)
    const indicesToRemove = new Set(
      orderingWithIndex.slice(0, seatsToRemove).map(item => item.idx)
    );
    
    // Filter out removed seats
    const newOrdering = baseOrdering.filter((_, idx) => !indicesToRemove.has(idx));
    const newModes = baseModes.filter((_, idx) => !indicesToRemove.has(idx));
    
    // Renumber ordering to be sequential
    const renumbered = renumberOrdering(newOrdering);
    
    return buildCircleResult(renumbered, newModes);
  }
}

/**
 * Build a ScaledCircleResultV2 from ordering and modes arrays
 */
function buildCircleResult(ordering: number[], modes: SeatMode[]): ScaledCircleResultV2 {
  const seats: ScaledSeatV2[] = ordering.map((seatNumber, position) => ({
    position,
    seatNumber,
    mode: modes[position] || 'default',
  }));
  
  return {
    type: 'circle',
    seatCount: ordering.length,
    seats,
    seatOrdering: ordering,
    seatModes: modes,
  };
}

// ============================================================================
// RECTANGLE TABLE SCALING
// ============================================================================

interface SideState {
  ordering: number[];
  modes: SeatMode[];
}

function scaleRectangleTable(
  config: RectangleTableConfigV2,
  options: ScaleOptionsV2
): ScaledRectangleResultV2 {
  const baseSeatCount = calculateRectangleSeatCount(config);
  const targetSeatCount = Math.max(2, options.targetSeatCount);
  
  // Get insertion order (from options or template config)
  const insertionOrder = options.insertionOrder || config.scalingConfig.insertionOrder || [];
  
  // Initialize side states from base config
  const sideStates: Record<SideKeyV2, SideState> = {
    top: { ordering: [], modes: [] },
    right: { ordering: [], modes: [] },
    bottom: { ordering: [], modes: [] },
    left: { ordering: [], modes: [] },
  };
  
  // Build initial side states from config
  let globalOrderIdx = 1;
  const sides: SideKeyV2[] = ['top', 'right', 'bottom', 'left'];
  
  // Get manual ordering and modes if present
  const hasManualOrdering = config.orderingPattern.type === 'manual' && config.orderingPattern.manualOrdering;
  const hasManualModes = config.modePattern.type === 'manual' && config.modePattern.manualModes;
  
  let flatIdx = 0;
  
  // First, populate base seats for each side
  // NOTE: manualOrdering is in CLOCKWISE order (from SeatOrderingPanel/TablePreview)
  // sideStates uses VISUAL order internally (so we can add seats easily)
  // For bottom/left sides, we need to reverse when reading to convert clockwise→visual
  
  for (const side of sides) {
    const sideConfig = config.sides[side];
    if (!sideConfig.enabled || sideConfig.seatCount === 0) continue;
    
    const isReversedSide = side === 'bottom' || side === 'left';
    const sideStartIdx = flatIdx;
    const sideEndIdx = flatIdx + sideConfig.seatCount;
    
    // Collect values for this side
    const sideOrderingValues: number[] = [];
    const sideModeValues: SeatMode[] = [];
    
    for (let i = 0; i < sideConfig.seatCount; i++) {
      // Get ordering
      if (hasManualOrdering && config.orderingPattern.manualOrdering![flatIdx] !== undefined) {
        sideOrderingValues.push(config.orderingPattern.manualOrdering![flatIdx]);
      } else {
        sideOrderingValues.push(globalOrderIdx++);
      }
      
      // Get mode
      if (hasManualModes && config.modePattern.manualModes![flatIdx] !== undefined) {
        sideModeValues.push(config.modePattern.manualModes![flatIdx]);
      } else if (sideConfig.manualSideModes?.[i]) {
        sideModeValues.push(sideConfig.manualSideModes[i]);
      } else {
        sideModeValues.push(getModeForSide(config.modePattern, side, i));
      }
      
      flatIdx++;
    }
    
    // For bottom/left sides, reverse to convert from clockwise to visual order
    // (buildRectangleResult will reverse again to output in clockwise order)
    if (isReversedSide) {
      sideOrderingValues.reverse();
      sideModeValues.reverse();
    }
    
    sideStates[side].ordering = sideOrderingValues;
    sideStates[side].modes = sideModeValues;
  }
  
  // Calculate current total
  const currentTotal = Object.values(sideStates).reduce(
    (sum, state) => sum + state.ordering.length, 0
  );
  
  if (targetSeatCount === currentTotal) {
    return buildRectangleResult(sideStates);
  }
  
  if (targetSeatCount > currentTotal) {
    // SCALING UP
    const seatsToAdd = targetSeatCount - currentTotal;
    
    if (insertionOrder.length === 0) {
      // No insertion order defined - use default round-robin on scalable sides
      addSeatsRoundRobin(sideStates, config.sides, seatsToAdd, config.modePattern, options);
    } else {
      // Use defined insertion order
      addSeatsWithInsertionOrder(sideStates, insertionOrder, seatsToAdd, config.modePattern, options);
    }
    
    return buildRectangleResult(sideStates);
  } else {
    // SCALING DOWN
    const seatsToRemove = currentTotal - targetSeatCount;
    removeSeatsFromSides(sideStates, seatsToRemove);
    
    return buildRectangleResult(sideStates);
  }
}

/**
 * Calculate total seats for rectangle config
 */
function calculateRectangleSeatCount(config: RectangleTableConfigV2): number {
  let total = 0;
  for (const side of ['top', 'right', 'bottom', 'left'] as SideKeyV2[]) {
    if (config.sides[side].enabled) {
      total += config.sides[side].seatCount;
    }
  }
  return total;
}

/**
 * Add seats using the defined insertion order sequence
 * 
 * sideStates internally uses VISUAL order (top-to-bottom for vertical sides).
 * The edge meanings are:
 * - For horizontal sides (top/bottom): 'start' = Left edge, 'end' = Right edge
 * - For vertical sides (left/right): 'start' = Top edge, 'end' = Bottom edge
 * 
 * Since sideStates uses visual order:
 * - 'start' = unshift (adds at array position 0 = visual start of side)
 * - 'end' = push (adds at array end = visual end of side)
 */
function addSeatsWithInsertionOrder(
  sideStates: Record<SideKeyV2, SideState>,
  insertionOrder: InsertionPointV2[],
  seatsToAdd: number,
  modePattern: RectangleTableConfigV2['modePattern'],
  options: ScaleOptionsV2
): void {
  if (insertionOrder.length === 0) return;
  
  // Get the next order number (max of all current + 1)
  let nextOrderNum = 1;
  for (const state of Object.values(sideStates)) {
    if (state.ordering.length > 0) {
      nextOrderNum = Math.max(nextOrderNum, Math.max(...state.ordering) + 1);
    }
  }
  
  // Add seats following the insertion order pattern
  for (let i = 0; i < seatsToAdd; i++) {
    const insertionPoint = insertionOrder[i % insertionOrder.length];
    const { side, edge } = insertionPoint;
    
    const state = sideStates[side];
    
    // Determine mode for new seat
    const mode = options.propagateModePattern !== false
      ? getModeFromSidePattern(state.modes, edge, options.defaultModeForNewSeats)
      : (options.defaultModeForNewSeats || 'default');
    
    // Insert at the appropriate edge
    // sideStates uses visual order, so:
    // - 'start' (left/top edge) = unshift (array beginning)
    // - 'end' (right/bottom edge) = push (array end)
    if (edge === 'start') {
      state.ordering.unshift(nextOrderNum++);
      state.modes.unshift(mode);
    } else {
      state.ordering.push(nextOrderNum++);
      state.modes.push(mode);
    }
  }
}

/**
 * Add seats using round-robin on scalable sides (fallback when no insertion order)
 */
function addSeatsRoundRobin(
  sideStates: Record<SideKeyV2, SideState>,
  sidesConfig: Record<SideKeyV2, RectangleSideConfigV2>,
  seatsToAdd: number,
  modePattern: RectangleTableConfigV2['modePattern'],
  options: ScaleOptionsV2
): void {
  // Get scalable sides sorted by priority
  const scalableSides = (['top', 'right', 'bottom', 'left'] as SideKeyV2[])
    .filter(side => sidesConfig[side].enabled && sidesConfig[side].scalable)
    .sort((a, b) => sidesConfig[a].allocationPriority - sidesConfig[b].allocationPriority);
  
  if (scalableSides.length === 0) return;
  
  let nextOrderNum = 1;
  for (const state of Object.values(sideStates)) {
    if (state.ordering.length > 0) {
      nextOrderNum = Math.max(nextOrderNum, Math.max(...state.ordering) + 1);
    }
  }
  
  // Round-robin add seats
  for (let i = 0; i < seatsToAdd; i++) {
    const side = scalableSides[i % scalableSides.length];
    const state = sideStates[side];
    
    // Determine mode
    const mode = options.propagateModePattern !== false
      ? getModeFromSidePattern(state.modes, 'end', options.defaultModeForNewSeats)
      : (options.defaultModeForNewSeats || 'default');
    
    // Alternate adding to start/end for balanced growth
    if (i % 2 === 0) {
      state.ordering.push(nextOrderNum++);
      state.modes.push(mode);
    } else {
      state.ordering.unshift(nextOrderNum++);
      state.modes.unshift(mode);
    }
  }
}

/**
 * Remove seats from sides - ALWAYS remove highest seat numbers first
 * This ensures consistent behavior regardless of insertion order
 */
function removeSeatsFromSides(
  sideStates: Record<SideKeyV2, SideState>,
  seatsToRemove: number
): void {
  // Always remove from highest order numbers first
  // This is the user expectation: seat 10 should be removed before seat 9
  const allSeats: { side: SideKeyV2; idx: number; order: number }[] = [];
  
  for (const side of ['top', 'right', 'bottom', 'left'] as SideKeyV2[]) {
    sideStates[side].ordering.forEach((order, idx) => {
      allSeats.push({ side, idx, order });
    });
  }
  
  // Sort by order descending (highest first)
  allSeats.sort((a, b) => b.order - a.order);
  
  // Remove highest-numbered seats
  const toRemove = allSeats.slice(0, seatsToRemove);
  
  // Group removals by side and sort indices descending to remove from end first
  // (removing from high index to low prevents index shifting issues)
  for (const side of ['top', 'right', 'bottom', 'left'] as SideKeyV2[]) {
    const indices = toRemove
      .filter(s => s.side === side)
      .map(s => s.idx)
      .sort((a, b) => b - a); // Sort descending
    
    for (const idx of indices) {
      sideStates[side].ordering.splice(idx, 1);
      sideStates[side].modes.splice(idx, 1);
    }
  }
}

/**
 * Build the final ScaledRectangleResultV2 from side states
 * 
 * IMPORTANT: The seatOrdering array uses CLOCKWISE convention to match TablePreview:
 * - Top: left to right
 * - Right: top to bottom  
 * - Bottom: right to left (reversed)
 * - Left: bottom to top (reversed)
 * 
 * This matches how TablePreview and SeatOrderingPanel render/store positions.
 */
function buildRectangleResult(
  sideStates: Record<SideKeyV2, SideState>
): ScaledRectangleResultV2 {
  // Build sides with SideSeatV2 info
  const buildSideSeats = (side: SideKeyV2): SideSeatV2[] => {
    return sideStates[side].ordering.map((seatNumber, positionOnSide) => ({
      positionOnSide,
      seatNumber,
      mode: sideStates[side].modes[positionOnSide] || 'default',
    }));
  };
  
  // Flatten all sides into single arrays using CLOCKWISE convention
  // This matches TablePreview position generation order
  const ordering: number[] = [];
  const modes: SeatMode[] = [];
  
  // Top: left to right (as stored)
  ordering.push(...sideStates.top.ordering);
  modes.push(...sideStates.top.modes);
  
  // Right: top to bottom (as stored)
  ordering.push(...sideStates.right.ordering);
  modes.push(...sideStates.right.modes);
  
  // Bottom: right to left (REVERSED for clockwise traversal)
  ordering.push(...[...sideStates.bottom.ordering].reverse());
  modes.push(...[...sideStates.bottom.modes].reverse());
  
  // Left: bottom to top (REVERSED for clockwise traversal)
  ordering.push(...[...sideStates.left.ordering].reverse());
  modes.push(...[...sideStates.left.modes].reverse());
  
  const seatCount = ordering.length;
  
  return {
    type: 'rectangle',
    seatCount,
    sideSeats: {
      top: sideStates.top.ordering.length,
      right: sideStates.right.ordering.length,
      bottom: sideStates.bottom.ordering.length,
      left: sideStates.left.ordering.length,
    },
    sides: {
      top: buildSideSeats('top'),
      right: buildSideSeats('right'),
      bottom: buildSideSeats('bottom'),
      left: buildSideSeats('left'),
    },
    seatOrdering: ordering,
    seatModes: modes,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate sequential ordering [1, 2, 3, ...]
 */
function generateSequentialOrdering(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * Generate mode pattern based on config
 */
function generateModePattern(
  count: number,
  modePattern: CircleTableConfigV2['modePattern'] | RectangleTableConfigV2['modePattern']
): SeatMode[] {
  if (modePattern.type === 'manual' && modePattern.manualModes) {
    // Extend or truncate manual modes to match count
    const modes = [...modePattern.manualModes];
    while (modes.length < count) {
      modes.push(modePattern.defaultMode || 'default');
    }
    return modes.slice(0, count);
  }
  
  if (modePattern.type === 'alternating' && modePattern.alternatingModes) {
    return Array.from({ length: count }, (_, i) => 
      modePattern.alternatingModes![i % modePattern.alternatingModes!.length]
    );
  }
  
  return Array.from({ length: count }, () => modePattern.defaultMode || 'default');
}

/**
 * Get mode for a specific side (for per-side mode patterns)
 */
function getModeForSide(
  modePattern: RectangleTableConfigV2['modePattern'],
  side: SideKeyV2,
  seatIndex: number
): SeatMode {
  if (modePattern.type === 'alternating' && modePattern.alternatingModes) {
    return modePattern.alternatingModes[seatIndex % modePattern.alternatingModes.length];
  }
  
  return modePattern.defaultMode || 'default';
}

/**
 * Get mode from pattern for new seat (propagation)
 */
function getModeFromPattern(
  existingModes: SeatMode[],
  newSeatIndex: number,
  defaultMode?: SeatMode
): SeatMode {
  if (existingModes.length === 0) return defaultMode || 'default';
  
  // Detect pattern in existing modes
  const pattern = detectModePattern(existingModes);
  
  if (pattern.length > 0) {
    // Continue the pattern
    return pattern[(existingModes.length + newSeatIndex) % pattern.length];
  }
  
  // No clear pattern - use the most common mode or default
  return defaultMode || getMostCommonMode(existingModes);
}

/**
 * Get mode from side pattern for new seat
 */
function getModeFromSidePattern(
  existingModes: SeatMode[],
  edge: 'start' | 'end',
  defaultMode?: SeatMode
): SeatMode {
  if (existingModes.length === 0) return defaultMode || 'default';
  
  // For new seats, continue the pattern from the edge
  if (edge === 'start') {
    return existingModes[0]; // Copy mode from first seat
  } else {
    return existingModes[existingModes.length - 1]; // Copy mode from last seat
  }
}

/**
 * Detect repeating pattern in modes
 */
function detectModePattern(modes: SeatMode[]): SeatMode[] {
  if (modes.length <= 1) return modes;
  
  // Check for patterns of length 1, 2, 3, etc.
  for (let patternLen = 1; patternLen <= Math.floor(modes.length / 2); patternLen++) {
    const pattern = modes.slice(0, patternLen);
    let isPattern = true;
    
    for (let i = patternLen; i < modes.length; i++) {
      if (modes[i] !== pattern[i % patternLen]) {
        isPattern = false;
        break;
      }
    }
    
    if (isPattern) return pattern;
  }
  
  // No repeating pattern found
  return [];
}

/**
 * Get most common mode
 */
function getMostCommonMode(modes: SeatMode[]): SeatMode {
  const counts: Record<string, number> = {};
  for (const mode of modes) {
    counts[mode] = (counts[mode] || 0) + 1;
  }
  
  let maxCount = 0;
  let mostCommon: SeatMode = 'default';
  
  for (const [mode, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = mode as SeatMode;
    }
  }
  
  return mostCommon;
}

/**
 * Renumber ordering to be sequential (1, 2, 3, ...)
 */
function renumberOrdering(ordering: number[]): number[] {
  // Create array of { originalValue, originalIndex }
  const indexed = ordering.map((val, idx) => ({ val, idx }));
  
  // Sort by original value
  indexed.sort((a, b) => a.val - b.val);
  
  // Assign new sequential numbers
  const result = new Array(ordering.length);
  indexed.forEach((item, newVal) => {
    result[item.idx] = newVal + 1;
  });
  
  return result;
}

// ============================================================================
// MAIN EXPORTS
// ============================================================================

/**
 * Scale a template to a target seat count
 */
export function scaleTemplateV2(
  template: TableTemplateV2,
  options: ScaleOptionsV2
): ScaledResultV2 {
  if (isCircleConfigV2(template.config)) {
    return scaleCircleTable(template.config, options);
  } else if (isRectangleConfigV2(template.config)) {
    return scaleRectangleTable(template.config, options);
  }
  
  throw new Error('Unknown template config type');
}

/**
 * Scale a config directly (without a full template)
 * Useful when you don't have a full template object
 */
export function scaleConfigV2(
  config: TableConfigV2,
  targetSeatCount: number
): ScaledResultV2 {
  const options: ScaleOptionsV2 = {
    targetSeatCount,
    propagateModePattern: true,
  };
  
  if (isCircleConfigV2(config)) {
    return scaleCircleTable(config, options);
  } else if (isRectangleConfigV2(config)) {
    return scaleRectangleTable(config, options);
  }
  
  throw new Error('Unknown config type');
}

/**
 * Get the min/max seat range for a template
 */
export function getScaleRangeV2(template: TableTemplateV2): { min: number; max: number } {
  if (isCircleConfigV2(template.config)) {
    return { min: 2, max: 30 };
  }
  
  if (isRectangleConfigV2(template.config)) {
    // Count non-scalable seats (minimum)
    let minSeats = 0;
    let maxSeats = 0;
    
    for (const side of ['top', 'right', 'bottom', 'left'] as SideKeyV2[]) {
      const sideConfig = template.config.sides[side];
      if (sideConfig.enabled) {
        if (!sideConfig.scalable) {
          minSeats += sideConfig.seatCount;
          maxSeats += sideConfig.seatCount;
        } else {
          minSeats += 0; // Scalable sides can go to 0
          maxSeats += 15; // Max per side
        }
      }
    }
    
    return { 
      min: Math.max(2, minSeats), 
      max: Math.min(60, maxSeats) 
    };
  }
  
  return { min: 2, max: 30 };
}