// // utils/templateMigrationV2.ts
// // Utilities for converting between V1 and V2 template formats
// // Allows gradual migration of existing templates to the new system

// import { SeatMode } from '@/types/Seat';
// import { EventType } from '@/types/Event';

// // V1 imports
// import {
//   TableTemplate,
//   Direction,
//   OrderingPattern,
//   SeatModePattern,
//   isEnhancedPattern,
//   RectangleGrowthConfig,
// } from '@/types/Template';

// // V2 imports
// import {
//   TableTemplateV2,
//   CircleTableConfigV2,
//   RectangleTableConfigV2,
//   RectangleSidesConfigV2,
//   SeatOrderingPatternV2,
//   SeatModePatternV2,
//   DirectionV2,
//   OrderingPatternV2,
//   SeatModePatternTypeV2,
//   createDefaultSideConfig,
// } from '@/types/TemplateV2';

// // ============================================================================
// // V1 -> V2 CONVERSION
// // ============================================================================

// /**
//  * Convert a V1 template to V2 format
//  */
// export function convertV1ToV2(v1Template: TableTemplate): TableTemplateV2 {
//   const { baseConfig } = v1Template;
  
//   let config: CircleTableConfigV2 | RectangleTableConfigV2;
  
//   if (baseConfig.type === 'round') {
//     config = convertCircleConfigV1ToV2(v1Template);
//   } else {
//     config = convertRectangleConfigV1ToV2(v1Template);
//   }
  
//   return {
//     id: v1Template.id,
//     name: v1Template.name,
//     description: v1Template.description,
//     sessionTypes: v1Template.sessionTypes,
//     isBuiltIn: v1Template.isBuiltIn,
//     isUserCreated: v1Template.isUserCreated,
//     color: v1Template.color,
//     config,
//     createdAt: v1Template.createdAt,
//     updatedAt: v1Template.updatedAt,
//   };
// }

// /**
//  * Convert V1 circle/round configuration to V2
//  */
// function convertCircleConfigV1ToV2(v1: TableTemplate): CircleTableConfigV2 {
//   const baseSeatCount = v1.baseConfig.baseSeatCount || 8;
  
//   return {
//     type: 'circle',
//     baseSeatCount,
//     minSeats: v1.minSeats,
//     maxSeats: v1.maxSeats,
//     orderingPattern: convertOrderingPatternV1ToV2(v1),
//     modePattern: convertModePatternV1ToV2(v1.seatModePattern, baseSeatCount),
//   };
// }

// /**
//  * Convert V1 rectangle configuration to V2
//  */
// function convertRectangleConfigV1ToV2(v1: TableTemplate): RectangleTableConfigV2 {
//   const baseSeats = v1.baseConfig.baseSeats || { top: 2, bottom: 2, left: 1, right: 1 };
//   const growthSides = v1.baseConfig.growthSides || { top: true, bottom: true, left: false, right: false };
  
//   const sides: RectangleSidesConfigV2 = {
//     top: {
//       seatCount: baseSeats.top,
//       scalable: growthSides.top,
//       enabled: baseSeats.top > 0,
//     },
//     right: {
//       seatCount: baseSeats.right,
//       scalable: growthSides.right,
//       enabled: baseSeats.right > 0,
//     },
//     bottom: {
//       seatCount: baseSeats.bottom,
//       scalable: growthSides.bottom,
//       enabled: baseSeats.bottom > 0,
//     },
//     left: {
//       seatCount: baseSeats.left,
//       scalable: growthSides.left,
//       enabled: baseSeats.left > 0,
//     },
//   };
  
//   const totalSeats = baseSeats.top + baseSeats.right + baseSeats.bottom + baseSeats.left;
  
//   return {
//     type: 'rectangle',
//     sides,
//     minSeats: v1.minSeats,
//     maxSeats: v1.maxSeats,
//     orderingPattern: convertOrderingPatternV1ToV2(v1),
//     modePattern: convertModePatternV1ToV2(v1.seatModePattern, totalSeats),
//   };
// }

