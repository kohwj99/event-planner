// // utils/CircleTableTemplateV2.ts
// // Circle/Round table template logic with clean scaling
// // Handles seat ordering and seat mode patterns for circular tables

// import { SeatMode } from '@/types/Seat';
// import {
//   CircleTableConfigV2,
//   SeatOrderingPatternV2,
//   SeatModePatternV2,
//   ScaledCircleResultV2,
//   DirectionV2,
//   OrderingPatternV2,
// } from '@/types/TemplateV2';

// // ============================================================================
// // SEAT ORDERING GENERATION
// // ============================================================================

// /**
//  * Generate sequential ordering for a circle table
//  * Seats are numbered 1, 2, 3, ... in the specified direction from startPosition
//  * 
//  * @param seatCount - Total number of seats
//  * @param direction - Clockwise or counter-clockwise
//  * @param startPosition - Physical position (0-indexed) where seat #1 is placed
//  * @returns Array where index = physical position, value = seat number
//  */
// export function generateSequentialOrdering(
//   seatCount: number,
//   direction: DirectionV2,
//   startPosition: number
// ): number[] {
//   const ordering = new Array<number>(seatCount);
  
//   for (let seatNum = 1; seatNum <= seatCount; seatNum++) {
//     // Calculate position offset from start
//     const offset = seatNum - 1;
    
//     // Calculate physical position based on direction
//     let position: number;
//     if (direction === 'clockwise') {
//       position = (startPosition + offset) % seatCount;
//     } else {
//       position = (startPosition - offset + seatCount * 10) % seatCount;
//     }
    
//     ordering[position] = seatNum;
//   }
  
//   return ordering;
// }

// /**
//  * Generate alternating ordering for a circle table
//  * Seat 1 at startPosition, evens go one direction, odds go the other
//  * Result: 1 is at start, then alternating pattern spirals around
//  * 
//  * Example (8 seats, clockwise from position 0):
//  * Positions: [0,  1,  2,  3,  4,  5,  6,  7]
//  * Seats:     [1,  2,  4,  6,  8,  7,  5,  3]
//  */
// export function generateAlternatingOrdering(
//   seatCount: number,
//   direction: DirectionV2,
//   startPosition: number
// ): number[] {
//   const ordering = new Array<number>(seatCount).fill(0);
  
//   // Place seat 1 at start position
//   ordering[startPosition] = 1;
  
//   // Collect evens and odds
//   const evens: number[] = [];
//   const odds: number[] = [];
  
//   for (let i = 2; i <= seatCount; i++) {
//     if (i % 2 === 0) {
//       evens.push(i);
//     } else {
//       odds.push(i);
//     }
//   }
  
//   if (direction === 'clockwise') {
//     // Evens go clockwise from start
//     for (let i = 0; i < evens.length; i++) {
//       const position = (startPosition + 1 + i) % seatCount;
//       ordering[position] = evens[i];
//     }
//     // Odds go counter-clockwise from start
//     for (let i = 0; i < odds.length; i++) {
//       const position = (startPosition - 1 - i + seatCount * 10) % seatCount;
//       ordering[position] = odds[i];
//     }
//   } else {
//     // Evens go counter-clockwise from start
//     for (let i = 0; i < evens.length; i++) {
//       const position = (startPosition - 1 - i + seatCount * 10) % seatCount;
//       ordering[position] = evens[i];
//     }
//     // Odds go clockwise from start
//     for (let i = 0; i < odds.length; i++) {
//       const position = (startPosition + 1 + i) % seatCount;
//       ordering[position] = odds[i];
//     }
//   }
  
//   return ordering;
// }

// /**
//  * Generate opposite ordering for a circle table
//  * Pairs seats across the table: 1-2 face each other, 3-4 face each other, etc.
//  * 
//  * Example (8 seats, clockwise from position 0):
//  * Positions: [0,  1,  2,  3,  4,  5,  6,  7]
//  * Seats:     [1,  3,  5,  7,  2,  4,  6,  8]
//  */
// export function generateOppositeOrdering(
//   seatCount: number,
//   direction: DirectionV2,
//   startPosition: number
// ): number[] {
//   const ordering = new Array<number>(seatCount).fill(0);
//   const halfCount = Math.floor(seatCount / 2);
  
