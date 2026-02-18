/**
 * sitAwayOptimization.ts
 *
 * Post-placement optimization to satisfy sit-away proximity rules.
 * Runs after sit-together optimization and uses a swap-and-evaluate approach:
 *
 * For each sit-away pair that is currently adjacent:
 * 1. Find candidate seats that are NOT adjacent to the guest we want to avoid
 *    (candidates include seats on other tables for cross-table moves)
 * 2. Try up to MAX_ATTEMPTS (20) swaps, evaluating the total violation count
 *    (both sit-together and sit-away) after each attempted swap
 * 3. Keep the swap only if it reduces total violations
 * 4. If no improvement after all attempts, leave as-is (violation will be reported)
 *
 * The algorithm prioritizes moving the lower-priority, non-locked guest.
 * Same-table seats are preferred over cross-table moves.
 */

import { ProximityRules } from '@/types/Event';
import { LockedGuestLocation } from './autoFillTypes';
import { canPlaceGuestInSeat } from './seatCompatibility';
import { getSitAwayGuests } from './proximityRuleHelpers';
import { getAdjacentSeats } from './seatFinder';

/**
 * Count the total number of proximity violations for the current arrangement.
 * Includes both sit-together violations (not adjacent when they should be)
 * and sit-away violations (adjacent when they shouldn't be).
 */
function countCurrentViolations(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  guestLookup: Map<string, any>,
  lockedGuestMap: Map<string, LockedGuestLocation>
): number {
  let violations = 0;

  // Check sit-together violations
  for (const rule of proximityRules.sitTogether) {
    const guest1Loc = findGuestSeatForViolationCheck(rule.guest1Id, tables, seatToGuest, lockedGuestMap);
    const guest2Loc = findGuestSeatForViolationCheck(rule.guest2Id, tables, seatToGuest, lockedGuestMap);

    if (!guest1Loc || !guest2Loc) continue;
    if (guest1Loc.table.id !== guest2Loc.table.id) {
      violations++; // Different tables = violation
      continue;
    }

    const adjacent = getAdjacentSeats(guest1Loc.seat, guest1Loc.table.seats);
    const isAdjacent = adjacent.some(s => {
      const guestInSeat = seatToGuest.get(s.id) || (s.locked ? s.assignedGuestId : null);
      return guestInSeat === rule.guest2Id;
    });

    if (!isAdjacent) violations++;
  }

  // Check sit-away violations
  for (const rule of proximityRules.sitAway) {
    const guest1Loc = findGuestSeatForViolationCheck(rule.guest1Id, tables, seatToGuest, lockedGuestMap);
    const guest2Loc = findGuestSeatForViolationCheck(rule.guest2Id, tables, seatToGuest, lockedGuestMap);

    if (!guest1Loc || !guest2Loc) continue;
    if (guest1Loc.table.id !== guest2Loc.table.id) continue; // Different tables = OK

    const adjacent = getAdjacentSeats(guest1Loc.seat, guest1Loc.table.seats);
    const isAdjacent = adjacent.some(s => {
      const guestInSeat = seatToGuest.get(s.id) || (s.locked ? s.assignedGuestId : null);
      return guestInSeat === rule.guest2Id;
    });

    if (isAdjacent) violations++;
  }

  return violations;
}

/**
 * Find a guest's seat location, checking both the seatToGuest map and locked seats.
 * Used during violation counting where we need to account for both assignment sources.
 */
function findGuestSeatForViolationCheck(
  guestId: string,
  tables: any[],
  seatToGuest: Map<string, string>,
  lockedGuestMap: Map<string, LockedGuestLocation>
): { seat: any; table: any } | null {
  // Check locked guests first
  if (lockedGuestMap.has(guestId)) {
    const loc = lockedGuestMap.get(guestId)!;
    return { seat: loc.seat, table: loc.table };
  }

  // Check seatToGuest map
  for (const table of tables) {
    for (const seat of table.seats) {
      if (seatToGuest.get(seat.id) === guestId) {
        return { seat, table };
      }
    }
  }

  return null;
}

/**
 * Check if a seat is adjacent to a specific guest (considering both map and locked assignments).
 */
function isSeatAdjacentToGuest(
  seat: any,
  table: any,
  guestId: string,
  seatToGuest: Map<string, string>,
  _lockedGuestMap: Map<string, LockedGuestLocation>
): boolean {
  const adjacentSeats = getAdjacentSeats(seat, table.seats);

  for (const adjSeat of adjacentSeats) {
    const guestInAdjSeat = seatToGuest.get(adjSeat.id) || (adjSeat.locked ? adjSeat.assignedGuestId : null);
    if (guestInAdjSeat === guestId) return true;
  }

  return false;
}