// /**
//  * Convert V1 ordering pattern to V2
//  */
// function convertOrderingPatternV1ToV2(v1: TableTemplate): SeatOrderingPatternV2 {
//   const direction: DirectionV2 = v1.orderingDirection;
  
//   let type: OrderingPatternV2;
//   switch (v1.orderingPattern) {
//     case 'sequential':
//       type = 'sequential';
//       break;
//     case 'alternating':
//       type = 'alternating';
//       break;
//     case 'opposite':
//       type = 'opposite';
//       break;
//     default:
//       type = 'sequential';
//   }
  
//   return {
//     type,
//     direction,
//     startPosition: v1.startPosition,
//   };
// }

// /**
//  * Convert V1 seat mode pattern to V2
//  */
// function convertModePatternV1ToV2(v1Pattern: SeatModePattern, baseSeatCount: number): SeatModePatternV2 {
//   if (isEnhancedPattern(v1Pattern)) {
//     // V1 Enhanced Pattern -> V2
//     const { strategy, baseModes, sequence, ratios, defaultMode } = v1Pattern;
    
//     switch (strategy) {
//       case 'uniform':
//         return {
//           type: 'uniform',
//           defaultMode,
//         };
        
//       case 'repeating-sequence':
//         if (sequence && sequence.length > 0) {
//           // Check if it's a simple alternating pattern
//           if (sequence.length === 2 && sequence[0] !== sequence[1]) {
//             return {
//               type: 'alternating',
//               defaultMode,
//               alternatingModes: [sequence[0], sequence[1]] as [SeatMode, SeatMode],
//             };
//           }
//           return {
//             type: 'repeating',
//             defaultMode,
//             repeatingSequence: sequence,
//           };
//         }
//         break;
        
//       case 'ratio-interleaved':
//       case 'ratio-contiguous':
//         if (ratios) {
//           return {
//             type: 'ratio',
//             defaultMode,
//             ratios: {
//               'host-only': ratios['host-only'] || 0,
//               'external-only': ratios['external-only'] || 0,
//               'default': ratios['default'] || 0,
//             },
//           };
//         }
//         break;
        
//       case 'custom':
//         if (baseModes && baseModes.length > 0) {
//           return {
//             type: 'manual',
//             defaultMode,
//             manualModes: [...baseModes],
//           };
//         }
//         break;
//     }
    
//     // Fallback
//     return {
//       type: 'uniform',
//       defaultMode,
//     };
//   } else {
//     // V1 Legacy Pattern -> V2
//     switch (v1Pattern.type) {
//       case 'repeating':
//         if (v1Pattern.pattern && v1Pattern.pattern.length > 0) {
//           return {
//             type: 'repeating',
//             defaultMode: v1Pattern.defaultMode,
//             repeatingSequence: v1Pattern.pattern,
//           };
//         }
//         break;
        
//       case 'alternating':
//         if (v1Pattern.alternatingModes) {
//           return {
//             type: 'alternating',
//             defaultMode: v1Pattern.defaultMode,
//             alternatingModes: v1Pattern.alternatingModes,
//           };
//         }
//         break;
        
//       case 'specific':
//         if (v1Pattern.specificModes) {
//           // Convert specific modes to manual array
//           const manualModes: SeatMode[] = new Array(baseSeatCount).fill(v1Pattern.defaultMode);
//           Object.entries(v1Pattern.specificModes).forEach(([pos, mode]) => {
//             const index = parseInt(pos, 10);
//             if (index >= 0 && index < baseSeatCount) {
//               manualModes[index] = mode;
//             }
//           });
//           return {
//             type: 'manual',
//             defaultMode: v1Pattern.defaultMode,
//             manualModes,
//           };
//         }
//         break;
//     }
    
//     // Fallback
//     return {
//       type: 'uniform',
//       defaultMode: v1Pattern.defaultMode,
//     };
//   }
// }

// // ============================================================================
// // V2 -> V1 CONVERSION (for backwards compatibility)
// // ============================================================================

