// // utils/patternScaler.ts
// // Intelligent pattern scaling for seat mode configurations
// // Takes a detected pattern and scales it to a new seat count while preserving the pattern

// import { SeatMode } from '@/types/Seat';
// import {
//   DetectedPattern,
//   PatternStrategy,
//   ModeRatios,
//   detectPattern,
//   findRepeatingUnit,
//   calculateRatios,
// } from './patternDetector';

// // ============================================================================
// // SCALING FUNCTIONS FOR EACH STRATEGY
// // ============================================================================

// /**
//  * Scale a repeating sequence pattern
//  * The sequence will be repeated and truncated/extended as needed
//  * 
//  * Example: sequence [H,H,E,E] scaling to 10 seats = [H,H,E,E,H,H,E,E,H,H]
//  */
// function scaleRepeatingSequence(
//   sequence: SeatMode[],
//   targetCount: number
// ): SeatMode[] {
//   if (sequence.length === 0) {
//     return Array(targetCount).fill('default');
//   }
  
//   const result: SeatMode[] = [];
//   for (let i = 0; i < targetCount; i++) {
//     result.push(sequence[i % sequence.length]);
//   }
  
//   return result;
// }

// /**
//  * Scale a ratio-based interleaved pattern
//  * Distributes modes evenly throughout the seats while maintaining ratios
//  * 
//  * Example: 50% H, 50% E for 10 seats = [H,E,H,E,H,E,H,E,H,E]
//  * Example: 33% H, 33% E, 33% D for 9 seats = [H,E,D,H,E,D,H,E,D]
//  */
// function scaleRatioInterleaved(
//   ratios: ModeRatios,
//   targetCount: number
// ): SeatMode[] {
//   // Calculate target counts for each mode
//   const targetCounts: Record<SeatMode, number> = {
//     'host-only': Math.round(ratios['host-only'] * targetCount),
//     'external-only': Math.round(ratios['external-only'] * targetCount),
//     'default': 0,
//   };
  
//   // Adjust for rounding errors - default gets the remainder
//   const assigned = targetCounts['host-only'] + targetCounts['external-only'];
//   targetCounts['default'] = Math.max(0, targetCount - assigned);
  
//   // If we over-assigned, reduce the larger group
//   if (assigned > targetCount) {
//     const excess = assigned - targetCount;
//     if (targetCounts['host-only'] >= targetCounts['external-only']) {
//       targetCounts['host-only'] -= excess;
//     } else {
//       targetCounts['external-only'] -= excess;
//     }
//   }
  
//   // Build the modes array with interleaving using round-robin
//   const result: SeatMode[] = [];
//   const remaining = { ...targetCounts };
  
//   // Determine the order of modes based on their ratios (highest first)
//   const modeOrder: SeatMode[] = (['host-only', 'external-only', 'default'] as SeatMode[])
//     .filter(m => remaining[m] > 0)
//     .sort((a, b) => remaining[b] - remaining[a]);
  
//   // Use a balanced distribution algorithm
//   const totalRemaining = () => remaining['host-only'] + remaining['external-only'] + remaining['default'];
  
//   for (let i = 0; i < targetCount; i++) {
//     // Pick the mode that has the highest "debt" - 
//     // i.e., the one that's furthest behind its target ratio
//     let bestMode: SeatMode = 'default';
//     let bestDebt = -Infinity;
    
//     const currentCounts: Record<SeatMode, number> = {
//       'host-only': result.filter(m => m === 'host-only').length,
//       'external-only': result.filter(m => m === 'external-only').length,
//       'default': result.filter(m => m === 'default').length,
//     };
    
//     for (const mode of modeOrder) {
//       if (remaining[mode] <= 0) continue;
      
//       // Calculate how far behind this mode is from its target ratio
//       const targetRatio = targetCounts[mode] / targetCount;
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
//  * Scale a ratio-based contiguous (block) pattern
//  * Maintains blocks of each mode type while preserving ratios
//  * 
//  * Example: 50% H, 50% E with blockOrder [H,E] for 10 seats = [H,H,H,H,H,E,E,E,E,E]
//  */
// function scaleRatioContiguous(
//   ratios: ModeRatios,
//   blockOrder: SeatMode[],
//   targetCount: number
// ): SeatMode[] {
//   if (blockOrder.length === 0) {
//     return Array(targetCount).fill('default');
//   }
  
//   // Calculate seats for each block based on ratios
//   const blockSizes: number[] = [];
//   let totalAssigned = 0;
  
