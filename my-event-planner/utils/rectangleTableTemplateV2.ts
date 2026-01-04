// // utils/RectangleTableTemplateV2.ts
// // Rectangle table template logic with clean 4-side configuration
// // Each side has TOP-DOWN ordering for intuitive seat management

// import { SeatMode } from '@/types/Seat';
// import {
//   RectangleTableConfigV2,
//   RectangleSideConfigV2,
//   RectangleSidesConfigV2,
//   SeatOrderingPatternV2,
//   SeatModePatternV2,
//   ScaledRectangleResultV2,
//   SideSeatV2,
//   DirectionV2,
// } from '@/types/TemplateV2';

// // ============================================================================
// // TYPES
// // ============================================================================

// /**
//  * Side names in clockwise order (matches visual layout)
//  */
// export type SideName = 'top' | 'right' | 'bottom' | 'left';

// /**
//  * Flat representation of a seat with side info
//  */
// interface FlatSeat {
//   globalPosition: number;  // Position in the flattened array (0-indexed)
//   side: SideName;
//   positionOnSide: number;  // TOP-DOWN position within the side
//   seatNumber?: number;
//   mode: SeatMode;
// }

// // ============================================================================
// // SIDE ORDER CONSTANTS
// // ============================================================================

// /**
//  * Clockwise order of sides (visual traversal around the table)
//  */
// export const CLOCKWISE_SIDES: SideName[] = ['top', 'right', 'bottom', 'left'];

// /**
//  * Counter-clockwise order of sides
//  */
// export const COUNTER_CLOCKWISE_SIDES: SideName[] = ['top', 'left', 'bottom', 'right'];

// /**
//  * Opposite side mapping
//  */
// export const OPPOSITE_SIDE: Record<SideName, SideName> = {
//   top: 'bottom',
//   bottom: 'top',
//   left: 'right',
//   right: 'left',
// };

// // ============================================================================
// // SIDE CONFIGURATION HELPERS
// // ============================================================================

// /**
//  * Get the effective seat count for a side (0 if disabled)
//  */
// export function getEffectiveSeatCount(side: RectangleSideConfigV2): number {
//   return side.enabled ? side.seatCount : 0;
// }

// /**
//  * Get total seat count from all sides
//  */
// export function getTotalSeatCount(sides: RectangleSidesConfigV2): number {
//   return (
//     getEffectiveSeatCount(sides.top) +
//     getEffectiveSeatCount(sides.right) +
//     getEffectiveSeatCount(sides.bottom) +
//     getEffectiveSeatCount(sides.left)
//   );
// }

// /**
//  * Get seat counts per side as a simple object
//  */
// export function getSeatCountsPerSide(sides: RectangleSidesConfigV2): Record<SideName, number> {
//   return {
//     top: getEffectiveSeatCount(sides.top),
//     right: getEffectiveSeatCount(sides.right),
//     bottom: getEffectiveSeatCount(sides.bottom),
//     left: getEffectiveSeatCount(sides.left),
//   };
// }

// /**
//  * Get the global position offset for a side
//  * (how many seats come before this side in the flattened array)
//  */
// export function getSideOffset(side: SideName, seatCounts: Record<SideName, number>): number {
//   switch (side) {
//     case 'top':
//       return 0;
//     case 'right':
//       return seatCounts.top;
//     case 'bottom':
//       return seatCounts.top + seatCounts.right;
//     case 'left':
//       return seatCounts.top + seatCounts.right + seatCounts.bottom;
//   }
// }

// /**
//  * Get the side name and position within side from a global position
//  */
// export function getPositionInfo(
//   globalPosition: number,
//   seatCounts: Record<SideName, number>
// ): { side: SideName; positionOnSide: number } {
//   let offset = 0;
  
//   if (globalPosition < offset + seatCounts.top) {
//     return { side: 'top', positionOnSide: globalPosition - offset };
//   }
//   offset += seatCounts.top;
  
//   if (globalPosition < offset + seatCounts.right) {
//     return { side: 'right', positionOnSide: globalPosition - offset };
//   }
//   offset += seatCounts.right;
  
//   if (globalPosition < offset + seatCounts.bottom) {
//     return { side: 'bottom', positionOnSide: globalPosition - offset };
//   }
//   offset += seatCounts.bottom;
  
