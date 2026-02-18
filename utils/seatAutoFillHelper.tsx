/**
 * seatAutoFillHelper.tsx
 *
 * Backward compatibility shim. The autofill algorithm has been refactored
 * into smaller, testable modules under utils/autoFill/.
 * All public exports are re-exported here so existing import paths continue to work.
 */

// Functions
export {
  autoFillSeats,
  getProximityViolations,
  applyRandomizeOrder,
  isRandomizeOrderApplicable,
} from './autoFill';

// Types
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
} from './autoFill';
