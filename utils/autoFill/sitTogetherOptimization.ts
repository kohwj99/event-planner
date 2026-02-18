/**
 * sitTogetherOptimization.ts
 *
 * Post-placement optimization to satisfy sit-together proximity rules.
 * Runs after initial placement and handles three phases:
 *
 * Phase 1 - CROSS-TABLE CONSOLIDATION:
 *   When cluster members are spread across multiple tables, moves guests to
 *   consolidate the cluster on a single target table. Target selection priority:
 *   (1) table with a locked cluster member, (2) table with the highest-priority
 *   cluster member, (3) table with the most available space.
 *
 * Phase 2 - WITHIN-TABLE ADJACENCY:
 *   For cluster members on the same table, scores candidate seat swaps by how
 *   many partners would become adjacent. Only keeps swaps that improve the score
 *   without significantly harming other guests' sit-together rules.
 *
 * Phase 3 - SECOND-PASS DIRECT SWAPS:
 *   Iterates over individual sit-together rules that are still violated after
 *   cluster optimization. Attempts direct moves/swaps (both cross-table and
 *   same-table) to satisfy each remaining pair.
 */

import { ProximityRules } from '@/types/Event';
import { LockedGuestLocation } from './autoFillTypes';
import { canPlaceGuestInSeat } from './seatCompatibility';
import { getAllSitTogetherPartners } from './proximityRuleHelpers';
import { buildSitTogetherClusters, getOptimalClusterOrder } from './clusterBuilder';
import {
  getAdjacentSeats,
  areGuestsAdjacent,
  findGuestSeat,
  getAvailableSeatsOnTable,
} from './seatFinder';

/**
 * Find the best target table for consolidating a cluster.
 * Priority: (1) table with locked cluster member, (2) table with highest-priority
 * cluster member, (3) table with most available space.
 */
function findBestTargetTable(
  clusterGuestIds: string[],
  tables: any[],
  seatToGuest: Map<string, string>,
  guestLookup: Map<string, any>,
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): { table: any; hasLockedMember: boolean } | null {

  // First check for locked cluster members
  for (const guestId of clusterGuestIds) {
    if (lockedGuestMap.has(guestId)) {
      const lockedLoc = lockedGuestMap.get(guestId)!;
      const table = tables.find(t => t.id === lockedLoc.tableId);
      if (table) {
        return { table, hasLockedMember: true };
      }
    }
  }

  // Find highest priority guest in cluster and their table
  let highestPriorityGuest: any = null;
  let highestPriorityGuestLoc: { seat: any; table: any } | null = null;

  for (const guestId of clusterGuestIds) {
    const guest = guestLookup.get(guestId);
    if (!guest) continue;

    const loc = findGuestSeat(guestId, tables, seatToGuest);
    if (!loc) continue;

    if (!highestPriorityGuest || comparator(guest, highestPriorityGuest) < 0) {
      highestPriorityGuest = guest;
      highestPriorityGuestLoc = loc;
    }
  }

  if (highestPriorityGuestLoc) {
    return { table: highestPriorityGuestLoc.table, hasLockedMember: false };
  }

  // Fallback: find table with most available contiguous seats
  let bestTable: any = null;
  let maxAvailable = 0;

  for (const table of tables) {
    const available = getAvailableSeatsOnTable(table, seatToGuest).length;
    if (available > maxAvailable) {
      maxAvailable = available;
      bestTable = table;
    }
  }

  return bestTable ? { table: bestTable, hasLockedMember: false } : null;
}

/**
 * Perform a cross-table move for a guest, optionally swapping with the occupant.
 * Returns true if the move was successful.
 */