//   return { side: 'left', positionOnSide: globalPosition - offset };
// }

// /**
//  * Get global position from side and position within side
//  */
// export function getGlobalPosition(
//   side: SideName,
//   positionOnSide: number,
//   seatCounts: Record<SideName, number>
// ): number {
//   return getSideOffset(side, seatCounts) + positionOnSide;
// }

// // ============================================================================
// // SCALING LOGIC
// // ============================================================================

// /**
//  * Scale the rectangle sides to reach a target total seat count
//  * Only scalable sides grow/shrink
//  */
// export function scaleSides(
//   baseSides: RectangleSidesConfigV2,
//   targetTotalSeats: number
// ): RectangleSidesConfigV2 {
//   const currentTotal = getTotalSeatCount(baseSides);
//   const difference = targetTotalSeats - currentTotal;
  
//   if (difference === 0) {
//     return deepCloneSides(baseSides);
//   }
  
//   // Identify scalable sides
//   const scalableSides: SideName[] = [];
//   if (baseSides.top.scalable && baseSides.top.enabled) scalableSides.push('top');
//   if (baseSides.right.scalable && baseSides.right.enabled) scalableSides.push('right');
//   if (baseSides.bottom.scalable && baseSides.bottom.enabled) scalableSides.push('bottom');
//   if (baseSides.left.scalable && baseSides.left.enabled) scalableSides.push('left');
  
//   if (scalableSides.length === 0) {
//     console.warn('No scalable sides defined, cannot scale rectangle');
//     return deepCloneSides(baseSides);
//   }
  
//   // Clone the sides
//   const result = deepCloneSides(baseSides);
  
//   if (difference > 0) {
//     // Adding seats - distribute evenly among scalable sides
//     let remaining = difference;
//     let sideIndex = 0;
    
//     while (remaining > 0) {
//       const sideName = scalableSides[sideIndex % scalableSides.length];
//       result[sideName].seatCount++;
//       remaining--;
//       sideIndex++;
//     }
//   } else {
//     // Removing seats - remove from scalable sides
//     let toRemove = Math.abs(difference);
//     let sideIndex = 0;
//     let iterations = 0;
//     const maxIterations = toRemove * scalableSides.length * 2;
    
//     while (toRemove > 0 && iterations < maxIterations) {
//       const sideName = scalableSides[sideIndex % scalableSides.length];
//       if (result[sideName].seatCount > 0) {
//         result[sideName].seatCount--;
//         toRemove--;
//       }
//       sideIndex++;
//       iterations++;
//     }
//   }
  
//   return result;
// }

// /**
//  * Deep clone sides configuration
//  */
// function deepCloneSides(sides: RectangleSidesConfigV2): RectangleSidesConfigV2 {
//   return {
//     top: { ...sides.top, seatModes: sides.top.seatModes ? [...sides.top.seatModes] : undefined },
//     right: { ...sides.right, seatModes: sides.right.seatModes ? [...sides.right.seatModes] : undefined },
//     bottom: { ...sides.bottom, seatModes: sides.bottom.seatModes ? [...sides.bottom.seatModes] : undefined },
//     left: { ...sides.left, seatModes: sides.left.seatModes ? [...sides.left.seatModes] : undefined },
//   };
// }

// // ============================================================================
// // SEAT ORDERING GENERATION
// // ============================================================================

// /**
//  * Generate sequential ordering for a rectangle table
//  * Traverses around the table in the specified direction
//  */
// function generateSequentialOrdering(
//   seatCounts: Record<SideName, number>,
//   direction: DirectionV2,
//   startPosition: number
// ): number[] {
//   const totalSeats = seatCounts.top + seatCounts.right + seatCounts.bottom + seatCounts.left;
//   const ordering = new Array<number>(totalSeats).fill(0);
  
//   const step = direction === 'clockwise' ? 1 : -1;
  
//   for (let seatNum = 1; seatNum <= totalSeats; seatNum++) {
//     const offset = seatNum - 1;
//     const position = (startPosition + step * offset + totalSeats * 10) % totalSeats;
//     ordering[position] = seatNum;
//   }
  
//   return ordering;
// }

// /**
//  * Generate alternating ordering for a rectangle table
//  */
// function generateAlternatingOrdering(
//   seatCounts: Record<SideName, number>,
//   direction: DirectionV2,
//   startPosition: number
// ): number[] {
//   const totalSeats = seatCounts.top + seatCounts.right + seatCounts.bottom + seatCounts.left;
//   const ordering = new Array<number>(totalSeats).fill(0);
  