// /**
//  * Convert a V2 template back to V1 format
//  * Useful for maintaining backwards compatibility
//  */
// export function convertV2ToV1(v2Template: TableTemplateV2): TableTemplate {
//   const { config } = v2Template;
  
//   let baseConfig: TableTemplate['baseConfig'];
//   let startPosition: number;
  
//   if (config.type === 'circle') {
//     baseConfig = {
//       type: 'round',
//       baseSeatCount: config.baseSeatCount,
//     };
//     startPosition = config.orderingPattern.startPosition;
//   } else {
//     const { sides } = config;
//     baseConfig = {
//       type: 'rectangle',
//       baseSeats: {
//         top: sides.top.seatCount,
//         bottom: sides.bottom.seatCount,
//         left: sides.left.seatCount,
//         right: sides.right.seatCount,
//       },
//       growthSides: {
//         top: sides.top.scalable,
//         bottom: sides.bottom.scalable,
//         left: sides.left.scalable,
//         right: sides.right.scalable,
//       },
//     };
//     startPosition = config.orderingPattern.startPosition;
//   }
  
//   return {
//     id: v2Template.id,
//     name: v2Template.name,
//     description: v2Template.description,
//     sessionTypes: v2Template.sessionTypes,
//     isBuiltIn: v2Template.isBuiltIn,
//     isUserCreated: v2Template.isUserCreated,
//     color: v2Template.color,
//     baseConfig,
//     orderingDirection: config.orderingPattern.direction as Direction,
//     orderingPattern: convertOrderingTypeV2ToV1(config.orderingPattern.type),
//     startPosition,
//     seatModePattern: convertModePatternV2ToV1(config.modePattern),
//     minSeats: config.minSeats,
//     maxSeats: config.maxSeats,
//     createdAt: v2Template.createdAt,
//     updatedAt: v2Template.updatedAt,
//   };
// }

// /**
//  * Convert V2 ordering type to V1
//  */
// function convertOrderingTypeV2ToV1(v2Type: OrderingPatternV2): OrderingPattern {
//   switch (v2Type) {
//     case 'sequential':
//       return 'sequential';
//     case 'alternating':
//       return 'alternating';
//     case 'opposite':
//       return 'opposite';
//     case 'manual':
//       return 'sequential';  // Manual doesn't exist in V1, fallback to sequential
//     default:
//       return 'sequential';
//   }
// }

// /**
//  * Convert V2 mode pattern to V1 (enhanced format)
//  */
// function convertModePatternV2ToV1(v2Pattern: SeatModePatternV2): SeatModePattern {
//   switch (v2Pattern.type) {
//     case 'uniform':
//       return {
//         strategy: 'uniform',
//         baseModes: [v2Pattern.defaultMode],
//         defaultMode: v2Pattern.defaultMode,
//       };
      
//     case 'alternating':
//       if (v2Pattern.alternatingModes) {
//         return {
//           strategy: 'repeating-sequence',
//           baseModes: [...v2Pattern.alternatingModes],
//           sequence: [...v2Pattern.alternatingModes],
//           defaultMode: v2Pattern.defaultMode,
//         };
//       }
//       break;
      
//     case 'repeating':
//       if (v2Pattern.repeatingSequence) {
//         return {
//           strategy: 'repeating-sequence',
//           baseModes: [...v2Pattern.repeatingSequence],
//           sequence: [...v2Pattern.repeatingSequence],
//           defaultMode: v2Pattern.defaultMode,
//         };
//       }
//       break;
      
//     case 'ratio':
//       if (v2Pattern.ratios) {
//         return {
//           strategy: 'ratio-interleaved',
//           baseModes: [],  // Will be generated by scaler
//           ratios: { ...v2Pattern.ratios },
//           defaultMode: v2Pattern.defaultMode,
//         };
//       }
//       break;
      
//     case 'manual':
//       if (v2Pattern.manualModes) {
//         return {
//           strategy: 'custom',
//           baseModes: [...v2Pattern.manualModes],
//           defaultMode: v2Pattern.defaultMode,
//         };
//       }
//       break;
//   }
  