//   let seatNumber = 1;
//   const step = direction === 'clockwise' ? 1 : -1;
  
//   // Iterate through positions on one half, placing pairs
//   for (let i = 0; i < Math.ceil(seatCount / 2); i++) {
//     // Position for odd seat (1, 3, 5, ...)
//     const oddPosition = (startPosition + step * i + seatCount * 10) % seatCount;
//     ordering[oddPosition] = seatNumber++;
    
//     // Position for even seat (2, 4, 6, ...) - across the table
//     if (seatNumber <= seatCount) {
//       const evenPosition = (oddPosition + halfCount) % seatCount;
//       ordering[evenPosition] = seatNumber++;
//     }
//   }
  
//   return ordering;
// }

// /**
//  * Generate seat ordering based on the pattern configuration
//  */
// export function generateCircleOrdering(
//   seatCount: number,
//   pattern: SeatOrderingPatternV2
// ): number[] {
//   // For manual pattern, use the provided ordering (scaled if needed)
//   if (pattern.type === 'manual' && pattern.manualOrdering) {
//     return scaleManualOrdering(pattern.manualOrdering, seatCount);
//   }
  
//   // Validate and normalize start position
//   const startPosition = Math.max(0, Math.min(pattern.startPosition, seatCount - 1));
  
//   switch (pattern.type) {
//     case 'sequential':
//       return generateSequentialOrdering(seatCount, pattern.direction, startPosition);
//     case 'alternating':
//       return generateAlternatingOrdering(seatCount, pattern.direction, startPosition);
//     case 'opposite':
//       return generateOppositeOrdering(seatCount, pattern.direction, startPosition);
//     default:
//       return generateSequentialOrdering(seatCount, pattern.direction, startPosition);
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
//     // Map position proportionally
//     const sourceIndex = Math.round((i / (targetCount - 1 || 1)) * (manual.length - 1));
//     const clampedIndex = Math.max(0, Math.min(manual.length - 1, sourceIndex));
    
//     // Get the relative seat number and scale it
//     const relativePosition = manual[clampedIndex] / manual.length;
//     result[i] = Math.round(relativePosition * targetCount) || (i + 1);
//   }
  
//   // Ensure all seat numbers 1-targetCount are used exactly once
//   return normalizeOrdering(result, targetCount);
// }

// /**
//  * Normalize an ordering array to ensure all numbers 1-N are present
//  */
// function normalizeOrdering(ordering: number[], count: number): number[] {
//   // Check if valid
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
  
//   // Fix duplicates by assigning missing numbers
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
//  * Generate uniform modes (all seats same mode)
//  */
// function generateUniformModes(seatCount: number, mode: SeatMode): SeatMode[] {
//   return new Array<SeatMode>(seatCount).fill(mode);
// }

// /**
//  * Generate alternating modes
//  */
// function generateAlternatingModes(
//   seatCount: number,
//   modes: [SeatMode, SeatMode]
// ): SeatMode[] {
//   const result: SeatMode[] = [];
//   for (let i = 0; i < seatCount; i++) {
//     result.push(modes[i % 2]);
//   }
//   return result;
// }

// /**
//  * Generate repeating sequence modes
//  */
// function generateRepeatingModes(
//   seatCount: number,
//   sequence: SeatMode[]
// ): SeatMode[] {
//   if (sequence.length === 0) {
//     return generateUniformModes(seatCount, 'default');
//   }
  
//   const result: SeatMode[] = [];
//   for (let i = 0; i < seatCount; i++) {
//     result.push(sequence[i % sequence.length]);
//   }
//   return result;
// }

// /**
//  * Generate ratio-based modes
//  * Distributes modes evenly to maintain the specified ratios
//  */
// function generateRatioModes(
//   seatCount: number,
//   ratios: { 'host-only': number; 'external-only': number; 'default': number }
// ): SeatMode[] {
//   // Calculate target counts
//   const targetCounts = {
//     'host-only': Math.round(ratios['host-only'] * seatCount),
//     'external-only': Math.round(ratios['external-only'] * seatCount),
//     'default': 0,
//   };
  