//   // Place seat 1 at start
//   ordering[startPosition] = 1;
  
//   // Collect evens and odds
//   const evens: number[] = [];
//   const odds: number[] = [];
  
//   for (let i = 2; i <= totalSeats; i++) {
//     if (i % 2 === 0) {
//       evens.push(i);
//     } else {
//       odds.push(i);
//     }
//   }
  
//   const step = direction === 'clockwise' ? 1 : -1;
  
//   // Evens go in primary direction
//   for (let i = 0; i < evens.length; i++) {
//     const position = (startPosition + step * (i + 1) + totalSeats * 10) % totalSeats;
//     ordering[position] = evens[i];
//   }
  
//   // Odds go in opposite direction
//   for (let i = 0; i < odds.length; i++) {
//     const position = (startPosition - step * (i + 1) + totalSeats * 10) % totalSeats;
//     ordering[position] = odds[i];
//   }
  
//   return ordering;
// }

// /**
//  * Generate opposite ordering for a rectangle table
//  * Pairs seats across the table when possible
//  */
// function generateOppositeOrdering(
//   seatCounts: Record<SideName, number>,
//   direction: DirectionV2,
//   startPosition: number
// ): number[] {
//   const totalSeats = seatCounts.top + seatCounts.right + seatCounts.bottom + seatCounts.left;
//   const ordering = new Array<number>(totalSeats).fill(0);
  
//   // Build seat info with opposite positions
//   const seatInfos: Array<{
//     position: number;
//     side: SideName;
//     indexOnSide: number;
//   }> = [];
  
//   let pos = 0;
//   for (const side of CLOCKWISE_SIDES) {
//     for (let i = 0; i < seatCounts[side]; i++) {
//       seatInfos.push({ position: pos++, side, indexOnSide: i });
//     }
//   }
  
//   // Get opposite position for a seat
//   const getOppositePosition = (info: typeof seatInfos[0]): number | null => {
//     const oppSide = OPPOSITE_SIDE[info.side];
//     const oppSideCount = seatCounts[oppSide];
    
//     if (oppSideCount === 0) return null;
    
//     // Mirror the index: for top/bottom, last-index - current; same for left/right
//     // This ensures facing positions
//     const sideCount = seatCounts[info.side];
//     const oppositeIndex = oppSideCount - 1 - Math.round((info.indexOnSide / (sideCount - 1 || 1)) * (oppSideCount - 1));
    
//     if (oppositeIndex < 0 || oppositeIndex >= oppSideCount) return null;
    
//     return getGlobalPosition(oppSide, oppositeIndex, seatCounts);
//   };
  
//   let seatNumber = 1;
//   const visited = new Set<number>();
//   const step = direction === 'clockwise' ? 1 : -1;
  
//   // Traverse and pair
//   for (let i = 0; i < totalSeats && seatNumber <= totalSeats; i++) {
//     const currentPos = (startPosition + step * i + totalSeats * 10) % totalSeats;
    
//     if (visited.has(currentPos)) continue;
    
//     ordering[currentPos] = seatNumber++;
//     visited.add(currentPos);
    
//     // Try to place opposite
//     if (seatNumber <= totalSeats) {
//       const currentInfo = seatInfos.find(s => s.position === currentPos);
//       if (currentInfo) {
//         const oppositePos = getOppositePosition(currentInfo);
//         if (oppositePos !== null && !visited.has(oppositePos)) {
//           ordering[oppositePos] = seatNumber++;
//           visited.add(oppositePos);
//         }
//       }
//     }
//   }
  
//   // Fill any remaining (shouldn't happen normally)
//   for (let i = 0; i < totalSeats; i++) {
//     if (ordering[i] === 0) {
//       ordering[i] = seatNumber++;
//     }
//   }
  
//   return ordering;
// }

// /**
//  * Generate center-outward ordering for a specific side
//  * Used for bilateral/opposite patterns where seat 1 is at center
//  */
// export function generateCenterOutwardForSide(
//   side: SideName,
//   sideCount: number,
//   seatCounts: Record<SideName, number>,
//   direction: DirectionV2,
//   startingSeatNumber: number
// ): Array<{ position: number; seatNumber: number }> {
//   const results: Array<{ position: number; seatNumber: number }> = [];
  