/**
 * Get all candidate seats across all tables that are NOT adjacent to a specific guest.
 * Prioritizes same-table seats (lower priority number) over cross-table seats.
 * Sorted by priority then seat number for deterministic ordering.
 */
function getCandidateSeatsNotAdjacentTo(
  guestIdToAvoid: string,
  currentSeatId: string,
  guestToMove: any,
  tables: any[],
  seatToGuest: Map<string, string>,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  preferredTableId?: string
): { seat: any; table: any }[] {
  const candidates: { seat: any; table: any; priority: number }[] = [];

  for (const table of tables) {
    for (const seat of table.seats) {
      // Skip locked seats
      if (seat.locked) continue;

      // Skip current seat
      if (seat.id === currentSeatId) continue;

      // Check seat mode compatibility
      if (!canPlaceGuestInSeat(guestToMove, seat)) continue;

      // CRITICAL: Skip if this seat is adjacent to the guest we want to avoid
      if (isSeatAdjacentToGuest(seat, table, guestIdToAvoid, seatToGuest, lockedGuestMap)) {
        continue;
      }

      // Calculate priority (lower = better)
      // Same table gets priority 0, other tables get priority 1
      const priority = (preferredTableId && table.id === preferredTableId) ? 0 : 1;

      candidates.push({ seat, table, priority });
    }
  }

  // Sort by priority (same table first), then by seat number
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aNum = a.seat.seatNumber ?? 999;
    const bNum = b.seat.seatNumber ?? 999;
    return aNum - bNum;
  });

  return candidates.map(c => ({ seat: c.seat, table: c.table }));
}

/**
 * Main sit-away optimization function.
 * For each violated sit-away pair, attempts to separate them by finding
 * a new seat for the lower-priority guest that is not adjacent to the
 * higher-priority guest. Uses violation counting to ensure swaps are net positive.
 */
