// utils/templateScalerV2.ts
// Template Scaler V2 - Scales templates while preserving ordering and mode patterns
//
// Architecture:
// - Circle tables: pattern detection → regeneration (or proportional mapping for manual)
// - Rectangle tables: insertion-order-based scaling with mode post-processing
// - Shared utilities: safe modulo, pattern detection, mode distribution

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
  OrderingPatternTypeV2,
  DirectionV2,
} from '@/types/TemplateV2';

// ============================================================================
// SCALE OPTIONS
// ============================================================================

export interface ScaleOptionsV2 {
  targetSeatCount: number;
  insertionOrder?: InsertionPointV2[];
  defaultModeForNewSeats?: SeatMode;
  propagateModePattern?: boolean;
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/** Safe modulo that always returns a non-negative result */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Compare two arrays for element-wise equality */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Generate sequential ordering [1, 2, 3, ...] */
function generateSequentialOrdering(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * Detect a repeating pattern in a mode array.
 * Returns the shortest repeating unit, or empty array if none found.
 */
function detectModePattern(modes: SeatMode[]): SeatMode[] {
  if (modes.length <= 1) return modes;

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

  return [];
}

/**
 * Renumber ordering to be sequential (1, 2, 3, ...) while preserving relative order.
 * The seat at the position with the smallest current number becomes 1, etc.
 */
function renumberOrdering(ordering: number[]): number[] {
  const indexed = ordering.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);
  const result = new Array(ordering.length);
  indexed.forEach((item, newVal) => {
    result[item.idx] = newVal + 1;
  });
  return result;
}

// ============================================================================
// CIRCLE ORDERING PATTERN GENERATORS
// ============================================================================

/**
 * Generate ordering for a circle table based on pattern type.
 * This is the canonical implementation used by both internal scaling
 * and the exported generateOrdering function.
 */
function generateCircleOrderingByPattern(
  seatCount: number,
  patternType: OrderingPatternTypeV2,
  direction: DirectionV2,
  startPosition: number
): number[] {
  const start = mod(startPosition, seatCount);

  switch (patternType) {
    case 'sequential':
      return generateSequentialCircleOrdering(seatCount, direction, start);
    case 'alternating':
      return generateAlternatingCircleOrdering(seatCount, direction, start);
    case 'opposite':
      return generateOppositeCircleOrdering(seatCount, direction, start);
    case 'center-outward':
      return generateCenterOutwardCircleOrdering(seatCount, direction, start);
    default:
      return generateSequentialCircleOrdering(seatCount, direction, start);
  }
}

/** Sequential: 1, 2, 3, 4, ... in given direction from start position */
function generateSequentialCircleOrdering(
  seatCount: number,
  direction: DirectionV2,
  startPosition: number
): number[] {
  const ordering = new Array<number>(seatCount);
  for (let seatNum = 1; seatNum <= seatCount; seatNum++) {
    const offset = seatNum - 1;
    const position = direction === 'clockwise'
      ? mod(startPosition + offset, seatCount)
      : mod(startPosition - offset, seatCount);
    ordering[position] = seatNum;
  }
  return ordering;
}

/**
 * Alternating: Seat 1 at start, evens go one direction, odds go the other.
 * Example (8 seats, clockwise from pos 0):
 * Positions: [0, 1, 2, 3, 4, 5, 6, 7]
 * Seats:     [1, 2, 4, 6, 8, 7, 5, 3]
 */
function generateAlternatingCircleOrdering(
  seatCount: number,
  direction: DirectionV2,
  startPosition: number
): number[] {
  const ordering = new Array<number>(seatCount).fill(0);
  ordering[startPosition] = 1;

  const evens: number[] = [];
  const odds: number[] = [];
  for (let i = 2; i <= seatCount; i++) {
    (i % 2 === 0 ? evens : odds).push(i);
  }

  // Primary direction gets evens, opposite gets odds
  const [primaryGroup, secondaryGroup] = direction === 'clockwise'
    ? [evens, odds]
    : [odds, evens];

  // Primary direction: step forward from start
  for (let i = 0; i < primaryGroup.length; i++) {
    ordering[mod(startPosition + 1 + i, seatCount)] = primaryGroup[i];
  }
  // Opposite direction: step backward from start
  for (let i = 0; i < secondaryGroup.length; i++) {
    ordering[mod(startPosition - 1 - i, seatCount)] = secondaryGroup[i];
  }

  // For counter-clockwise, the groups are swapped (odds go forward, evens go backward)
  if (direction === 'counter-clockwise') {
    // Already handled by the swap above
  }

  return ordering;
}

/**
 * Opposite: Seat 1 faces Seat 2, Seat 3 faces Seat 4, etc.
 * Example (8 seats, clockwise from pos 0):
 * Positions: [0, 1, 2, 3, 4, 5, 6, 7]
 * Seats:     [1, 3, 5, 7, 2, 4, 6, 8]
 */
function generateOppositeCircleOrdering(
  seatCount: number,
  direction: DirectionV2,
  startPosition: number
): number[] {
  const ordering = new Array<number>(seatCount).fill(0);
  const halfCount = Math.floor(seatCount / 2);
  const step = direction === 'clockwise' ? 1 : -1;

  let seatNumber = 1;
  for (let i = 0; i < Math.ceil(seatCount / 2); i++) {
    const primaryPos = mod(startPosition + step * i, seatCount);
    ordering[primaryPos] = seatNumber++;

    if (seatNumber <= seatCount) {
      const oppositePos = mod(primaryPos + halfCount, seatCount);
      ordering[oppositePos] = seatNumber++;
    }
  }

  return ordering;
}

/** Center-outward: Seat 1 at center, then alternating outward in both directions */
function generateCenterOutwardCircleOrdering(
  seatCount: number,
  direction: DirectionV2,
  startPosition: number
): number[] {
  const ordering = new Array<number>(seatCount).fill(0);
  ordering[startPosition] = 1;

  let seatNumber = 2;
  let offset = 1;

  while (seatNumber <= seatCount) {
    const cwPos = mod(startPosition + offset, seatCount);
    const ccwPos = mod(startPosition - offset, seatCount);

    // Primary direction first, then secondary
    const [first, second] = direction === 'clockwise'
      ? [cwPos, ccwPos]
      : [ccwPos, cwPos];

    if (ordering[first] === 0 && seatNumber <= seatCount) {
      ordering[first] = seatNumber++;
    }
    if (ordering[second] === 0 && seatNumber <= seatCount) {
      ordering[second] = seatNumber++;
    }

    offset++;
  }

  return ordering;
}

// ============================================================================
// CIRCLE ORDERING PATTERN DETECTION
// ============================================================================

/**
 * Try to detect if a "manual" ordering actually matches a known pattern.
 * Compares against all pattern types, directions, and start positions.
 * Returns the matching parameters, or null if truly manual.
 */
function detectCircleOrderingPattern(
  ordering: number[],
  seatCount: number
): { type: OrderingPatternTypeV2; direction: DirectionV2; startPosition: number } | null {
  const patterns: OrderingPatternTypeV2[] = ['sequential', 'alternating', 'opposite', 'center-outward'];
  const directions: DirectionV2[] = ['clockwise', 'counter-clockwise'];

  for (const type of patterns) {
    for (const dir of directions) {
      for (let start = 0; start < seatCount; start++) {
        const generated = generateCircleOrderingByPattern(seatCount, type, dir, start);
        if (arraysEqual(generated, ordering)) {
          return { type, direction: dir, startPosition: start };
        }
      }
    }
  }
  return null;
}

// ============================================================================
// MODE PATTERN GENERATION
// ============================================================================

/**
 * Generate mode pattern for a given seat count based on pattern configuration.
 * Handles all mode pattern types: uniform, manual, alternating, repeating, ratio.
 */
function generateModesByPattern(
  seatCount: number,
  modePattern: CircleTableConfigV2['modePattern'] | RectangleTableConfigV2['modePattern']
): SeatMode[] {
  const { type, defaultMode } = modePattern;

  if (type === 'manual' && modePattern.manualModes) {
    const modes = [...modePattern.manualModes];
    while (modes.length < seatCount) {
      modes.push(defaultMode || 'default');
    }
    return modes.slice(0, seatCount);
  }

  if (type === 'alternating' && modePattern.alternatingModes) {
    return Array.from({ length: seatCount }, (_, i) =>
      modePattern.alternatingModes![i % modePattern.alternatingModes!.length]
    );
  }

  if (type === 'repeating' && modePattern.repeatingSequence) {
    return Array.from({ length: seatCount }, (_, i) =>
      modePattern.repeatingSequence![i % modePattern.repeatingSequence!.length]
    );
  }

  if (type === 'ratio' && modePattern.ratios) {
    const { ratios } = modePattern;
    const modes: SeatMode[] = [];

    const hostCount = Math.round(seatCount * ratios['host-only']);
    const externalCount = Math.round(seatCount * ratios['external-only']);
    const defaultCount = seatCount - hostCount - externalCount;

    for (let i = 0; i < hostCount; i++) modes.push('host-only');
    for (let i = 0; i < externalCount; i++) modes.push('external-only');
    for (let i = 0; i < defaultCount; i++) modes.push('default');

    return interleaveArray(modes, seatCount);
  }

  // Uniform or unknown - all same mode
  return Array.from({ length: seatCount }, () => defaultMode || 'default');
}

/**
 * Distribute array items evenly for better spatial distribution.
 * Groups identical items, then distributes them in rounds across the result array.
 */
function interleaveArray<T>(arr: T[], targetLength: number): T[] {
  if (arr.length === 0) return [];

  const result: T[] = new Array(targetLength);
  const counts: Map<T, number> = new Map();

  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  const items = Array.from(counts.entries());
  let currentIdx = 0;
  let round = 0;

  while (currentIdx < targetLength) {
    for (const [item, count] of items) {
      if (currentIdx >= targetLength) break;

      // Each round, assign ceil(count/numGroups) items per group
      const assignCount = Math.ceil(count / Math.max(1, items.length));

      for (let i = 0; i < assignCount && currentIdx < targetLength; i++) {
        if (round * assignCount + i < count) {
          result[currentIdx++] = item;
        }
      }
    }
    round++;
    if (round > targetLength) break;
  }

  return result;
}

/**
 * Distribute modes proportionally to maintain the same ratio as the base.
 * Maps each target position to the nearest proportional base position.
 */
function distributeModesProportionally(
  baseModes: SeatMode[],
  targetCount: number
): SeatMode[] {
  if (baseModes.length === 0) return Array(targetCount).fill('default');
  if (targetCount === 1) return [baseModes[0]];

  return Array.from({ length: targetCount }, (_, i) => {
    const basePos = Math.round(i * (baseModes.length - 1) / (targetCount - 1));
    return baseModes[Math.min(basePos, baseModes.length - 1)];
  });
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

  const { orderingPattern, modePattern } = config;

  const isManualOrdering = orderingPattern.type === 'manual' && orderingPattern.manualOrdering;
  const isManualModes = modePattern.type === 'manual' && modePattern.manualModes;

  if (isManualOrdering || isManualModes) {
    return scaleCircleTableManual(config, options, targetSeatCount, baseSeatCount);
  }

  // Pattern-based: regenerate ordering and modes at the new size
  const ordering = generateCircleOrderingByPattern(
    targetSeatCount,
    orderingPattern.type,
    orderingPattern.direction,
    orderingPattern.startPosition
  );
  const modes = generateModesByPattern(targetSeatCount, modePattern);

  return buildCircleResult(ordering, modes);
}

/**
 * Scale circle table with manual ordering/mode preservation.
 *
 * Three-tier approach:
 * 1. Detect if "manual" ordering matches a known pattern → regenerate at new count
 * 2. Proportional position mapping for truly manual orderings (scale up)
 * 3. Remove highest-numbered seats for scale down
 */
function scaleCircleTableManual(
  config: CircleTableConfigV2,
  options: ScaleOptionsV2,
  targetSeatCount: number,
  baseSeatCount: number
): ScaledCircleResultV2 {
  const baseOrdering = config.orderingPattern.type === 'manual' && config.orderingPattern.manualOrdering
    ? [...config.orderingPattern.manualOrdering]
    : generateSequentialOrdering(baseSeatCount);

  const baseModes = config.modePattern.type === 'manual' && config.modePattern.manualModes
    ? [...config.modePattern.manualModes]
    : generateModesByPattern(baseSeatCount, config.modePattern);

  if (targetSeatCount === baseSeatCount) {
    return buildCircleResult(baseOrdering, baseModes);
  }

  // Tier 1: Try detecting a known ordering pattern
  const detectedOrdering = detectCircleOrderingPattern(baseOrdering, baseSeatCount);

  if (detectedOrdering) {
    const ordering = generateCircleOrderingByPattern(
      targetSeatCount,
      detectedOrdering.type,
      detectedOrdering.direction,
      detectedOrdering.startPosition
    );
    const modes = scaleCircleModes(baseModes, targetSeatCount, config.modePattern, options);
    return buildCircleResult(ordering, modes);
  }

  // Tier 2/3: Truly manual ordering
  if (targetSeatCount > baseSeatCount) {
    return scaleCircleManualUp(baseOrdering, baseModes, baseSeatCount, targetSeatCount, config.modePattern, options);
  }
  return scaleCircleManualDown(baseOrdering, baseModes, targetSeatCount, config.modePattern, options);
}

/**
 * Scale circle modes intelligently:
 * 1. Try detecting a repeating pattern → tile it at new count
 * 2. Fall back to proportional ratio distribution
 */
function scaleCircleModes(
  baseModes: SeatMode[],
  targetCount: number,
  modePattern: CircleTableConfigV2['modePattern'],
  options: ScaleOptionsV2
): SeatMode[] {
  if (options.propagateModePattern === false) {
    return Array.from({ length: targetCount }, () => options.defaultModeForNewSeats || 'default');
  }

  // Try detecting a repeating mode pattern (e.g. [H,E])
  const pattern = detectModePattern(baseModes);
  if (pattern.length > 0) {
    return Array.from({ length: targetCount }, (_, i) => pattern[i % pattern.length]);
  }

  // Fall back to proportional ratio distribution
  return distributeModesProportionally(baseModes, targetCount);
}

/**
 * Scale up a truly manual circle ordering using proportional position mapping.
 * Maps each base seat to a proportional position in the larger circle,
 * preserving relative spacing. New seats fill the gaps.
 */
function scaleCircleManualUp(
  baseOrdering: number[],
  baseModes: SeatMode[],
  baseSeatCount: number,
  targetSeatCount: number,
  modePattern: CircleTableConfigV2['modePattern'],
  options: ScaleOptionsV2
): ScaledCircleResultV2 {
  const newOrdering = new Array<number>(targetSeatCount).fill(0);
  const occupiedPositions = new Set<number>();

  // Map existing seats to proportional positions in the target circle
  for (let basePos = 0; basePos < baseSeatCount; basePos++) {
    let targetPos = Math.round(basePos * targetSeatCount / baseSeatCount);
    // Resolve collisions by searching outward
    while (occupiedPositions.has(targetPos)) {
      for (let delta = 1; delta < targetSeatCount; delta++) {
        const posPlus = mod(targetPos + delta, targetSeatCount);
        if (!occupiedPositions.has(posPlus)) { targetPos = posPlus; break; }
        const posMinus = mod(targetPos - delta, targetSeatCount);
        if (!occupiedPositions.has(posMinus)) { targetPos = posMinus; break; }
      }
      break;
    }
    newOrdering[targetPos] = baseOrdering[basePos];
    occupiedPositions.add(targetPos);
  }

  // Fill empty positions with new seat numbers
  let nextSeatNum = Math.max(...baseOrdering) + 1;
  for (let pos = 0; pos < targetSeatCount; pos++) {
    if (newOrdering[pos] === 0) {
      newOrdering[pos] = nextSeatNum++;
    }
  }

  // Generate modes for ALL positions from pattern detection.
  // This ensures clean patterns (e.g. alternating [H,E]) are maintained
  // even after proportional position shifts.
  const newModes = scaleCircleModes(baseModes, targetSeatCount, modePattern, options);

  return buildCircleResult(newOrdering, newModes);
}

/**
 * Scale down a manual circle ordering by removing highest-numbered seats.
 * Remaining seats are renumbered to be sequential.
 */
function scaleCircleManualDown(
  baseOrdering: number[],
  baseModes: SeatMode[],
  targetSeatCount: number,
  modePattern: CircleTableConfigV2['modePattern'],
  options: ScaleOptionsV2
): ScaledCircleResultV2 {
  const seatsToRemove = baseOrdering.length - targetSeatCount;
  const orderingWithIndex = baseOrdering.map((order, idx) => ({ order, idx }));
  orderingWithIndex.sort((a, b) => b.order - a.order);

  const indicesToRemove = new Set(
    orderingWithIndex.slice(0, seatsToRemove).map(item => item.idx)
  );

  const newOrdering = baseOrdering.filter((_, idx) => !indicesToRemove.has(idx));

  // Generate modes from pattern detection for clean scaling.
  // This ensures repeating patterns (e.g. [H,E]) are maintained
  // even after seat removal creates gaps.
  const newModes = scaleCircleModes(baseModes, targetSeatCount, modePattern, options);

  return buildCircleResult(renumberOrdering(newOrdering), newModes);
}

/** Build a ScaledCircleResultV2 from ordering and modes arrays */
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

interface SideInsertionCounts {
  start: number;
  end: number;
}

const ALL_SIDES: SideKeyV2[] = ['top', 'right', 'bottom', 'left'];

function scaleRectangleTable(
  config: RectangleTableConfigV2,
  options: ScaleOptionsV2
): ScaledRectangleResultV2 {
  const targetSeatCount = Math.max(2, options.targetSeatCount);
  const insertionOrder = options.insertionOrder || config.scalingConfig.insertionOrder || [];

  // Initialize side states from base config
  const sideStates: Record<SideKeyV2, SideState> = {
    top: { ordering: [], modes: [] },
    right: { ordering: [], modes: [] },
    bottom: { ordering: [], modes: [] },
    left: { ordering: [], modes: [] },
  };

  const hasManualOrdering = config.orderingPattern.type === 'manual' && config.orderingPattern.manualOrdering;
  const hasManualModes = config.modePattern.type === 'manual' && config.modePattern.manualModes;

  // Populate base seats for each side
  // manualOrdering is in CLOCKWISE order (top→right→bottom→left)
  // sideStates uses VISUAL order internally
  // For bottom/left sides, we reverse clockwise→visual (buildRectangleResult reverses back)
  let globalOrderIdx = 1;
  let flatIdx = 0;

  for (const side of ALL_SIDES) {
    const sideConfig = config.sides[side];
    if (!sideConfig.enabled || sideConfig.seatCount === 0) continue;

    const isReversedSide = side === 'bottom' || side === 'left';
    const sideOrderingValues: number[] = [];
    const sideModeValues: SeatMode[] = [];

    for (let i = 0; i < sideConfig.seatCount; i++) {
      // Ordering
      if (hasManualOrdering && config.orderingPattern.manualOrdering![flatIdx] !== undefined) {
        sideOrderingValues.push(config.orderingPattern.manualOrdering![flatIdx]);
      } else {
        sideOrderingValues.push(globalOrderIdx++);
      }

      // Mode
      if (hasManualModes && config.modePattern.manualModes![flatIdx] !== undefined) {
        sideModeValues.push(config.modePattern.manualModes![flatIdx]);
      } else if (sideConfig.manualSideModes?.[i]) {
        sideModeValues.push(sideConfig.manualSideModes[i]);
      } else {
        sideModeValues.push(getModeForSide(config.modePattern, i));
      }

      flatIdx++;
    }

    // Convert clockwise→visual for bottom/left
    if (isReversedSide) {
      sideOrderingValues.reverse();
      sideModeValues.reverse();
    }

    sideStates[side].ordering = sideOrderingValues;
    sideStates[side].modes = sideModeValues;
  }

  const currentTotal = ALL_SIDES.reduce(
    (sum, side) => sum + sideStates[side].ordering.length, 0
  );

  if (targetSeatCount === currentTotal) {
    return buildRectangleResult(sideStates);
  }

  if (targetSeatCount > currentTotal) {
    // Capture original modes per side before scaling (for post-processing)
    const originalSideModes: Record<SideKeyV2, SeatMode[]> = {
      top: [...sideStates.top.modes],
      right: [...sideStates.right.modes],
      bottom: [...sideStates.bottom.modes],
      left: [...sideStates.left.modes],
    };

    const insertionCounts: Record<SideKeyV2, SideInsertionCounts> = {
      top: { start: 0, end: 0 },
      right: { start: 0, end: 0 },
      bottom: { start: 0, end: 0 },
      left: { start: 0, end: 0 },
    };

    const seatsToAdd = targetSeatCount - currentTotal;

    if (insertionOrder.length === 0) {
      addSeatsRoundRobin(sideStates, config.sides, seatsToAdd, options, insertionCounts);
    } else {
      addSeatsWithInsertionOrder(sideStates, insertionOrder, seatsToAdd, options, insertionCounts);
    }

    // Post-process: regenerate modes for sides with detected repeating patterns
    regenerateSideModes(sideStates, originalSideModes, insertionCounts);

    return buildRectangleResult(sideStates);
  }

  // SCALING DOWN
  const seatsToRemove = currentTotal - targetSeatCount;
  removeSeatsFromSides(sideStates, seatsToRemove);
  return buildRectangleResult(sideStates);
}

/** Calculate total seats for rectangle config */
function calculateRectangleSeatCount(config: RectangleTableConfigV2): number {
  return ALL_SIDES.reduce(
    (total, side) => total + (config.sides[side].enabled ? config.sides[side].seatCount : 0), 0
  );
}

/** Get mode for a specific side seat based on the pattern config */
function getModeForSide(
  modePattern: RectangleTableConfigV2['modePattern'],
  seatIndex: number
): SeatMode {
  if (modePattern.type === 'alternating' && modePattern.alternatingModes) {
    return modePattern.alternatingModes[seatIndex % modePattern.alternatingModes.length];
  }
  return modePattern.defaultMode || 'default';
}

/**
 * Get mode from side pattern for a new seat being added at an edge.
 * Uses pattern detection to continue the pattern rather than just copying the edge.
 */
function getModeFromSidePattern(
  existingModes: SeatMode[],
  edge: 'start' | 'end',
  defaultMode?: SeatMode
): SeatMode {
  if (existingModes.length === 0) return defaultMode || 'default';

  const pattern = detectModePattern(existingModes);

  if (pattern.length > 0) {
    if (edge === 'end') {
      // Next position after the end of the current array
      return pattern[existingModes.length % pattern.length];
    }
    // For start insertion, return the mode that will eventually be overwritten
    // by regenerateSideModes post-processing. Use pattern wrap-around as placeholder.
    return pattern[mod(-1, pattern.length)];
  }

  // No pattern detected: copy edge mode
  return edge === 'start' ? existingModes[0] : existingModes[existingModes.length - 1];
}

/**
 * Add seats using the defined insertion order sequence.
 *
 * sideStates uses VISUAL order:
 * - 'start' = unshift (left/top edge)
 * - 'end' = push (right/bottom edge)
 */
function addSeatsWithInsertionOrder(
  sideStates: Record<SideKeyV2, SideState>,
  insertionOrder: InsertionPointV2[],
  seatsToAdd: number,
  options: ScaleOptionsV2,
  insertionCounts: Record<SideKeyV2, SideInsertionCounts>
): void {
  if (insertionOrder.length === 0) return;

  let nextOrderNum = getMaxOrderNumber(sideStates) + 1;

  for (let i = 0; i < seatsToAdd; i++) {
    const { side, edge } = insertionOrder[i % insertionOrder.length];
    const state = sideStates[side];

    const mode = options.propagateModePattern !== false
      ? getModeFromSidePattern(state.modes, edge, options.defaultModeForNewSeats)
      : (options.defaultModeForNewSeats || 'default');

    if (edge === 'start') {
      state.ordering.unshift(nextOrderNum++);
      state.modes.unshift(mode);
    } else {
      state.ordering.push(nextOrderNum++);
      state.modes.push(mode);
    }

    insertionCounts[side][edge]++;
  }
}

/**
 * Add seats using round-robin on scalable sides (fallback when no insertion order).
 */
function addSeatsRoundRobin(
  sideStates: Record<SideKeyV2, SideState>,
  sidesConfig: Record<SideKeyV2, RectangleSideConfigV2>,
  seatsToAdd: number,
  options: ScaleOptionsV2,
  insertionCounts: Record<SideKeyV2, SideInsertionCounts>
): void {
  const scalableSides = ALL_SIDES
    .filter(side => sidesConfig[side].enabled && sidesConfig[side].scalable)
    .sort((a, b) => sidesConfig[a].allocationPriority - sidesConfig[b].allocationPriority);

  if (scalableSides.length === 0) return;

  let nextOrderNum = getMaxOrderNumber(sideStates) + 1;

  for (let i = 0; i < seatsToAdd; i++) {
    const side = scalableSides[i % scalableSides.length];
    const state = sideStates[side];
    const edge: 'start' | 'end' = i % 2 === 0 ? 'end' : 'start';

    const mode = options.propagateModePattern !== false
      ? getModeFromSidePattern(state.modes, edge, options.defaultModeForNewSeats)
      : (options.defaultModeForNewSeats || 'default');

    if (edge === 'start') {
      state.ordering.unshift(nextOrderNum++);
      state.modes.unshift(mode);
    } else {
      state.ordering.push(nextOrderNum++);
      state.modes.push(mode);
    }

    insertionCounts[side][edge]++;
  }
}

/** Get the maximum order number across all sides */
function getMaxOrderNumber(sideStates: Record<SideKeyV2, SideState>): number {
  let max = 0;
  for (const state of Object.values(sideStates)) {
    if (state.ordering.length > 0) {
      max = Math.max(max, Math.max(...state.ordering));
    }
  }
  return max;
}

/**
 * Regenerate side modes after scaling to maintain detected repeating patterns.
 * For each side that had a detectable repeating mode pattern, regenerates all modes
 * at the new count, using a phase offset to account for start-edge insertions.
 */
function regenerateSideModes(
  sideStates: Record<SideKeyV2, SideState>,
  originalSideModes: Record<SideKeyV2, SeatMode[]>,
  insertionCounts: Record<SideKeyV2, SideInsertionCounts>
): void {
  for (const side of ALL_SIDES) {
    const origModes = originalSideModes[side];
    if (origModes.length === 0) continue;

    const newCount = sideStates[side].modes.length;
    if (newCount === origModes.length) continue;

    const pattern = detectModePattern(origModes);
    if (pattern.length === 0 || pattern.length >= origModes.length) continue;

    // Regenerate modes shifted by the number of start insertions
    // so that original seats keep their pattern phase
    const startOffset = insertionCounts[side].start;
    sideStates[side].modes = Array.from({ length: newCount }, (_, i) =>
      pattern[mod(i - startOffset, pattern.length)]
    );
  }
}

/**
 * Remove seats from sides - always removes highest seat numbers first.
 */
function removeSeatsFromSides(
  sideStates: Record<SideKeyV2, SideState>,
  seatsToRemove: number
): void {
  const allSeats: { side: SideKeyV2; idx: number; order: number }[] = [];

  for (const side of ALL_SIDES) {
    sideStates[side].ordering.forEach((order, idx) => {
      allSeats.push({ side, idx, order });
    });
  }

  allSeats.sort((a, b) => b.order - a.order);
  const toRemove = allSeats.slice(0, seatsToRemove);

  // Remove from high index to low to prevent index shifting issues
  for (const side of ALL_SIDES) {
    const indices = toRemove
      .filter(s => s.side === side)
      .map(s => s.idx)
      .sort((a, b) => b - a);

    for (const idx of indices) {
      sideStates[side].ordering.splice(idx, 1);
      sideStates[side].modes.splice(idx, 1);
    }
  }
}

/**
 * Build the final ScaledRectangleResultV2 from side states.
 *
 * The seatOrdering array uses CLOCKWISE convention to match TablePreview:
 * - Top: left to right
 * - Right: top to bottom
 * - Bottom: right to left (reversed from visual)
 * - Left: bottom to top (reversed from visual)
 */
function buildRectangleResult(
  sideStates: Record<SideKeyV2, SideState>
): ScaledRectangleResultV2 {
  const buildSideSeats = (side: SideKeyV2): SideSeatV2[] =>
    sideStates[side].ordering.map((seatNumber, positionOnSide) => ({
      positionOnSide,
      seatNumber,
      mode: sideStates[side].modes[positionOnSide] || 'default',
    }));

  // Flatten all sides using CLOCKWISE convention
  const ordering: number[] = [];
  const modes: SeatMode[] = [];

  // Top: left to right (as stored)
  ordering.push(...sideStates.top.ordering);
  modes.push(...sideStates.top.modes);

  // Right: top to bottom (as stored)
  ordering.push(...sideStates.right.ordering);
  modes.push(...sideStates.right.modes);

  // Bottom: right to left (reversed for clockwise traversal)
  ordering.push(...[...sideStates.bottom.ordering].reverse());
  modes.push(...[...sideStates.bottom.modes].reverse());

  // Left: bottom to top (reversed for clockwise traversal)
  ordering.push(...[...sideStates.left.ordering].reverse());
  modes.push(...[...sideStates.left.modes].reverse());

  return {
    type: 'rectangle',
    seatCount: ordering.length,
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
// MAIN EXPORTS
// ============================================================================

/** Scale a template to a target seat count */
export function scaleTemplateV2(
  template: TableTemplateV2,
  options: ScaleOptionsV2
): ScaledResultV2 {
  if (isCircleConfigV2(template.config)) {
    return scaleCircleTable(template.config, options);
  }
  if (isRectangleConfigV2(template.config)) {
    return scaleRectangleTable(template.config, options);
  }
  throw new Error('Unknown template config type');
}

/** Scale a config directly (without a full template) */
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
  }
  if (isRectangleConfigV2(config)) {
    return scaleRectangleTable(config, options);
  }
  throw new Error('Unknown config type');
}

/** Get the min/max seat range for a template */
export function getScaleRangeV2(template: TableTemplateV2): { min: number; max: number } {
  if (isCircleConfigV2(template.config)) {
    return { min: 2, max: 30 };
  }

  if (isRectangleConfigV2(template.config)) {
    let minSeats = 0;
    let maxSeats = 0;

    for (const side of ALL_SIDES) {
      const sideConfig = template.config.sides[side];
      if (sideConfig.enabled) {
        if (!sideConfig.scalable) {
          minSeats += sideConfig.seatCount;
          maxSeats += sideConfig.seatCount;
        } else {
          maxSeats += 20;
        }
      }
    }

    return {
      min: Math.max(2, minSeats),
      max: Math.min(60, maxSeats),
    };
  }

  return { min: 2, max: 30 };
}

// ============================================================================
// ORDERING GENERATION (exported for SeatOrderingPanel)
// ============================================================================

/**
 * Generate seat ordering based on direction, pattern, and start position.
 * For circle tables, delegates to the canonical circle pattern generators.
 * For rectangle opposite patterns, uses the rectangle-specific algorithm.
 */
export function generateOrdering(
  count: number,
  direction: DirectionV2,
  pattern: OrderingPatternTypeV2,
  startPosition: number,
  rectangleConfig?: { top: number; bottom: number; left: number; right: number }
): number[] {
  // Rectangle opposite has special handling (side-aware opposite pairing)
  if (pattern === 'opposite' && rectangleConfig) {
    return generateOppositeOrderingRectangle(count, direction, startPosition, rectangleConfig);
  }

  // All other patterns (including center-outward) delegate to circle generators
  return generateCircleOrderingByPattern(count, pattern, direction, startPosition);
}

/**
 * Generate opposite ordering for rectangle tables.
 * Pairs seats across opposite sides (top/bottom, left/right).
 */
function generateOppositeOrderingRectangle(
  count: number,
  direction: DirectionV2,
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
  for (let i = 0; i < top; i++) seatInfos.push({ position: pos++, side: 'top', indexOnSide: i });
  for (let i = 0; i < right; i++) seatInfos.push({ position: pos++, side: 'right', indexOnSide: i });
  for (let i = 0; i < bottom; i++) seatInfos.push({ position: pos++, side: 'bottom', indexOnSide: i });
  for (let i = 0; i < left; i++) seatInfos.push({ position: pos++, side: 'left', indexOnSide: i });

  const getOppositePosition = (seatInfo: SeatInfo): number | null => {
    const { side, indexOnSide } = seatInfo;

    if (side === 'top' && bottom > 0) {
      const oppositeIndex = top - 1 - indexOnSide;
      if (oppositeIndex >= 0 && oppositeIndex < bottom) {
        return top + right + oppositeIndex;
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
        return top + right + bottom + oppositeIndex;
      }
    }

    return null;
  };

  const startInfo = seatInfos.find(s => s.position === startPosition);
  if (!startInfo) {
    return generateCircleOrderingByPattern(count, 'sequential', direction, 0);
  }

  let seatNumber = 1;
  const visited = new Set<number>();
  const step = direction === 'clockwise' ? 1 : -1;

  for (let i = 0; i < count && seatNumber <= count; i++) {
    const currentPos = mod(startPosition + step * i, count);

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

  // Fill any remaining zeros (safety fallback)
  for (let i = 0; i < count; i++) {
    if (result[i] === 0) {
      result[i] = seatNumber++;
    }
  }

  return result;
}