//   // Adjust for rounding - default gets remainder
//   const assigned = targetCounts['host-only'] + targetCounts['external-only'];
//   targetCounts['default'] = Math.max(0, seatCount - assigned);
  
//   // Fix over-assignment
//   if (assigned > seatCount) {
//     const excess = assigned - seatCount;
//     if (targetCounts['host-only'] >= targetCounts['external-only']) {
//       targetCounts['host-only'] -= excess;
//     } else {
//       targetCounts['external-only'] -= excess;
//     }
//   }
  
//   // Distribute evenly using round-robin based on "debt"
//   const result: SeatMode[] = [];
//   const remaining = { ...targetCounts };
  
//   const modeOrder: SeatMode[] = (['host-only', 'external-only', 'default'] as SeatMode[])
//     .filter(m => remaining[m] > 0)
//     .sort((a, b) => remaining[b] - remaining[a]);
  
//   for (let i = 0; i < seatCount; i++) {
//     let bestMode: SeatMode = 'default';
//     let bestDebt = -Infinity;
    
//     const currentCounts = {
//       'host-only': result.filter(m => m === 'host-only').length,
//       'external-only': result.filter(m => m === 'external-only').length,
//       'default': result.filter(m => m === 'default').length,
//     };
    
//     for (const mode of modeOrder) {
//       if (remaining[mode] <= 0) continue;
      
//       const targetRatio = targetCounts[mode] / seatCount;
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
//  * Scale manual modes to a new seat count
//  */
// function scaleManualModes(manual: SeatMode[], targetCount: number): SeatMode[] {
//   if (manual.length === targetCount) {
//     return [...manual];
//   }
  
//   if (manual.length === 0) {
//     return generateUniformModes(targetCount, 'default');
//   }
  
//   const result: SeatMode[] = [];
  
//   for (let i = 0; i < targetCount; i++) {
//     // Map position proportionally
//     const sourcePosition = (i / (targetCount - 1 || 1)) * (manual.length - 1);
//     const index = Math.round(sourcePosition);
//     const clampedIndex = Math.max(0, Math.min(manual.length - 1, index));
//     result.push(manual[clampedIndex]);
//   }
  
//   return result;
// }

// /**
//  * Generate seat modes based on the pattern configuration
//  */
// export function generateCircleModes(
//   seatCount: number,
//   pattern: SeatModePatternV2
// ): SeatMode[] {
//   switch (pattern.type) {
//     case 'uniform':
//       return generateUniformModes(seatCount, pattern.defaultMode);
      
//     case 'alternating':
//       if (pattern.alternatingModes) {
//         return generateAlternatingModes(seatCount, pattern.alternatingModes);
//       }
//       return generateUniformModes(seatCount, pattern.defaultMode);
      
//     case 'repeating':
//       if (pattern.repeatingSequence && pattern.repeatingSequence.length > 0) {
//         return generateRepeatingModes(seatCount, pattern.repeatingSequence);
//       }
//       return generateUniformModes(seatCount, pattern.defaultMode);
      
//     case 'ratio':
//       if (pattern.ratios) {
//         return generateRatioModes(seatCount, pattern.ratios);
//       }
//       return generateUniformModes(seatCount, pattern.defaultMode);
      
//     case 'manual':
//       if (pattern.manualModes && pattern.manualModes.length > 0) {
//         return scaleManualModes(pattern.manualModes, seatCount);
//       }
//       return generateUniformModes(seatCount, pattern.defaultMode);
      
//     default:
//       return generateUniformModes(seatCount, pattern.defaultMode);
//   }
// }

// // ============================================================================
// // MAIN SCALING FUNCTION
// // ============================================================================

