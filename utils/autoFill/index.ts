/**
 * autoFill/index.ts
 *
 * Barrel export for the autoFill algorithm module.
 * Provides the same public API as the original seatAutoFillHelper.tsx.
 */

// Functions
export { autoFillSeats, getProximityViolations } from './autoFillOrchestrator';
export { applyRandomizeOrder, isRandomizeOrderApplicable } from './guestSorting';
export { reorderForTagSimilarity, buildTagSignature } from './tagReordering';

// Types - re-exported from their canonical location in types/Event.ts
export type {
  SortField,
  SortDirection,
  SortRule,
  RatioRule,
  SpacingRule,
  TableRules,
  SitTogetherRule,
  SitAwayRule,
  ProximityRules,
  AutoFillOptions,
  RandomizePartition,
  RandomizeOrderConfig,
} from '@/types/Event';
