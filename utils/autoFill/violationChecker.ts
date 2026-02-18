/**
 * violationChecker.ts
 *
 * Final comprehensive violation detection run after all optimization passes.
 * Explicitly checks every sit-together and sit-away rule against the final
 * seat arrangement to produce a complete, deduplicated list of violations.
 *
 * This is the last step of the autofill pipeline, ensuring no violations are
 * missed regardless of what the optimization algorithms did or didn't achieve.
 * The resulting violations are stored and displayed to the user.
 */

import { ProximityRules } from '@/types/Event';
import { ProximityViolation } from '../violationDetector';
import { getAdjacentSeats } from './seatFinder';

/**
 * Perform a comprehensive final violation check on the completed seat arrangement.
 * Checks all sit-together rules (must be on same table AND adjacent) and all
 * sit-away rules (must NOT be adjacent if on the same table).
 * Returns a deduplicated array of ProximityViolation objects.
 */
export function performFinalViolationCheck(
  tables: any[],
  proximityRules: ProximityRules,
  guestLookup: Record<string, any>
): ProximityViolation[] {
  const violations: ProximityViolation[] = [];
  const processedPairs = new Set<string>(); // Track processed pairs to avoid duplicates

  console.log('=== FINAL VIOLATION CHECK ===');
  console.log(`Checking ${proximityRules.sitTogether.length} sit-together rules`);
  console.log(`Checking ${proximityRules.sitAway.length} sit-away rules`);

  // Build a map of guestId -> seat location for quick lookup
  const guestLocationMap = new Map<string, { table: any; seat: any }>();

  for (const table of tables) {
    for (const seat of table.seats || []) {
      const guestId = seat.assignedGuestId;
      if (guestId) {
        guestLocationMap.set(guestId, { table, seat });
      }
    }
  }

  // =========================================================================
  // CHECK ALL SIT-TOGETHER RULES
  // =========================================================================
  for (const rule of proximityRules.sitTogether) {
    const { guest1Id, guest2Id } = rule;

    // Create a unique pair key to avoid duplicate violations
    const pairKey = [guest1Id, guest2Id].sort().join('|') + '|together';
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    const guest1 = guestLookup[guest1Id];
    const guest2 = guestLookup[guest2Id];

    if (!guest1 || !guest2) {
      console.log(`  Sit-together: Skipping rule - guest not found (${guest1Id} or ${guest2Id})`);
      continue;
    }

    const loc1 = guestLocationMap.get(guest1Id);
    const loc2 = guestLocationMap.get(guest2Id);

    // Case 1: One or both guests not seated
    if (!loc1 || !loc2) {
      if (!loc1 && !loc2) {
        console.log(`  Sit-together: ${guest1.name} & ${guest2.name} - Neither seated (no violation)`);
      } else if (!loc1) {
        console.log(`  Sit-together: ${guest1.name} & ${guest2.name} - ${guest1.name} not seated (no violation)`);
      } else {
        console.log(`  Sit-together: ${guest1.name} & ${guest2.name} - ${guest2.name} not seated (no violation)`);
      }
      continue;
    }

    // Case 2: Guests on different tables
    if (loc1.table.id !== loc2.table.id) {
      console.log(`  Sit-together: ${guest1.name} & ${guest2.name} - VIOLATION (different tables: ${loc1.table.label} vs ${loc2.table.label})`);
      violations.push({
        type: 'sit-together',
        guest1Id,
        guest2Id,
        guest1Name: guest1.name,
        guest2Name: guest2.name,
        tableId: loc1.table.id,
        tableLabel: loc1.table.label,
        seat1Id: loc1.seat.id,
        seat2Id: loc2.seat.id,
        reason: `${guest1.name} and ${guest2.name} should sit together but are on different tables (${loc1.table.label} vs ${loc2.table.label})`,
      });
      continue;
    }

    // Case 3: Same table - check if adjacent
    const adjacentSeats = getAdjacentSeats(loc1.seat, loc1.table.seats);
    const isAdjacent = adjacentSeats.some(s => s.id === loc2.seat.id);

    if (isAdjacent) {
      console.log(`  Sit-together: ${guest1.name} & ${guest2.name} - OK (adjacent)`);
    } else {
      console.log(`  Sit-together: ${guest1.name} & ${guest2.name} - VIOLATION (not adjacent on ${loc1.table.label})`);
      violations.push({
        type: 'sit-together',
        guest1Id,
        guest2Id,
        guest1Name: guest1.name,
        guest2Name: guest2.name,
        tableId: loc1.table.id,
        tableLabel: loc1.table.label,
        seat1Id: loc1.seat.id,
        seat2Id: loc2.seat.id,
        reason: `${guest1.name} and ${guest2.name} should sit together but are not adjacent`,
      });
    }
  }

  // =========================================================================
  // CHECK ALL SIT-AWAY RULES
  // =========================================================================
  for (const rule of proximityRules.sitAway) {
    const { guest1Id, guest2Id } = rule;

    // Create a unique pair key to avoid duplicate violations
    const pairKey = [guest1Id, guest2Id].sort().join('|') + '|away';
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    const guest1 = guestLookup[guest1Id];
    const guest2 = guestLookup[guest2Id];

    if (!guest1 || !guest2) {
      console.log(`  Sit-away: Skipping rule - guest not found (${guest1Id} or ${guest2Id})`);
      continue;
    }

    const loc1 = guestLocationMap.get(guest1Id);
    const loc2 = guestLocationMap.get(guest2Id);

    // Case 1: One or both guests not seated - no violation possible
    if (!loc1 || !loc2) {
      console.log(`  Sit-away: ${guest1.name} & ${guest2.name} - OK (one or both not seated)`);
      continue;
    }

    // Case 2: Guests on different tables - no violation
    if (loc1.table.id !== loc2.table.id) {
      console.log(`  Sit-away: ${guest1.name} & ${guest2.name} - OK (different tables)`);
      continue;
    }

    // Case 3: Same table - check if adjacent (which would be a violation)
    const adjacentSeats = getAdjacentSeats(loc1.seat, loc1.table.seats);
    const isAdjacent = adjacentSeats.some(s => s.id === loc2.seat.id);

    if (isAdjacent) {
      console.log(`  Sit-away: ${guest1.name} & ${guest2.name} - VIOLATION (adjacent on ${loc1.table.label})`);
      violations.push({
        type: 'sit-away',
        guest1Id,
        guest2Id,
        guest1Name: guest1.name,
        guest2Name: guest2.name,
        tableId: loc1.table.id,
        tableLabel: loc1.table.label,
        seat1Id: loc1.seat.id,
        seat2Id: loc2.seat.id,
        reason: `${guest1.name} and ${guest2.name} should not sit together but are adjacent`,
      });
    } else {
      console.log(`  Sit-away: ${guest1.name} & ${guest2.name} - OK (not adjacent)`);
    }
  }

  console.log(`=== FINAL CHECK COMPLETE: ${violations.length} violations found ===`);

  return violations;
}