function performCrossTableMove(
  guestId: string,
  targetSeat: any,
  targetTable: any,
  tables: any[],
  seatToGuest: Map<string, string>,
  guestLookup: Map<string, any>,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  _proximityRules: ProximityRules
): boolean {
  const guest = guestLookup.get(guestId);
  if (!guest) return false;

  // Can't move locked guests
  if (lockedGuestMap.has(guestId)) return false;

  // Check seat mode compatibility
  if (!canPlaceGuestInSeat(guest, targetSeat)) return false;

  // Find current location
  const currentLoc = findGuestSeat(guestId, tables, seatToGuest);
  if (!currentLoc) return false;

  const currentSeatId = currentLoc.seat.id;
  const targetSeatOccupant = seatToGuest.get(targetSeat.id);

  if (targetSeatOccupant) {
    // Need to swap
    const otherGuest = guestLookup.get(targetSeatOccupant);
    if (!otherGuest) return false;

    // Check if other guest can sit in current seat
    if (!canPlaceGuestInSeat(otherGuest, currentLoc.seat)) return false;

    // Check if other guest is locked
    if (lockedGuestMap.has(targetSeatOccupant)) return false;

    // Perform swap
    seatToGuest.delete(currentSeatId);
    seatToGuest.delete(targetSeat.id);
    seatToGuest.set(targetSeat.id, guestId);
    seatToGuest.set(currentSeatId, targetSeatOccupant);

    console.log(`  Cross-table swap: ${guest.name} <-> ${otherGuest.name}`);
  } else {
    // Empty seat - just move
    seatToGuest.delete(currentSeatId);
    seatToGuest.set(targetSeat.id, guestId);

    console.log(`  Cross-table move: ${guest.name} to ${targetTable.label}`);
  }

  return true;
}

/**
 * Main sit-together optimization function.
 * Processes clusters of guests who must sit together, consolidates them onto
 * single tables when needed, and optimizes within-table adjacency.
 */