export function applySitAwayOptimization(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  allGuests: any[],
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): void {
  const MAX_ATTEMPTS = 20;
  const guestLookup = new Map(allGuests.map(g => [g.id, g]));

  if (proximityRules.sitAway.length === 0) return;

  console.log(`Processing ${proximityRules.sitAway.length} sit-away rules`);

  // Sort pairs by priority (higher priority guests first)
  const sortedPairs = [...proximityRules.sitAway]
    .map(rule => {
      const g1 = guestLookup.get(rule.guest1Id);
      const g2 = guestLookup.get(rule.guest2Id);

      if (!g1 || !g2) return null;

      const cmp = comparator(g1, g2);
      const higherPriority = cmp <= 0 ? g1 : g2;
      const lowerPriority = cmp <= 0 ? g2 : g1;

      return { rule, higherPriority, lowerPriority };
    })
    .filter(Boolean)
    .sort((a, b) => comparator(a!.higherPriority, b!.higherPriority));

  for (const pairData of sortedPairs) {
    if (!pairData) continue;

    const { higherPriority, lowerPriority } = pairData;

    console.log(`Checking sit-away: ${higherPriority.name} <-> ${lowerPriority.name}`);

    const higherIsLocked = lockedGuestMap.has(higherPriority.id);
    const lowerIsLocked = lockedGuestMap.has(lowerPriority.id);

    // If both are locked, we can't do anything
    if (higherIsLocked && lowerIsLocked) {
      console.log(`  Both guests are locked - cannot resolve`);
      continue;
    }

    // Find current locations
    const higherLoc = findGuestSeatForViolationCheck(higherPriority.id, tables, seatToGuest, lockedGuestMap);
    const lowerLoc = findGuestSeatForViolationCheck(lowerPriority.id, tables, seatToGuest, lockedGuestMap);

    if (!higherLoc || !lowerLoc) {
      console.log(`  One or both guests not seated - skipping`);
      continue;
    }

    // Check if they're on different tables (already OK)
    if (higherLoc.table.id !== lowerLoc.table.id) {
      console.log(`  Guests on different tables - already OK`);
      continue;
    }

    // Check if they're currently adjacent
    const adjacentToHigher = getAdjacentSeats(higherLoc.seat, higherLoc.table.seats);
    const areCurrentlyAdjacent = adjacentToHigher.some(s => {
      const guestInSeat = seatToGuest.get(s.id) || (s.locked ? s.assignedGuestId : null);
      return guestInSeat === lowerPriority.id;
    });

    if (!areCurrentlyAdjacent) {
      console.log(`  Guests not adjacent - already OK`);
      continue;
    }

    console.log(`  Guests ARE adjacent - attempting to separate`);

    // Determine who to move (prefer moving the lower priority, non-locked guest)
    let guestToMove: any;
    let guestToAvoid: any;
    let movingLoc: { seat: any; table: any };

    if (lowerIsLocked) {
      guestToMove = higherPriority;
      guestToAvoid = lowerPriority;
      movingLoc = higherLoc;
    } else {
      guestToMove = lowerPriority;
      guestToAvoid = higherPriority;
      movingLoc = lowerLoc;
    }

    // Get baseline violation count
    const baselineViolations = countCurrentViolations(
      seatToGuest, tables, proximityRules, guestLookup, lockedGuestMap
    );
    console.log(`  Baseline violations: ${baselineViolations}`);

    // Get candidate seats (not adjacent to the guest we're avoiding)
    const candidates = getCandidateSeatsNotAdjacentTo(
      guestToAvoid.id,
      movingLoc.seat.id,
      guestToMove,
      tables,
      seatToGuest,
      lockedGuestMap,
      movingLoc.table.id // Prefer same table
    );

    console.log(`  Found ${candidates.length} candidate seats`);

    let resolved = false;
    let attempts = 0;

    for (const candidate of candidates) {
      if (attempts >= MAX_ATTEMPTS) {
        console.log(`  Reached max attempts (${MAX_ATTEMPTS})`);
        break;
      }
      attempts++;

      const targetSeat = candidate.seat;
      const _targetTable = candidate.table;
      const targetGuestId = seatToGuest.get(targetSeat.id);

      // Save current state for potential rollback
      const originalMovingSeatId = movingLoc.seat.id;

      // Prepare the swap
      if (targetGuestId) {
        // Need to swap with another guest
        const targetGuest = guestLookup.get(targetGuestId);

        // Check if target guest can sit in moving guest's current seat
        if (!targetGuest || !canPlaceGuestInSeat(targetGuest, movingLoc.seat)) {
          continue; // Can't do this swap
        }

        // Check if swapping would put target guest adjacent to someone they should avoid
        const targetSitAwayGuests = getSitAwayGuests(targetGuestId, proximityRules.sitAway);
        const _wouldCreateNewViolation = targetSitAwayGuests.some(avoidId =>
          isSeatAdjacentToGuest(movingLoc.seat, movingLoc.table, avoidId, seatToGuest, lockedGuestMap)
        );

        // Perform the swap
        seatToGuest.delete(originalMovingSeatId);
        seatToGuest.delete(targetSeat.id);
        seatToGuest.set(targetSeat.id, guestToMove.id);
        seatToGuest.set(originalMovingSeatId, targetGuestId);

        // Count violations after swap
        const newViolations = countCurrentViolations(
          seatToGuest, tables, proximityRules, guestLookup, lockedGuestMap
        );

        if (newViolations < baselineViolations) {
          // Improvement! Keep the swap
          console.log(`  Swap ${guestToMove.name} <-> ${targetGuest.name}: violations ${baselineViolations} -> ${newViolations} OK`);
          resolved = true;
          break;
        } else {
          // No improvement, rollback
          seatToGuest.delete(originalMovingSeatId);
          seatToGuest.delete(targetSeat.id);
          seatToGuest.set(originalMovingSeatId, guestToMove.id);
          seatToGuest.set(targetSeat.id, targetGuestId);
        }
      } else {
        // Empty seat - just move
        seatToGuest.delete(originalMovingSeatId);
        seatToGuest.set(targetSeat.id, guestToMove.id);

        // Count violations after move
        const newViolations = countCurrentViolations(
          seatToGuest, tables, proximityRules, guestLookup, lockedGuestMap
        );

        if (newViolations < baselineViolations) {
          // Improvement! Keep the move
          console.log(`  Move ${guestToMove.name} to empty seat: violations ${baselineViolations} -> ${newViolations} OK`);
          resolved = true;
          break;
        } else {
          // No improvement, rollback
          seatToGuest.delete(targetSeat.id);
          seatToGuest.set(originalMovingSeatId, guestToMove.id);
        }
      }
    }

    if (!resolved) {
      console.log(`  Could not resolve sit-away violation for ${higherPriority.name} & ${lowerPriority.name} after ${attempts} attempts`);
    }
  }
}