//   if (sideCount === 0) return results;
  
//   const centerIndex = Math.floor((sideCount - 1) / 2);
//   let seatNum = startingSeatNumber;
  
//   // Start with center
//   results.push({
//     position: getGlobalPosition(side, centerIndex, seatCounts),
//     seatNumber: seatNum++,
//   });
  
//   // Alternate left and right from center
//   let leftOffset = 1;
//   let rightOffset = 1;
  
//   while (results.length < sideCount) {
//     const leftIndex = centerIndex - leftOffset;
//     const rightIndex = centerIndex + rightOffset;
    
//     if (direction === 'clockwise') {
//       if (rightIndex < sideCount) {
//         results.push({
//           position: getGlobalPosition(side, rightIndex, seatCounts),
//           seatNumber: seatNum++,
//         });
//         rightOffset++;
//       }
//       if (leftIndex >= 0 && results.length < sideCount) {
//         results.push({
//           position: getGlobalPosition(side, leftIndex, seatCounts),
//           seatNumber: seatNum++,
//         });
//         leftOffset++;
//       }
//     } else {
//       if (leftIndex >= 0) {
//         results.push({
//           position: getGlobalPosition(side, leftIndex, seatCounts),
//           seatNumber: seatNum++,
//         });
//         leftOffset++;
//       }
//       if (rightIndex < sideCount && results.length < sideCount) {
//         results.push({
//           position: getGlobalPosition(side, rightIndex, seatCounts),
//           seatNumber: seatNum++,
//         });
//         rightOffset++;
//       }
//     }
    
//     if (leftIndex < 0 && rightIndex >= sideCount) break;
//   }
  
//   return results;
// }

// /**
//  * Generate seat ordering based on the pattern configuration
//  */
// export function generateRectangleOrdering(
//   seatCounts: Record<SideName, number>,
//   pattern: SeatOrderingPatternV2
// ): number[] {
//   const totalSeats = seatCounts.top + seatCounts.right + seatCounts.bottom + seatCounts.left;
  
//   // For manual pattern, use the provided ordering (scaled if needed)
//   if (pattern.type === 'manual' && pattern.manualOrdering) {
//     return scaleManualOrdering(pattern.manualOrdering, totalSeats);
//   }
  
//   // Validate and normalize start position
//   const startPosition = Math.max(0, Math.min(pattern.startPosition, totalSeats - 1));
  
//   switch (pattern.type) {
//     case 'sequential':
//       return generateSequentialOrdering(seatCounts, pattern.direction, startPosition);
//     case 'alternating':
//       return generateAlternatingOrdering(seatCounts, pattern.direction, startPosition);
//     case 'opposite':
//       return generateOppositeOrdering(seatCounts, pattern.direction, startPosition);
//     default:
//       return generateSequentialOrdering(seatCounts, pattern.direction, startPosition);
//   }
// }

// /**
//  * Scale manual ordering to a new seat count
//  */
// function scaleManualOrdering(manual: number[], targetCount: number): number[] {
//   if (manual.length === targetCount) {
//     return [...manual];
//   }
  
//   const result = new Array<number>(targetCount);
  
//   for (let i = 0; i < targetCount; i++) {
//     const sourceIndex = Math.round((i / (targetCount - 1 || 1)) * (manual.length - 1));
//     const clampedIndex = Math.max(0, Math.min(manual.length - 1, sourceIndex));
//     const relativePosition = manual[clampedIndex] / manual.length;
//     result[i] = Math.round(relativePosition * targetCount) || (i + 1);
//   }
  
//   return normalizeOrdering(result, targetCount);
// }

// /**
//  * Normalize an ordering array
//  */
// function normalizeOrdering(ordering: number[], count: number): number[] {
//   const seen = new Set<number>();
//   const duplicates: number[] = [];
//   const missing: number[] = [];
  
//   for (let i = 0; i < count; i++) {
//     if (seen.has(ordering[i])) {
//       duplicates.push(i);
//     } else {
//       seen.add(ordering[i]);
//     }
//   }
  
//   for (let i = 1; i <= count; i++) {
//     if (!seen.has(i)) {
//       missing.push(i);
//     }
//   }
  