// /**
//  * Scale a circle table template to a specific seat count
//  * Returns the complete configuration for the scaled table
//  */
// export function scaleCircleTemplate(
//   config: CircleTableConfigV2,
//   targetSeatCount: number
// ): ScaledCircleResultV2 {
//   // Clamp to min/max
//   const seatCount = Math.max(
//     config.minSeats,
//     Math.min(config.maxSeats, targetSeatCount)
//   );
  
//   // Generate ordering and modes
//   const seatOrdering = generateCircleOrdering(seatCount, config.orderingPattern);
//   const seatModes = generateCircleModes(seatCount, config.modePattern);
  
//   // Build detailed seats array
//   const seats = Array.from({ length: seatCount }, (_, position) => ({
//     position,
//     seatNumber: seatOrdering[position],
//     mode: seatModes[position],
//   }));
  
//   return {
//     type: 'circle',
//     seatCount,
//     seats,
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
//   seatCount: number,
//   pattern: SeatOrderingPatternV2,
//   maxShow: number = 12
// ): string {
//   const ordering = generateCircleOrdering(seatCount, pattern);
  
//   // Find position of seat 1 and show from there
//   const seat1Position = ordering.indexOf(1);
//   const preview: number[] = [];
  
//   for (let i = 0; i < Math.min(maxShow, seatCount); i++) {
//     const pos = (seat1Position + i) % seatCount;
//     preview.push(ordering[pos]);
//   }
  
//   const result = preview.join(' → ');
//   return seatCount > maxShow ? `${result} ...` : result;
// }

// /**
//  * Get a visual preview of the mode pattern
//  */
// export function getModePreview(
//   seatCount: number,
//   pattern: SeatModePatternV2,
//   maxShow: number = 12
// ): string {
//   const modes = generateCircleModes(seatCount, pattern);
  
//   const modeToChar = (m: SeatMode) => 
//     m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D';
  
//   const preview = modes.slice(0, maxShow).map(modeToChar).join('');
//   return seatCount > maxShow ? `${preview}...` : preview;
// }

// /**
//  * Detect the pattern type from an existing modes array
//  */
// export function detectModePattern(modes: SeatMode[]): SeatModePatternV2 {
//   if (modes.length === 0) {
//     return { type: 'uniform', defaultMode: 'default' };
//   }
  
//   // Check if uniform
//   const firstMode = modes[0];
//   if (modes.every(m => m === firstMode)) {
//     return { type: 'uniform', defaultMode: firstMode };
//   }
  
//   // Check if alternating (exactly 2 modes, alternating)
//   const uniqueModes = [...new Set(modes)];
//   if (uniqueModes.length === 2) {
//     const isAlternating = modes.every((m, i) => m === uniqueModes[i % 2]);
//     if (isAlternating) {
//       return {
//         type: 'alternating',
//         defaultMode: 'default',
//         alternatingModes: [uniqueModes[0], uniqueModes[1]] as [SeatMode, SeatMode],
//       };
//     }
//   }
  
//   // Check for repeating sequence
//   for (let seqLen = 1; seqLen <= modes.length / 2; seqLen++) {
//     if (modes.length % seqLen !== 0) continue;
    
//     const sequence = modes.slice(0, seqLen);
//     let isRepeating = true;
    
//     for (let i = seqLen; i < modes.length; i++) {
//       if (modes[i] !== sequence[i % seqLen]) {
//         isRepeating = false;
//         break;
//       }
//     }
    
//     if (isRepeating) {
//       return {
//         type: 'repeating',
//         defaultMode: 'default',
//         repeatingSequence: sequence,
//       };
//     }
//   }
  
//   // Default to manual
//   return {
//     type: 'manual',
//     defaultMode: 'default',
//     manualModes: [...modes],
//   };
// }

// // ============================================================================
// // EXPORTS
// // ============================================================================

// export default {
//   // Ordering generation
//   generateSequentialOrdering,
//   generateAlternatingOrdering,
//   generateOppositeOrdering,
//   generateCircleOrdering,
  
//   // Mode generation
//   generateCircleModes,
  
//   // Main scaling
//   scaleCircleTemplate,
  
//   // Helpers
//   getOrderingPreview,
//   getModePreview,
//   detectModePattern,
// };