//   for (let i = 0; i < blockOrder.length; i++) {
//     const mode = blockOrder[i];
//     const ratio = ratios[mode] || 0;
    
//     if (i === blockOrder.length - 1) {
//       // Last block gets the remainder to ensure we hit exactly targetCount
//       blockSizes.push(targetCount - totalAssigned);
//     } else {
//       const size = Math.round(ratio * targetCount);
//       blockSizes.push(size);
//       totalAssigned += size;
//     }
//   }
  
//   // Build the result array
//   const result: SeatMode[] = [];
//   for (let i = 0; i < blockOrder.length; i++) {
//     const mode = blockOrder[i];
//     const size = Math.max(0, blockSizes[i]);
//     for (let j = 0; j < size; j++) {
//       result.push(mode);
//     }
//   }
  
//   // Ensure we have exactly targetCount seats
//   while (result.length < targetCount) {
//     result.push(blockOrder[blockOrder.length - 1] || 'default');
//   }
//   while (result.length > targetCount) {
//     result.pop();
//   }
  
//   return result;
// }

// /**
//  * Scale a uniform pattern (all same mode)
//  */
// function scaleUniform(mode: SeatMode, targetCount: number): SeatMode[] {
//   return Array(targetCount).fill(mode);
// }

// /**
//  * Scale a custom pattern by proportionally mapping positions
//  * Uses linear interpolation to map original positions to new positions
//  */
// function scaleCustom(
//   originalModes: SeatMode[],
//   targetCount: number
// ): SeatMode[] {
//   if (originalModes.length === 0) {
//     return Array(targetCount).fill('default');
//   }
  
//   if (originalModes.length === targetCount) {
//     return [...originalModes];
//   }
  
//   const result: SeatMode[] = [];
  
//   for (let i = 0; i < targetCount; i++) {
//     // Map the new position to the original position
//     const originalPosition = (i / (targetCount - 1 || 1)) * (originalModes.length - 1);
//     const index = Math.round(originalPosition);
//     const clampedIndex = Math.max(0, Math.min(originalModes.length - 1, index));
//     result.push(originalModes[clampedIndex]);
//   }
  
//   return result;
// }

// // ============================================================================
// // MAIN SCALING FUNCTION
// // ============================================================================

// /**
//  * Scale a detected pattern to a new seat count
//  */
// export function scalePattern(
//   pattern: DetectedPattern,
//   targetCount: number
// ): SeatMode[] {
//   if (targetCount <= 0) {
//     return [];
//   }
  
//   switch (pattern.strategy) {
//     case 'repeating-sequence':
//       if (pattern.sequence) {
//         return scaleRepeatingSequence(pattern.sequence, targetCount);
//       }
//       break;
      
//     case 'ratio-interleaved':
//       if (pattern.ratios) {
//         return scaleRatioInterleaved(pattern.ratios, targetCount);
//       }
//       break;
      
//     case 'ratio-contiguous':
//       if (pattern.ratios && pattern.blockOrder) {
//         return scaleRatioContiguous(pattern.ratios, pattern.blockOrder, targetCount);
//       }
//       break;
      
//     case 'uniform':
//       if (pattern.ratios) {
//         // Find the mode with 100% ratio
//         const mode = (Object.entries(pattern.ratios) as [SeatMode, number][])
//           .find(([_, ratio]) => ratio === 1)?.[0] || 'default';
//         return scaleUniform(mode, targetCount);
//       }
//       break;
      
//     case 'custom':
//       if (pattern.originalModes) {
//         return scaleCustom(pattern.originalModes, targetCount);
//       }
//       break;
//   }
  
//   // Fallback
//   return Array(targetCount).fill('default');
// }

// /**
//  * Convenience function: detect pattern from modes and scale to new count
//  */
// export function detectAndScale(
//   currentModes: SeatMode[],
//   targetCount: number
// ): SeatMode[] {
//   const pattern = detectPattern(currentModes);
//   return scalePattern(pattern, targetCount);
// }

// /**
//  * Scale modes while trying to preserve positions where possible
//  * This is useful when the user is incrementally adjusting seat count
//  */
// export function scaleModesIncrementally(
//   currentModes: SeatMode[],
//   targetCount: number
// ): SeatMode[] {
//   const currentCount = currentModes.length;
  
//   if (targetCount === currentCount) {
//     return [...currentModes];
//   }
  
//   // First detect the pattern
//   const pattern = detectPattern(currentModes);
  