//   const result = [...ordering];
//   for (let i = 0; i < duplicates.length && i < missing.length; i++) {
//     result[duplicates[i]] = missing[i];
//   }
  
//   return result;
// }

// // ============================================================================
// // SEAT MODE GENERATION
// // ============================================================================

// /**
//  * Generate modes for a single side, scaling if needed
//  */
// function generateSideModes(
//   sideConfig: RectangleSideConfigV2,
//   targetCount: number,
//   globalPattern: SeatModePatternV2
// ): SeatMode[] {
//   if (targetCount === 0) return [];
  
//   // If side has manual modes and we're in manual mode, use them
//   if (sideConfig.seatModes && sideConfig.seatModes.length > 0) {
//     return scaleModeArray(sideConfig.seatModes, targetCount);
//   }
  
//   // Otherwise generate based on global pattern
//   return generateModesFromPattern(targetCount, globalPattern);
// }

// /**
//  * Generate modes from pattern for a given count
//  */
// function generateModesFromPattern(
//   count: number,
//   pattern: SeatModePatternV2
// ): SeatMode[] {
//   switch (pattern.type) {
//     case 'uniform':
//       return new Array<SeatMode>(count).fill(pattern.defaultMode);
      
//     case 'alternating':
//       if (pattern.alternatingModes) {
//         return Array.from({ length: count }, (_, i) => pattern.alternatingModes![i % 2]);
//       }
//       return new Array<SeatMode>(count).fill(pattern.defaultMode);
      
//     case 'repeating':
//       if (pattern.repeatingSequence && pattern.repeatingSequence.length > 0) {
//         return Array.from({ length: count }, (_, i) => 
//           pattern.repeatingSequence![i % pattern.repeatingSequence!.length]
//         );
//       }
//       return new Array<SeatMode>(count).fill(pattern.defaultMode);
      
//     case 'ratio':
//       return generateRatioModes(count, pattern);
      
//     case 'manual':
//       if (pattern.manualModes && pattern.manualModes.length > 0) {
//         return scaleModeArray(pattern.manualModes, count);
//       }
//       return new Array<SeatMode>(count).fill(pattern.defaultMode);
      
//     default:
//       return new Array<SeatMode>(count).fill(pattern.defaultMode);
//   }
// }

// /**
//  * Generate ratio-based modes
//  */
// function generateRatioModes(count: number, pattern: SeatModePatternV2): SeatMode[] {
//   if (!pattern.ratios) {
//     return new Array<SeatMode>(count).fill(pattern.defaultMode);
//   }
  
//   const targetCounts = {
//     'host-only': Math.round(pattern.ratios['host-only'] * count),
//     'external-only': Math.round(pattern.ratios['external-only'] * count),
//     'default': 0,
//   };
  
//   const assigned = targetCounts['host-only'] + targetCounts['external-only'];
//   targetCounts['default'] = Math.max(0, count - assigned);
  
//   if (assigned > count) {
//     const excess = assigned - count;
//     if (targetCounts['host-only'] >= targetCounts['external-only']) {
//       targetCounts['host-only'] -= excess;
//     } else {
//       targetCounts['external-only'] -= excess;
//     }
//   }
  
//   const result: SeatMode[] = [];
//   const remaining = { ...targetCounts };
  
//   const modeOrder: SeatMode[] = (['host-only', 'external-only', 'default'] as SeatMode[])
//     .filter(m => remaining[m] > 0)
//     .sort((a, b) => remaining[b] - remaining[a]);
  
//   for (let i = 0; i < count; i++) {
//     let bestMode: SeatMode = pattern.defaultMode;
//     let bestDebt = -Infinity;
    
//     const currentCounts = {
//       'host-only': result.filter(m => m === 'host-only').length,
//       'external-only': result.filter(m => m === 'external-only').length,
//       'default': result.filter(m => m === 'default').length,
//     };
    
//     for (const mode of modeOrder) {
//       if (remaining[mode] <= 0) continue;
      
//       const targetRatio = targetCounts[mode] / count;
//       const currentRatio = currentCounts[mode] / (i || 1);
//       const debt = targetRatio - currentRatio;
      
//       if (debt > bestDebt) {
//         bestDebt = debt;
//         bestMode = mode;
//       }
//     }
    
//     result.push(bestMode);
//     remaining[bestMode]--;
//   }
  
//   return result;
// }

