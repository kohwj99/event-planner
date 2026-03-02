/**
 * autoFillOrchestrator.ts
 *
 * Main entry point for the seat autofill algorithm. This is the ONLY module
 * that accesses Zustand stores (seatStore, guestStore). All other modules
 * receive data as pure function parameters, making them independently testable.
 *
 * Orchestrates the full autofill pipeline:
 * 1. Data preparation: filter guests, build locked guest map, create comparator
 * 2. Guest prioritization: separate proximity-rule guests into priority pools
 * 3. Clear existing (unlocked) seat assignments
 * 4. Initial placement: assign guests to seats respecting table rules
 * 5. Tag group optimization: consolidate user-created tag groups (soft constraint)
 * 6. Sit-together optimization: consolidate clusters and optimize adjacency
 * 7. Sit-away optimization: separate guests who should not be adjacent
 * 8. Store assignment: write the final assignments to the Zustand store
 * 9. Final violation check: detect and report all remaining violations
 *
 * Also manages the module-level proximityViolations state, accessible via
 * getProximityViolations() for the stats panel.
 */

import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";
import { ProximityViolation } from '../violationDetector';
import { AutoFillOptions } from '@/types/Event';
import { makeComparator, isRandomizeOrderApplicable } from './guestSorting';
import { buildLockedGuestMap } from './lockedGuestHelpers';
import { buildPrioritizedGuestPools } from './guestPoolBuilder';
import { performInitialPlacement } from './initialPlacement';
import { applySitTogetherOptimization } from './sitTogetherOptimization';
import { applySitAwayOptimization } from './sitAwayOptimization';
import { applyTagGroupOptimization } from './tagGroupOptimization';
import { performFinalViolationCheck } from './violationChecker';
import { Guest } from '@/store/guestStore';

// Store violations globally for access by stats panel
let proximityViolations: ProximityViolation[] = [];

export function getProximityViolations(): ProximityViolation[] {
  return proximityViolations;
}

export async function autoFillSeats(options: AutoFillOptions = {}) {
  const {
    includeHost = true,
    includeExternal = true,
    sortRules = [{ field: "ranking", direction: "asc" }],
    tableRules,
    proximityRules = { sitTogether: [], sitAway: [] },
    randomizeOrder,
    tagGroups,
  } = options;

  const seatStore = useSeatStore.getState();
  const guestStore = useGuestStore.getState();

  if (!includeHost && !includeExternal) {
    return;
  }

  // Check if randomize order should be applied
  // Only applicable when there's exactly 1 sort rule that is by ranking
  const shouldRandomize = randomizeOrder?.enabled &&
    randomizeOrder.partitions.length > 0 &&
    isRandomizeOrderApplicable(sortRules);

  proximityViolations = [];

  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter(g => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter(g => !g.deleted) : [];
  const allGuests = [...hostPool, ...externalPool];

  const guestLookup: Record<string, Guest> = {};
  allGuests.forEach(g => guestLookup[g.id] = g);

  const tables = useSeatStore.getState().tables;
  const lockedGuestMap = buildLockedGuestMap(tables);

  const lockedGuestIds = new Set<string>();
  seatStore.tables.forEach(t =>
    (t.seats ?? []).forEach(s => {
      if (s.locked && s.assignedGuestId) {
        lockedGuestIds.add(s.assignedGuestId);
      }
    })
  );

  const totalAvailableSeats = tables.reduce((sum, table) => {
    return sum + table.seats.filter(s => !s.locked).length;
  }, 0);

  const hostCandidates = hostPool.filter(g => !lockedGuestIds.has(g.id));
  const externalCandidates = externalPool.filter(g => !lockedGuestIds.has(g.id));

  const comparator = makeComparator(sortRules);

  const { prioritizedHost, prioritizedExternal, guestsInProximityRules } = buildPrioritizedGuestPools(
    hostCandidates,
    externalCandidates,
    proximityRules,
    comparator,
    totalAvailableSeats
  );

  for (const table of seatStore.tables) {
    for (const seat of table.seats ?? []) {
      if (!seat.locked && seat.assignedGuestId) {
        seatStore.clearSeat(table.id, seat.id);
      }
    }
  }

  const tablesAfterClear = useSeatStore.getState().tables;
  const seatToGuest = performInitialPlacement(
    tablesAfterClear,
    prioritizedHost,
    prioritizedExternal,
    lockedGuestIds,
    lockedGuestMap,
    tableRules,
    comparator,
    proximityRules,
    shouldRandomize ? randomizeOrder : undefined,
    guestsInProximityRules,
    tagGroups
  );

  // Tag group optimization: consolidate user-created tag groups onto same tables.
  // Runs before proximity rules so that sit-together/sit-away can override if needed.
  if (tagGroups && tagGroups.length > 0) {
    applyTagGroupOptimization(
      seatToGuest,
      tablesAfterClear,
      tagGroups,
      allGuests,
      comparator,
      lockedGuestMap
    );
  }

  applySitTogetherOptimization(
    seatToGuest,
    tablesAfterClear,
    proximityRules,
    allGuests,
    comparator,
    lockedGuestMap
  );

  applySitAwayOptimization(
    seatToGuest,
    tablesAfterClear,
    proximityRules,
    allGuests,
    comparator,
    lockedGuestMap
  );

  // =========================================================================
  // ASSIGN GUESTS TO SEATS IN STORE
  // =========================================================================
  const seatStoreForAssign = useSeatStore.getState();

  // Temporarily disable proximity rules during assignment to avoid mid-assignment checks
  seatStoreForAssign.setProximityRules(null);
  seatStoreForAssign.setGuestLookup(guestLookup);

  for (const [seatId, guestId] of seatToGuest.entries()) {
    for (const table of tablesAfterClear) {
      const seat = table.seats.find(s => s.id === seatId);
      if (seat && !seat.locked) {
        seatStore.assignGuestToSeat(table.id, seatId, guestId);
        break;
      }
    }
  }

  // Re-enable proximity rules after all assignments
  seatStoreForAssign.setProximityRules(proximityRules);

  // =========================================================================
  // FINAL COMPREHENSIVE VIOLATION CHECK
  // This ensures ALL violations are captured after all optimizations are done
  // =========================================================================

  // Get the final state of tables after all assignments
  const finalTables = useSeatStore.getState().tables;

  // Perform comprehensive violation check on final arrangement
  proximityViolations = performFinalViolationCheck(
    finalTables,
    proximityRules,
    guestLookup
  );

  // Update the store with the detected violations
  useSeatStore.setState({ violations: proximityViolations });
}