//   // For small changes (+/- 1-2 seats), try to preserve existing positions
//   const smallChange = Math.abs(targetCount - currentCount) <= 2;
  
//   if (smallChange && pattern.strategy !== 'repeating-sequence') {
//     if (targetCount > currentCount) {
//       // Adding seats - append based on pattern
//       const scaled = scalePattern(pattern, targetCount);
//       // Preserve existing positions, only change new ones
//       return currentModes.concat(scaled.slice(currentCount));
//     } else {
//       // Removing seats - truncate
//       return currentModes.slice(0, targetCount);
//     }
//   }
  
//   // For larger changes or repeating patterns, do a full scale
//   return scalePattern(pattern, targetCount);
// }

// // ============================================================================
// // RECTANGLE TABLE HELPERS
// // ============================================================================

// /**
//  * Scale modes for a rectangle table, respecting the side structure
//  * Rectangle tables have seats on 4 sides: top, right, bottom, left
//  */
// export function scaleRectangleModes(
//   currentModes: SeatMode[],
//   currentSeats: { top: number; bottom: number; left: number; right: number },
//   targetSeats: { top: number; bottom: number; left: number; right: number }
// ): SeatMode[] {
//   const currentTotal = currentSeats.top + currentSeats.right + currentSeats.bottom + currentSeats.left;
//   const targetTotal = targetSeats.top + targetSeats.right + targetSeats.bottom + targetSeats.left;
  
//   if (currentTotal === 0) {
//     return Array(targetTotal).fill('default');
//   }
  
//   // Extract modes for each side
//   let offset = 0;
//   const topModes = currentModes.slice(offset, offset + currentSeats.top);
//   offset += currentSeats.top;
//   const rightModes = currentModes.slice(offset, offset + currentSeats.right);
//   offset += currentSeats.right;
//   const bottomModes = currentModes.slice(offset, offset + currentSeats.bottom);
//   offset += currentSeats.bottom;
//   const leftModes = currentModes.slice(offset, offset + currentSeats.left);
  
//   // Scale each side independently to preserve side-specific patterns
//   const scaledTop = scaleSideModes(topModes, targetSeats.top);
//   const scaledRight = scaleSideModes(rightModes, targetSeats.right);
//   const scaledBottom = scaleSideModes(bottomModes, targetSeats.bottom);
//   const scaledLeft = scaleSideModes(leftModes, targetSeats.left);
  
//   return [...scaledTop, ...scaledRight, ...scaledBottom, ...scaledLeft];
// }

// /**
//  * Scale modes for one side of a rectangle table
//  */
// function scaleSideModes(sideModes: SeatMode[], targetCount: number): SeatMode[] {
//   if (targetCount === 0) {
//     return [];
//   }
  
//   if (sideModes.length === 0) {
//     return Array(targetCount).fill('default');
//   }
  
//   // Detect and scale the pattern for this side
//   return detectAndScale(sideModes, targetCount);
// }

// // ============================================================================
// // PATTERN PREVIEW GENERATION
// // ============================================================================

// /**
//  * Generate a preview string showing how the pattern would look at different sizes
//  */
// export function generatePatternPreview(
//   modes: SeatMode[],
//   previewSizes: number[] = [6, 8, 10, 12]
// ): Record<number, string> {
//   const pattern = detectPattern(modes);
//   const previews: Record<number, string> = {};
  
//   for (const size of previewSizes) {
//     const scaled = scalePattern(pattern, size);
//     previews[size] = scaled
//       .map(m => m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D')
//       .join('');
//   }
  
//   return previews;
// }

// /**
//  * Get a compact string representation of modes
//  */
// export function modesToString(modes: SeatMode[]): string {
//   return modes
//     .map(m => m === 'host-only' ? 'H' : m === 'external-only' ? 'E' : 'D')
//     .join('');
// }

// /**
//  * Parse a string representation back to modes
//  */
// export function stringToModes(str: string): SeatMode[] {
//   return str.split('').map(c => {
//     switch (c.toUpperCase()) {
//       case 'H': return 'host-only';
//       case 'E': return 'external-only';
//       default: return 'default';
//     }
//   });
// }

// // ============================================================================
// // EXPORTS
// // ============================================================================

// export default {
//   scalePattern,
//   detectAndScale,
//   scaleModesIncrementally,
//   scaleRectangleModes,
//   generatePatternPreview,
//   modesToString,
//   stringToModes,
// };