// /**
//  * Scale a mode array to a new length
//  */
// function scaleModeArray(modes: SeatMode[], targetCount: number): SeatMode[] {
//   if (modes.length === targetCount) {
//     return [...modes];
//   }
  
//   if (modes.length === 0) {
//     return new Array<SeatMode>(targetCount).fill('default');
//   }
  
//   const result: SeatMode[] = [];
  
//   for (let i = 0; i < targetCount; i++) {
//     const sourcePosition = (i / (targetCount - 1 || 1)) * (modes.length - 1);
//     const index = Math.round(sourcePosition);
//     const clampedIndex = Math.max(0, Math.min(modes.length - 1, index));
//     result.push(modes[clampedIndex]);
//   }
  
//   return result;
// }

// /**
//  * Generate all seat modes for a rectangle table
//  */
// export function generateRectangleModes(
//   scaledSides: RectangleSidesConfigV2,
//   pattern: SeatModePatternV2
// ): SeatMode[] {
//   const seatCounts = getSeatCountsPerSide(scaledSides);
  
//   // If using manual mode with global manual modes, use those
//   if (pattern.type === 'manual' && pattern.manualModes) {
//     const totalSeats = getTotalSeatCount(scaledSides);
//     return scaleModeArray(pattern.manualModes, totalSeats);
//   }
  
//   // Generate per-side and combine
//   const topModes = generateSideModes(scaledSides.top, seatCounts.top, pattern);
//   const rightModes = generateSideModes(scaledSides.right, seatCounts.right, pattern);
//   const bottomModes = generateSideModes(scaledSides.bottom, seatCounts.bottom, pattern);
//   const leftModes = generateSideModes(scaledSides.left, seatCounts.left, pattern);
  
//   return [...topModes, ...rightModes, ...bottomModes, ...leftModes];
// }

// // ============================================================================
// // MAIN SCALING FUNCTION
// // ============================================================================

// /**
//  * Scale a rectangle table template to a specific seat count
//  * Returns the complete configuration for the scaled table
//  */
// export function scaleRectangleTemplate(
//   config: RectangleTableConfigV2,
//   targetSeatCount: number
// ): ScaledRectangleResultV2 {
//   // Clamp to min/max
//   const clampedCount = Math.max(
//     config.minSeats,
//     Math.min(config.maxSeats, targetSeatCount)
//   );
  
//   // Scale the sides
//   const scaledSides = scaleSides(config.sides, clampedCount);
//   const seatCounts = getSeatCountsPerSide(scaledSides);
//   const actualTotal = getTotalSeatCount(scaledSides);
  
//   // Generate ordering
//   const seatOrdering = generateRectangleOrdering(seatCounts, config.orderingPattern);
  
//   // Generate modes
//   const seatModes = generateRectangleModes(scaledSides, config.modePattern);
  
//   // Build detailed side arrays
//   const buildSideSeats = (side: SideName): SideSeatV2[] => {
//     const count = seatCounts[side];
//     const offset = getSideOffset(side, seatCounts);
    
//     return Array.from({ length: count }, (_, positionOnSide) => {
//       const globalPos = offset + positionOnSide;
//       return {
//         positionOnSide,
//         seatNumber: seatOrdering[globalPos],
//         mode: seatModes[globalPos],
//       };
//     });
//   };
  
//   return {
//     type: 'rectangle',
//     seatCount: actualTotal,
//     sideSeats: {
//       top: seatCounts.top,
//       right: seatCounts.right,
//       bottom: seatCounts.bottom,
//       left: seatCounts.left,
//     },
//     sides: {
//       top: buildSideSeats('top'),
//       right: buildSideSeats('right'),
//       bottom: buildSideSeats('bottom'),
//       left: buildSideSeats('left'),
//     },
//     seatOrdering,
//     seatModes,
//   };
// }

// // ============================================================================
// // HELPER FUNCTIONS
// // ============================================================================

// /**
//  * Get a visual preview of the ordering pattern
//  */
// export function getOrderingPreview(
//   seatCounts: Record<SideName, number>,
//   pattern: SeatOrderingPatternV2,
//   maxShow: number = 12
// ): string {
//   const ordering = generateRectangleOrdering(seatCounts, pattern);
  
//   const seat1Position = ordering.indexOf(1);
//   const totalSeats = seatCounts.top + seatCounts.right + seatCounts.bottom + seatCounts.left;
//   const preview: number[] = [];
  