//   // Fallback
//   return {
//     strategy: 'uniform',
//     baseModes: [v2Pattern.defaultMode],
//     defaultMode: v2Pattern.defaultMode,
//   };
// }

// // ============================================================================
// // BATCH CONVERSION
// // ============================================================================

// /**
//  * Convert an array of V1 templates to V2
//  */
// export function convertAllV1ToV2(v1Templates: TableTemplate[]): TableTemplateV2[] {
//   return v1Templates.map(convertV1ToV2);
// }

// /**
//  * Convert an array of V2 templates to V1
//  */
// export function convertAllV2ToV1(v2Templates: TableTemplateV2[]): TableTemplate[] {
//   return v2Templates.map(convertV2ToV1);
// }

// // ============================================================================
// // VALIDATION
// // ============================================================================

// /**
//  * Check if a converted template is equivalent to the original
//  * (for verification purposes)
//  */
// export function verifyConversion(v1Original: TableTemplate, v2Converted: TableTemplateV2): {
//   isValid: boolean;
//   issues: string[];
// } {
//   const issues: string[] = [];
  
//   // Check basic properties
//   if (v1Original.id !== v2Converted.id) {
//     issues.push('ID mismatch');
//   }
  
//   if (v1Original.name !== v2Converted.name) {
//     issues.push('Name mismatch');
//   }
  
//   if (v1Original.minSeats !== v2Converted.config.minSeats) {
//     issues.push(`minSeats mismatch: ${v1Original.minSeats} vs ${v2Converted.config.minSeats}`);
//   }
  
//   if (v1Original.maxSeats !== v2Converted.config.maxSeats) {
//     issues.push(`maxSeats mismatch: ${v1Original.maxSeats} vs ${v2Converted.config.maxSeats}`);
//   }
  
//   // Check type
//   const v1Type = v1Original.baseConfig.type;
//   const v2Type = v2Converted.config.type === 'circle' ? 'round' : 'rectangle';
//   if (v1Type !== v2Type) {
//     issues.push(`Type mismatch: ${v1Type} vs ${v2Type}`);
//   }
  
//   // Check ordering direction
//   const v1Direction = v1Original.orderingDirection;
//   const v2Direction = v2Converted.config.orderingPattern.direction;
//   if (v1Direction !== v2Direction) {
//     issues.push(`Direction mismatch: ${v1Direction} vs ${v2Direction}`);
//   }
  
//   return {
//     isValid: issues.length === 0,
//     issues,
//   };
// }

// // ============================================================================
// // TYPE GUARDS
// // ============================================================================

// /**
//  * Check if a template is V1 format
//  */
// export function isV1Template(template: unknown): template is TableTemplate {
//   return (
//     typeof template === 'object' &&
//     template !== null &&
//     'baseConfig' in template &&
//     'orderingDirection' in template &&
//     'orderingPattern' in template &&
//     'seatModePattern' in template
//   );
// }

// /**
//  * Check if a template is V2 format
//  */
// export function isV2Template(template: unknown): template is TableTemplateV2 {
//   return (
//     typeof template === 'object' &&
//     template !== null &&
//     'config' in template &&
//     typeof (template as TableTemplateV2).config === 'object' &&
//     'type' in (template as TableTemplateV2).config
//   );
// }

// /**
//  * Get template version
//  */
// export function getTemplateVersion(template: unknown): 'v1' | 'v2' | 'unknown' {
//   if (isV2Template(template)) return 'v2';
//   if (isV1Template(template)) return 'v1';
//   return 'unknown';
// }

// // ============================================================================
// // EXPORTS
// // ============================================================================

// export default {
//   // V1 -> V2
//   convertV1ToV2,
//   convertAllV1ToV2,
  
//   // V2 -> V1
//   convertV2ToV1,
//   convertAllV2ToV1,
  
//   // Validation
//   verifyConversion,
  
//   // Type guards
//   isV1Template,
//   isV2Template,
//   getTemplateVersion,
// };