export function applySitTogetherOptimization(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  allGuests: any[],
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): void {
  if (proximityRules.sitTogether.length === 0) return;

  const guestLookup = new Map(allGuests.map(g => [g.id, g]));

  // Build clusters of guests who should sit together
  const clusters = buildSitTogetherClusters(proximityRules.sitTogether);

  console.log(`Processing ${clusters.size} sit-together clusters`);

  // Process each cluster
  for (const [_rootId, clusterGuestIds] of clusters) {
    if (clusterGuestIds.length < 2) continue;

    // Get optimal ordering for this cluster
    const orderedGuests = getOptimalClusterOrder(
      clusterGuestIds,
      proximityRules.sitTogether,
      guestLookup,
      comparator
    );

    console.log(`Cluster: ${orderedGuests.map(id => guestLookup.get(id)?.name || id).join(' - ')}`);

    // Find current locations of all cluster members
    const clusterLocations: { guestId: string; seat: any; table: any; isLocked: boolean }[] = [];

    for (const guestId of orderedGuests) {
      const isLocked = lockedGuestMap.has(guestId);
      const location = findGuestSeat(guestId, tables, seatToGuest);

      if (location) {
        clusterLocations.push({
          guestId,
          seat: location.seat,
          table: location.table,
          isLocked
        });
      }
    }

    // Check if all cluster members are on the same table
    const tableIds = new Set(clusterLocations.map(loc => loc.table.id));

    // =========================================================================
    // PHASE 1: CROSS-TABLE CONSOLIDATION
    // If cluster spans multiple tables, try to move guests to the same table
    // =========================================================================
    if (tableIds.size > 1) {
      console.log(`  Cluster spans ${tableIds.size} tables - attempting cross-table consolidation`);

      // Find the best target table
      const targetTableResult = findBestTargetTable(
        clusterGuestIds,
        tables,
        seatToGuest,
        guestLookup,
        comparator,
        lockedGuestMap
      );

      if (!targetTableResult) {
        console.log(`  Could not find suitable target table for cluster`);
        continue;
      }

      const targetTable = targetTableResult.table;
      console.log(`  Target table: ${targetTable.label} (has locked member: ${targetTableResult.hasLockedMember})`);

      // Find guests that need to be moved to the target table
      const guestsToMove: string[] = [];
      for (const loc of clusterLocations) {
        if (loc.table.id !== targetTable.id && !loc.isLocked) {
          guestsToMove.push(loc.guestId);
        }
      }

      console.log(`  Guests to move: ${guestsToMove.map(id => guestLookup.get(id)?.name || id).join(', ')}`);

      // Find guests already on target table (as anchors)
      const anchorGuests = clusterLocations
        .filter(loc => loc.table.id === targetTable.id)
        .map(loc => loc.guestId);

      // Try to move each guest to target table, preferring seats adjacent to anchors
      for (const guestId of guestsToMove) {
        const guest = guestLookup.get(guestId);
        if (!guest) continue;

        // Get seats adjacent to anchor guests on target table
        const adjacentSeats: any[] = [];
        for (const anchorId of anchorGuests) {
          const anchorLoc = findGuestSeat(anchorId, tables, seatToGuest);
          if (anchorLoc && anchorLoc.table.id === targetTable.id) {
            const adjSeats = getAdjacentSeats(anchorLoc.seat, targetTable.seats);
            for (const adjSeat of adjSeats) {
              if (!adjSeat.locked && canPlaceGuestInSeat(guest, adjSeat)) {
                if (!adjacentSeats.find(s => s.id === adjSeat.id)) {
                  adjacentSeats.push(adjSeat);
                }
              }
            }
          }
        }

        // Try adjacent seats first (prefer empty ones)
        let moved = false;

        // Sort: empty seats first, then by seat number
        adjacentSeats.sort((a, b) => {
          const aEmpty = !seatToGuest.get(a.id);
          const bEmpty = !seatToGuest.get(b.id);
          if (aEmpty && !bEmpty) return -1;
          if (!aEmpty && bEmpty) return 1;
          return (a.seatNumber ?? 999) - (b.seatNumber ?? 999);
        });

        for (const targetSeat of adjacentSeats) {
          if (performCrossTableMove(
            guestId,
            targetSeat,
            targetTable,
            tables,
            seatToGuest,
            guestLookup,
            lockedGuestMap,
            proximityRules
          )) {
            moved = true;
            // Add this guest as a new anchor for subsequent moves
            anchorGuests.push(guestId);
            break;
          }
        }

        // If no adjacent seat worked, try any available seat on target table
        if (!moved) {
          const allTargetSeats = targetTable.seats
            .filter((s: any) => !s.locked && canPlaceGuestInSeat(guest, s))
            .sort((a: any, b: any) => {
              const aEmpty = !seatToGuest.get(a.id);
              const bEmpty = !seatToGuest.get(b.id);
              if (aEmpty && !bEmpty) return -1;
              if (!aEmpty && bEmpty) return 1;
              return (a.seatNumber ?? 999) - (b.seatNumber ?? 999);
            });

          for (const targetSeat of allTargetSeats) {
            if (performCrossTableMove(
              guestId,
              targetSeat,
              targetTable,
              tables,
              seatToGuest,
              guestLookup,
              lockedGuestMap,
              proximityRules
            )) {
              moved = true;
              anchorGuests.push(guestId);
              break;
            }
          }
        }

        if (!moved) {
          console.log(`  Could not move ${guest.name} to ${targetTable.label}`);
        }
      }

      // Re-check if cluster is now on same table
      const newLocations: { guestId: string; seat: any; table: any; isLocked: boolean }[] = [];
      for (const guestId of orderedGuests) {
        const isLocked = lockedGuestMap.has(guestId);
        const location = findGuestSeat(guestId, tables, seatToGuest);
        if (location) {
          newLocations.push({ guestId, seat: location.seat, table: location.table, isLocked });
        }
      }

      const newTableIds = new Set(newLocations.map(loc => loc.table.id));
      if (newTableIds.size > 1) {
        console.log(`  Cluster still spans ${newTableIds.size} tables after consolidation attempt`);
        // Continue to try within-table optimization for the largest group
      } else {
        console.log(`  Cluster successfully consolidated on ${targetTable.label}`);
      }

      // Update clusterLocations for within-table optimization
      clusterLocations.length = 0;
      clusterLocations.push(...newLocations);
    }

    // =========================================================================
    // PHASE 2: WITHIN-TABLE ADJACENCY OPTIMIZATION
    // =========================================================================

    // Re-check table distribution after potential consolidation
    const currentTableIds = new Set(clusterLocations.map(loc => loc.table.id));

    // Process each table that has cluster members
    for (const tableId of currentTableIds) {
      const tableLocations = clusterLocations.filter(loc => loc.table.id === tableId);
      if (tableLocations.length < 2) continue; // Need at least 2 on same table to optimize

      const table = tableLocations[0].table;
      const allSeats = table.seats;

      // Find the anchor: prioritize locked guests, then highest priority seated guest
      const lockedInCluster = tableLocations.filter(loc => loc.isLocked);
      const anchor = lockedInCluster.length > 0
        ? lockedInCluster[0]
        : tableLocations[0];

      if (!anchor) continue;

      // Try to arrange cluster members around the anchor
      const guestsOnThisTable = tableLocations.map(loc => loc.guestId);

      // For each guest in ordered cluster (except anchor), try to place adjacent
      for (let i = 0; i < guestsOnThisTable.length; i++) {
        const guestId = guestsOnThisTable[i];
        const guest = guestLookup.get(guestId);

        if (!guest) continue;
        if (lockedGuestMap.has(guestId)) continue; // Can't move locked guests

        // Get all partners this guest should be adjacent to (that are on this table)
        const allPartners = getAllSitTogetherPartners(guestId, proximityRules.sitTogether);
        const partnersOnTable = allPartners.filter(pid => guestsOnThisTable.includes(pid));

        // Find a seat that maximizes adjacency to partners
        const currentLocation = findGuestSeat(guestId, tables, seatToGuest);
        if (!currentLocation || currentLocation.table.id !== table.id) continue;

        // Count how many partners are currently adjacent
        const currentAdjacentPartners = partnersOnTable.filter(partnerId =>
          areGuestsAdjacent(guestId, partnerId, tables, seatToGuest, lockedGuestMap)
        );

        // If already adjacent to all partners on this table, skip
        if (currentAdjacentPartners.length === partnersOnTable.length) continue;

        // Find seats adjacent to at least one partner
        const partnerSeats: any[] = [];
        for (const partnerId of partnersOnTable) {
          const partnerLoc = findGuestSeat(partnerId, tables, seatToGuest);
          if (partnerLoc && partnerLoc.table.id === table.id) {
            partnerSeats.push(partnerLoc.seat);
          }
        }

        // Get all seats adjacent to any partner
        const candidateSeats: any[] = [];
        for (const partnerSeat of partnerSeats) {
          const adjSeats = getAdjacentSeats(partnerSeat, allSeats);
          for (const adjSeat of adjSeats) {
            if (adjSeat.locked) continue;
            if (!canPlaceGuestInSeat(guest, adjSeat)) continue;
            if (!candidateSeats.find(s => s.id === adjSeat.id)) {
              candidateSeats.push(adjSeat);
            }
          }
        }

        // Score each candidate seat by how many partners would be adjacent
        let bestSeat: any = null;
        let bestScore = currentAdjacentPartners.length;

        for (const candidateSeat of candidateSeats) {
          if (candidateSeat.id === currentLocation.seat.id) continue;

          // Simulate moving guest to this seat
          const adjacentToCandidateSeats = getAdjacentSeats(candidateSeat, allSeats);
          let score = 0;

          for (const partnerId of partnersOnTable) {
            const partnerLoc = findGuestSeat(partnerId, tables, seatToGuest);
            if (partnerLoc) {
              const isAdjacent = adjacentToCandidateSeats.some(s =>
                s.id === partnerLoc.seat.id ||
                seatToGuest.get(s.id) === partnerId ||
                (s.locked && s.assignedGuestId === partnerId)
              );
              if (isAdjacent) score++;
            }
          }

          if (score > bestScore) {
            bestScore = score;
            bestSeat = candidateSeat;
          }
        }

        // If we found a better seat, perform the swap
        if (bestSeat && bestScore > currentAdjacentPartners.length) {
          const currentGuestInBestSeat = seatToGuest.get(bestSeat.id);
          const guestCurrentSeat = currentLocation.seat;

          if (currentGuestInBestSeat) {
            // Need to swap
            const otherGuest = guestLookup.get(currentGuestInBestSeat);

            // Check if other guest can sit in current seat
            if (otherGuest && canPlaceGuestInSeat(otherGuest, guestCurrentSeat)) {
              // Check if this swap wouldn't break other sit-together rules
              const otherGuestPartners = getAllSitTogetherPartners(currentGuestInBestSeat, proximityRules.sitTogether);

              // Count how many partners the other guest is currently adjacent to
              const otherCurrentAdj = otherGuestPartners.filter(pid =>
                areGuestsAdjacent(currentGuestInBestSeat, pid, tables, seatToGuest, lockedGuestMap)
              ).length;

              // Simulate: how many would be adjacent after swap?
              const adjToGuestCurrentSeat = getAdjacentSeats(guestCurrentSeat, allSeats);
              const otherAfterSwapAdj = otherGuestPartners.filter(pid => {
                const partnerLoc = findGuestSeat(pid, tables, seatToGuest);
                if (!partnerLoc) return false;
                return adjToGuestCurrentSeat.some(s => s.id === partnerLoc.seat.id);
              }).length;

              // Only swap if we don't make things significantly worse for other guest
              if (otherAfterSwapAdj >= otherCurrentAdj - 1) {
                seatToGuest.delete(guestCurrentSeat.id);
                seatToGuest.delete(bestSeat.id);
                seatToGuest.set(bestSeat.id, guestId);
                seatToGuest.set(guestCurrentSeat.id, currentGuestInBestSeat);

                console.log(`  Swapped ${guest.name} to improve cluster adjacency`);
              }
            }
          } else {
            // Empty seat - just move
            seatToGuest.delete(guestCurrentSeat.id);
            seatToGuest.set(bestSeat.id, guestId);

            console.log(`  Moved ${guest.name} to empty adjacent seat`);
          }
        }
      }
    }
  }

  // =========================================================================
  // PHASE 3: Second pass - Direct swaps for remaining violations (WITH CROSS-TABLE)
  // =========================================================================
  for (const rule of proximityRules.sitTogether) {
    const guest1 = guestLookup.get(rule.guest1Id);
    const guest2 = guestLookup.get(rule.guest2Id);

    if (!guest1 || !guest2) continue;
    if (lockedGuestMap.has(rule.guest1Id) && lockedGuestMap.has(rule.guest2Id)) continue;

    // Check if already adjacent
    if (areGuestsAdjacent(rule.guest1Id, rule.guest2Id, tables, seatToGuest, lockedGuestMap)) {
      continue;
    }

    // Determine who to move (prefer moving lower priority guest)
    const cmp = comparator(guest1, guest2);
    const guestToMove = cmp <= 0 ? guest2 : guest1;
    const anchorGuest = cmp <= 0 ? guest1 : guest2;

    if (lockedGuestMap.has(guestToMove.id)) {
      // Try moving the other one instead
      if (!lockedGuestMap.has(anchorGuest.id)) {
        // Swap roles
        // Can't reassign const, so we use the actual logic below
      } else {
        continue; // Both locked, can't do anything
      }
    }

    const movingGuest = lockedGuestMap.has(guestToMove.id) ? anchorGuest : guestToMove;
    const stayingGuest = lockedGuestMap.has(guestToMove.id) ? guestToMove : anchorGuest;

    if (lockedGuestMap.has(movingGuest.id)) continue;

    const stayingLoc = findGuestSeat(stayingGuest.id, tables, seatToGuest);
    const movingLoc = findGuestSeat(movingGuest.id, tables, seatToGuest);

    if (!stayingLoc || !movingLoc) continue;

    // =========================================================================
    // Handle cross-table case in second pass
    // =========================================================================
    if (stayingLoc.table.id !== movingLoc.table.id) {
      console.log(`  Second pass cross-table: Moving ${movingGuest.name} to ${stayingGuest.name}'s table`);

      const adjacentToStaying = getAdjacentSeats(stayingLoc.seat, stayingLoc.table.seats);

      // Try empty adjacent seats first
      const emptyAdjacent = adjacentToStaying.find(s =>
        !s.locked &&
        !seatToGuest.get(s.id) &&
        canPlaceGuestInSeat(movingGuest, s)
      );

      if (emptyAdjacent) {
        seatToGuest.delete(movingLoc.seat.id);
        seatToGuest.set(emptyAdjacent.id, movingGuest.id);
        console.log(`  Cross-table direct move: ${movingGuest.name} to empty seat next to ${stayingGuest.name}`);
        continue;
      }

      // Try swapping with someone adjacent to staying guest
      for (const adjSeat of adjacentToStaying) {
        if (adjSeat.locked) continue;
        if (!canPlaceGuestInSeat(movingGuest, adjSeat)) continue;

        const adjGuestId = seatToGuest.get(adjSeat.id);
        if (!adjGuestId) continue;

        const adjGuest = guestLookup.get(adjGuestId);
        if (!adjGuest) continue;
        if (!canPlaceGuestInSeat(adjGuest, movingLoc.seat)) continue;
        if (lockedGuestMap.has(adjGuestId)) continue;

        // Check if adjacent guest has their own sit-together rules
        const adjGuestPartners = getAllSitTogetherPartners(adjGuestId, proximityRules.sitTogether);

        // Don't swap if it would break the adjacent guest's sit-together rule with staying guest
        if (adjGuestPartners.includes(stayingGuest.id)) continue;

        // Perform swap
        seatToGuest.delete(movingLoc.seat.id);
        seatToGuest.delete(adjSeat.id);
        seatToGuest.set(adjSeat.id, movingGuest.id);
        seatToGuest.set(movingLoc.seat.id, adjGuestId);

        console.log(`  Cross-table swap: ${movingGuest.name} <-> ${adjGuest.name} to satisfy sit-together`);
        break;
      }

      continue;
    }

    // Same table case (existing logic)
    const adjacentToAnchor = getAdjacentSeats(stayingLoc.seat, stayingLoc.table.seats);

    // Try to find an empty adjacent seat
    const emptyAdjacent = adjacentToAnchor.find(s =>
      !s.locked &&
      !seatToGuest.get(s.id) &&
      canPlaceGuestInSeat(movingGuest, s)
    );

    if (emptyAdjacent) {
      seatToGuest.delete(movingLoc.seat.id);
      seatToGuest.set(emptyAdjacent.id, movingGuest.id);
      console.log(`  Direct move: ${movingGuest.name} to sit next to ${stayingGuest.name}`);
      continue;
    }

    // Try swapping with someone adjacent to anchor
    for (const adjSeat of adjacentToAnchor) {
      if (adjSeat.locked) continue;
      if (!canPlaceGuestInSeat(movingGuest, adjSeat)) continue;

      const adjGuestId = seatToGuest.get(adjSeat.id);
      if (!adjGuestId) continue;

      const adjGuest = guestLookup.get(adjGuestId);
      if (!adjGuest) continue;
      if (!canPlaceGuestInSeat(adjGuest, movingLoc.seat)) continue;

      // Check if adjacent guest has their own sit-together rules
      const adjGuestPartners = getAllSitTogetherPartners(adjGuestId, proximityRules.sitTogether);

      // Don't swap if it would break the adjacent guest's sit-together rule with anchor
      if (adjGuestPartners.includes(stayingGuest.id)) continue;

      // Perform swap
      seatToGuest.delete(movingLoc.seat.id);
      seatToGuest.delete(adjSeat.id);
      seatToGuest.set(adjSeat.id, movingGuest.id);
      seatToGuest.set(movingLoc.seat.id, adjGuestId);

      console.log(`  Swap: ${movingGuest.name} <-> ${adjGuest.name} to satisfy sit-together`);
      break;
    }
  }
}