//   for (let i = 0; i < Math.min(maxShow, totalSeats); i++) {
//     const pos = (seat1Position + i) % totalSeats;
//     preview.push(ordering[pos]);
//   }
  
//   const result = preview.join(' → ');
//   return totalSeats > maxShow ? `${result} ...` : result;
// }

// /**
//  * Get a visual preview of the mode pattern
//  */
// export function getModePreview(
//   scaledSides: RectangleSidesConfigV2,
//   pattern: SeatModePatternV2,
//   maxShow: number = 16
// ): string {
//   const modes = generateRectangleModes(scaledSides, pattern);
  
//   const modeToChar = (m: SeatMode) => 
//     m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D';
  
//   const preview = modes.slice(0, maxShow).map(modeToChar).join('');
//   return modes.length > maxShow ? `${preview}...` : preview;
// }

// /**
//  * Get a visual representation of modes by side
//  */
// export function getModesVisualization(
//   result: ScaledRectangleResultV2
// ): string {
//   const modeToChar = (m: SeatMode) => 
//     m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D';
  
//   const formatSide = (seats: SideSeatV2[]) => 
//     seats.map(s => modeToChar(s.mode)).join('') || '(empty)';
  
//   return [
//     `Top:    [${formatSide(result.sides.top)}] (${result.sideSeats.top} seats)`,
//     `Right:  [${formatSide(result.sides.right)}] (${result.sideSeats.right} seats)`,
//     `Bottom: [${formatSide(result.sides.bottom)}] (${result.sideSeats.bottom} seats)`,
//     `Left:   [${formatSide(result.sides.left)}] (${result.sideSeats.left} seats)`,
//   ].join('\n');
// }

// /**
//  * Get a visual representation of ordering by side
//  */
// export function getOrderingVisualization(
//   result: ScaledRectangleResultV2
// ): string {
//   const formatSide = (seats: SideSeatV2[]) => 
//     seats.map(s => s.seatNumber?.toString().padStart(2, ' ') || '??').join(',') || '(empty)';
  
//   return [
//     `Top:    [${formatSide(result.sides.top)}]`,
//     `Right:  [${formatSide(result.sides.right)}]`,
//     `Bottom: [${formatSide(result.sides.bottom)}]`,
//     `Left:   [${formatSide(result.sides.left)}]`,
//   ].join('\n');
// }

// /**
//  * Create a rectangle config from simple seat counts
//  */
// export function createRectangleConfigFromCounts(
//   top: number,
//   right: number,
//   bottom: number,
//   left: number,
//   options?: {
//     topScalable?: boolean;
//     rightScalable?: boolean;
//     bottomScalable?: boolean;
//     leftScalable?: boolean;
//   }
// ): RectangleSidesConfigV2 {
//   return {
//     top: {
//       seatCount: top,
//       scalable: options?.topScalable ?? true,
//       enabled: top > 0,
//     },
//     right: {
//       seatCount: right,
//       scalable: options?.rightScalable ?? false,
//       enabled: right > 0,
//     },
//     bottom: {
//       seatCount: bottom,
//       scalable: options?.bottomScalable ?? true,
//       enabled: bottom > 0,
//     },
//     left: {
//       seatCount: left,
//       scalable: options?.leftScalable ?? false,
//       enabled: left > 0,
//     },
//   };
// }

// // ============================================================================
// // EXPORTS
// // ============================================================================

// export default {
//   // Constants
//   CLOCKWISE_SIDES,
//   COUNTER_CLOCKWISE_SIDES,
//   OPPOSITE_SIDE,
  
//   // Side helpers
//   getEffectiveSeatCount,
//   getTotalSeatCount,
//   getSeatCountsPerSide,
//   getSideOffset,
//   getPositionInfo,
//   getGlobalPosition,
  
//   // Scaling
//   scaleSides,
  
//   // Ordering
//   generateRectangleOrdering,
//   generateCenterOutwardForSide,
  
//   // Modes
//   generateRectangleModes,
  
//   // Main scaling
//   scaleRectangleTemplate,
  
//   // Helpers
//   getOrderingPreview,
//   getModePreview,
//   getModesVisualization,
//   getOrderingVisualization,
//   createRectangleConfigFromCounts,
// };