/**
 * tagGroupOptimization.ts
 *
 * Post-placement optimization to satisfy user-created tag-based sit-together groups.
 * Runs AFTER initial placement and BEFORE the proximity rules optimization passes
 * (sit-together, sit-away). This makes tag groups a softer constraint that proximity
 * rules can override if needed.
 *
 * Phase 1 - CROSS-TABLE CONSOLIDATION:
 *   When group members are spread across multiple tables, moves guests to consolidate
 *   the group on a single target table. Target selection priority:
 *   (1) table with a locked group member, (2) perfect-fit table (seat count matches
 *   group size with compatible seat modes), (3) table with the highest-priority group
 *   member (anchor's table), (4) table with most available space.
 *
 * Phase 1.5 - AGGRESSIVE DISPLACEMENT:
 *   When Phase 1 consolidation fails and the group occupies more than half the
 *   target table, displaces lower-priority non-group guests from the target table
 *   to make room. Displaced guests are re-seated on other tables in priority order.
 *   Starts from the lowest-priority occupant and iterates upward.
 *
 * Phase 2a - CONTIGUOUS BLOCK PLACEMENT:
 *   Attempts to place all group members in a connected chain of adjacent seats using
 *   BFS to find a contiguous block. When successful, all members form a daisy chain
 *   (A adjacent to B adjacent to C adjacent to D).
 *
 * Phase 2b - MULTI-PASS GREEDY ADJACENCY (fallback):
 *   When contiguous block placement fails (locked seats block path, seat mode
 *   incompatibilities), falls back to iterative greedy adjacency optimization.
 *   Runs up to 3 passes, stopping when no more improvements are found.
 *
 * Phase 3 - DIRECT SWAP CLEANUP:
 *   Iterates remaining non-adjacent pairs of group members and attempts targeted
 *   direct swaps to resolve them.
 *
 * No formal violation reporting is produced for tag groups, as they are softer
 * constraints than proximity rules.
 */

import { TagSitTogetherGroup } from '@/types/Event';
import { LockedGuestLocation } from './autoFillTypes';
import { canPlaceGuestInSeat } from './seatCompatibility';
import {
  getAdjacentSeats,
  areGuestsAdjacent,
  findGuestSeat,
  getAvailableSeatsOnTable,
} from './seatFinder';

/**
 * Check if a table's seat modes can accommodate a tag group's guest types.
 * Returns true if there are enough compatible seats for each guest type.
 */
function checkSeatModeCompatibility(
  table: any,
  groupGuestIds: string[],
  guestLookup: Map<string, any>,
  lockedGuestMap: Map<string, LockedGuestLocation>
): boolean {
  const unlockedSeats = (table.seats || []).filter((s: any) => !s.locked);

  // Count available seats by type
  let hostOnlySeats = 0;
  let externalOnlySeats = 0;
  let defaultSeats = 0;
  for (const seat of unlockedSeats) {
    const mode = seat.mode || 'default';
    if (mode === 'host-only') hostOnlySeats++;
    else if (mode === 'external-only') externalOnlySeats++;
    else defaultSeats++;
  }

  // Count group guests by type
  let hostGuests = 0;
  let externalGuests = 0;
  for (const gid of groupGuestIds) {
    if (lockedGuestMap.has(gid)) continue; // Locked guests already have seats
    const guest = guestLookup.get(gid);
    if (!guest) continue;
    if (guest.fromHost) hostGuests++;
    else externalGuests++;
  }

  // Host guests can sit in host-only or default seats
  // External guests can sit in external-only or default seats
  // Check if there are enough seats: host-only covers hosts, external-only covers externals,
  // default seats cover the remainder
  const remainingHosts = Math.max(0, hostGuests - hostOnlySeats);
  const remainingExternals = Math.max(0, externalGuests - externalOnlySeats);
  return remainingHosts + remainingExternals <= defaultSeats;
}

/**
 * Find the best target table for consolidating a tag group.
 * Priority: (1) table with locked group member, (2) perfect-fit table (seat count
 * matches group size with compatible seat modes), (3) table with highest-priority
 * group member (anchor's table), (4) table with most available space.
 */
function findBestTargetTableForGroup(
  groupGuestIds: string[],
  tables: any[],
  seatToGuest: Map<string, string>,
  guestLookup: Map<string, any>,
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): { table: any; hasLockedMember: boolean } | null {

  // (1) Check for locked group members
  for (const guestId of groupGuestIds) {
    if (lockedGuestMap.has(guestId)) {
      const lockedLoc = lockedGuestMap.get(guestId)!;
      const table = tables.find(t => t.id === lockedLoc.tableId);
      if (table) {
        return { table, hasLockedMember: true };
      }
    }
  }

  // (2) Perfect-fit table: unlocked seat count matches group size with compatible seat modes
  const nonLockedGroupSize = groupGuestIds.filter(gid => !lockedGuestMap.has(gid)).length;
  for (const table of tables) {
    const unlockedSeats = (table.seats || []).filter((s: any) => !s.locked);
    if (unlockedSeats.length === nonLockedGroupSize) {
      if (checkSeatModeCompatibility(table, groupGuestIds, guestLookup, lockedGuestMap)) {
        console.log(`  Perfect-fit table found: ${table.label} (${unlockedSeats.length} seats for ${nonLockedGroupSize} guests)`);
        return { table, hasLockedMember: false };
      }
    }
  }

  // Build table distribution: which tables have group members
  const tableByGuestPriority = new Map<string, any>();

  for (const guestId of groupGuestIds) {
    const loc = findGuestSeat(guestId, tables, seatToGuest);
    if (!loc) continue;

    const tableId = loc.table.id;
    const guest = guestLookup.get(guestId);
    if (!guest) continue;

    const currentBest = tableByGuestPriority.get(tableId);
    if (!currentBest || comparator(guest, currentBest.guest) < 0) {
      tableByGuestPriority.set(tableId, { guest, table: loc.table });
    }
  }

  // (3) Table with highest-priority group member (anchor's table always wins)
  let bestByPriority: { table: any; guest: any } | null = null;
  for (const [, entry] of tableByGuestPriority) {
    if (!bestByPriority || comparator(entry.guest, bestByPriority.guest) < 0) {
      bestByPriority = entry;
    }
  }

  if (bestByPriority) {
    return { table: bestByPriority.table, hasLockedMember: false };
  }

  // (4) Fallback: table with most available space
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
function performTagGroupMove(
  guestId: string,
  targetSeat: any,
  tables: any[],
  seatToGuest: Map<string, string>,
  guestLookup: Map<string, any>,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  protectedGuestIds: Set<string>
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
    // Need to swap - don't swap with locked or protected (other tag group) guests
    if (lockedGuestMap.has(targetSeatOccupant)) return false;
    if (protectedGuestIds.has(targetSeatOccupant)) return false;

    const otherGuest = guestLookup.get(targetSeatOccupant);
    if (!otherGuest) return false;

    // Check if other guest can sit in current seat
    if (!canPlaceGuestInSeat(otherGuest, currentLoc.seat)) return false;

    // Perform swap
    seatToGuest.delete(currentSeatId);
    seatToGuest.delete(targetSeat.id);
    seatToGuest.set(targetSeat.id, guestId);
    seatToGuest.set(currentSeatId, targetSeatOccupant);
  } else {
    // Empty seat - just move
    seatToGuest.delete(currentSeatId);
    seatToGuest.set(targetSeat.id, guestId);
  }

  return true;
}

/**
 * Build a set of all guest IDs across all tag groups (for protection during swaps).
 */
function buildAllTagGroupGuestIds(tagGroups: TagSitTogetherGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of tagGroups) {
    for (const guestId of group.guestIds) {
      ids.add(guestId);
    }
  }
  return ids;
}

/**
 * Find the best anchor seat for contiguous block placement.
 * Priority: locked group member > highest-priority member > member with most group-adjacent neighbors.
 */
function findBestAnchorForBlock(
  groupGuestIds: string[],
  table: any,
  seatToGuest: Map<string, string>,
  guestLookup: Map<string, any>,
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): { seat: any; guestId: string } | null {
  const allSeats = table.seats;
  const groupGuestSet = new Set(groupGuestIds);

  // (1) Locked group member on this table
  for (const guestId of groupGuestIds) {
    if (lockedGuestMap.has(guestId)) {
      const loc = findGuestSeat(guestId, [table], seatToGuest);
      if (loc && loc.table.id === table.id) {
        return { seat: loc.seat, guestId };
      }
    }
  }

  // (2) Highest-priority member (by user's sort rules)
  let bestByPriority: { seat: any; guestId: string; guest: any } | null = null;

  for (const guestId of groupGuestIds) {
    const guest = guestLookup.get(guestId);
    if (!guest) continue;
    const loc = findGuestSeat(guestId, [table], seatToGuest);
    if (!loc || loc.table.id !== table.id) continue;

    if (!bestByPriority || comparator(guest, bestByPriority.guest) < 0) {
      bestByPriority = { seat: loc.seat, guestId, guest };
    }
  }

  if (bestByPriority) {
    return { seat: bestByPriority.seat, guestId: bestByPriority.guestId };
  }

  // (3) Member with the most group-adjacent neighbors (fallback)
  let bestByNeighbors: { seat: any; guestId: string; count: number } | null = null;

  for (const guestId of groupGuestIds) {
    const loc = findGuestSeat(guestId, [table], seatToGuest);
    if (!loc || loc.table.id !== table.id) continue;

    const adjSeats = getAdjacentSeats(loc.seat, allSeats);
    let groupNeighborCount = 0;
    for (const adjSeat of adjSeats) {
      const occupant = seatToGuest.get(adjSeat.id) ?? (adjSeat.locked ? adjSeat.assignedGuestId : null);
      if (occupant && groupGuestSet.has(occupant)) groupNeighborCount++;
    }

    if (!bestByNeighbors || groupNeighborCount > bestByNeighbors.count) {
      bestByNeighbors = { seat: loc.seat, guestId, count: groupNeighborCount };
    }
  }

  if (bestByNeighbors && bestByNeighbors.count > 0) {
    return { seat: bestByNeighbors.seat, guestId: bestByNeighbors.guestId };
  }

  return null;
}

/**
 * BFS from an anchor seat to find N contiguous seats usable by the group.
 * A seat is "usable" if it is:
 * (a) occupied by a group member, or
 * (b) empty and compatible with at least one group member, or
 * (c) occupied by a non-locked, non-protected guest who can be swapped out
 *
 * Returns ordered list of seats forming a connected block, or null if insufficient.
 */
function bfsContiguousBlock(
  anchorSeat: any,
  allSeats: any[],
  groupSize: number,
  seatToGuest: Map<string, string>,
  groupGuestIds: string[],
  guestLookup: Map<string, any>,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  allTagGroupGuestIds: Set<string>
): any[] | null {
  const groupGuestSet = new Set(groupGuestIds);
  const block: any[] = [];
  const visited = new Set<string>();
  const queue: any[] = [anchorSeat];

  while (queue.length > 0 && block.length < groupSize) {
    const seat = queue.shift()!;
    if (visited.has(seat.id)) continue;
    visited.add(seat.id);

    // Check if this seat is usable for the group
    if (seat.locked) {
      // Locked seat: only usable if it belongs to a group member
      const lockedOccupant = seat.assignedGuestId;
      if (lockedOccupant && groupGuestSet.has(lockedOccupant)) {
        block.push(seat);
      } else {
        continue; // Locked non-group seat blocks BFS path
      }
    } else {
      const occupant = seatToGuest.get(seat.id);

      if (!occupant) {
        // Empty seat: usable if at least one group member can sit here
        const anyGroupMemberFits = groupGuestIds.some(gid => {
          const guest = guestLookup.get(gid);
          return guest && canPlaceGuestInSeat(guest, seat);
        });
        if (anyGroupMemberFits) {
          block.push(seat);
        } else {
          continue;
        }
      } else if (groupGuestSet.has(occupant)) {
        // Group member already here
        block.push(seat);
      } else {
        // Non-group occupant: can we swap them out?
        if (lockedGuestMap.has(occupant)) continue; // Can't displace locked guest
        if (allTagGroupGuestIds.has(occupant) && !groupGuestSet.has(occupant)) continue; // Protect other tag groups

        // Check that at least one group member can sit in this seat
        const anyGroupMemberFits = groupGuestIds.some(gid => {
          const guest = guestLookup.get(gid);
          return guest && canPlaceGuestInSeat(guest, seat);
        });
        if (anyGroupMemberFits) {
          block.push(seat);
        } else {
          continue;
        }
      }
    }

    // Add adjacent seats to BFS queue
    const adjSeats = getAdjacentSeats(seat, allSeats);
    for (const adjSeat of adjSeats) {
      if (!visited.has(adjSeat.id)) {
        queue.push(adjSeat);
      }
    }
  }

  return block.length >= groupSize ? block : null;
}

/**
 * Place all group members into a contiguous block of seats.
 * Group members already in the block stay. Others swap into block seats,
 * displacing non-group occupants to the vacated seats.
 */
function executeBlockPlacement(
  block: any[],
  groupGuestIds: string[],
  seatToGuest: Map<string, string>,
  guestLookup: Map<string, any>,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  tables: any[]
): void {
  const blockSeatIds = new Set(block.map(s => s.id));
  const groupGuestSet = new Set(groupGuestIds);

  // Find group members already in the block vs outside
  const groupMembersInBlock: string[] = [];
  const groupMembersOutside: string[] = [];

  for (const guestId of groupGuestIds) {
    if (lockedGuestMap.has(guestId)) {
      // Locked members stay where they are (should already be in block via anchor)
      groupMembersInBlock.push(guestId);
      continue;
    }

    const loc = findGuestSeat(guestId, tables, seatToGuest);
    if (loc && blockSeatIds.has(loc.seat.id)) {
      groupMembersInBlock.push(guestId);
    } else {
      groupMembersOutside.push(guestId);
    }
  }

  // Find block seats that need to be filled by group members
  // (currently empty or occupied by non-group guests)
  const seatsNeedingGroupMember: any[] = [];
  for (const seat of block) {
    const occupant = seatToGuest.get(seat.id) ?? (seat.locked ? seat.assignedGuestId : null);
    if (!occupant || !groupGuestSet.has(occupant)) {
      seatsNeedingGroupMember.push(seat);
    }
  }

  // Match group members outside to seats needing group members
  for (let i = 0; i < groupMembersOutside.length && i < seatsNeedingGroupMember.length; i++) {
    const guestId = groupMembersOutside[i];
    const guest = guestLookup.get(guestId);
    if (!guest) continue;
    if (lockedGuestMap.has(guestId)) continue;

    const targetSeat = seatsNeedingGroupMember[i];

    // Find a compatible target seat for this guest
    let assignedSeat: any = null;
    if (canPlaceGuestInSeat(guest, targetSeat)) {
      assignedSeat = targetSeat;
    } else {
      // Try other available seats in the block that need a group member
      for (let j = i + 1; j < seatsNeedingGroupMember.length; j++) {
        if (canPlaceGuestInSeat(guest, seatsNeedingGroupMember[j])) {
          // Swap the targets
          const temp = seatsNeedingGroupMember[i];
          seatsNeedingGroupMember[i] = seatsNeedingGroupMember[j];
          seatsNeedingGroupMember[j] = temp;
          assignedSeat = seatsNeedingGroupMember[i];
          break;
        }
      }
    }

    if (!assignedSeat) continue;

    // Find guest's current seat
    const currentLoc = findGuestSeat(guestId, tables, seatToGuest);
    if (!currentLoc) continue;

    const currentSeatId = currentLoc.seat.id;
    const targetOccupant = seatToGuest.get(assignedSeat.id);

    if (targetOccupant) {
      // Swap: move non-group occupant to guest's old seat
      const otherGuest = guestLookup.get(targetOccupant);
      if (otherGuest && canPlaceGuestInSeat(otherGuest, currentLoc.seat)) {
        seatToGuest.delete(currentSeatId);
        seatToGuest.delete(assignedSeat.id);
        seatToGuest.set(assignedSeat.id, guestId);
        seatToGuest.set(currentSeatId, targetOccupant);
      } else {
        // Can't swap cleanly - try to just place in an empty block seat
        const emptyBlockSeat = block.find(s =>
          !seatToGuest.get(s.id) && !s.locked && canPlaceGuestInSeat(guest, s)
        );
        if (emptyBlockSeat) {
          seatToGuest.delete(currentSeatId);
          seatToGuest.set(emptyBlockSeat.id, guestId);
        }
        // Otherwise skip this guest (can't place without breaking constraints)
      }
    } else {
      // Empty seat - just move
      seatToGuest.delete(currentSeatId);
      seatToGuest.set(assignedSeat.id, guestId);
    }
  }
}

/**
 * Attempt contiguous block placement for a group on a specific table.
 * Returns true if all group members were placed in a contiguous chain.
 */
function tryContiguousPlacement(
  groupGuestIds: string[],
  table: any,
  tables: any[],
  seatToGuest: Map<string, string>,
  guestLookup: Map<string, any>,
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  allTagGroupGuestIds: Set<string>
): boolean {
  const groupSize = groupGuestIds.length;

  // Find anchor
  const anchor = findBestAnchorForBlock(
    groupGuestIds, table, seatToGuest, guestLookup, comparator, lockedGuestMap
  );
  if (!anchor) return false;

  // BFS to find contiguous block
  const block = bfsContiguousBlock(
    anchor.seat, table.seats, groupSize, seatToGuest,
    groupGuestIds, guestLookup, lockedGuestMap, allTagGroupGuestIds
  );
  if (!block) return false;

  // Execute the placement
  executeBlockPlacement(block, groupGuestIds, seatToGuest, guestLookup, lockedGuestMap, tables);

  // Verify: check if all group members are now in the block
  const blockSeatIds = new Set(block.map(s => s.id));
  let allInBlock = true;
  for (const guestId of groupGuestIds) {
    const loc = findGuestSeat(guestId, tables, seatToGuest);
    if (!loc || !blockSeatIds.has(loc.seat.id)) {
      allInBlock = false;
      break;
    }
  }

  return allInBlock;
}

/**
 * Main tag group optimization function.
 * Processes user-created tag groups, consolidates them onto single tables,
 * and optimizes within-table adjacency using a contiguous chain strategy.
 *
 * Phase 1: Cross-table consolidation (move members to same table)
 * Phase 2a: Contiguous block placement (BFS to find adjacent seat chain)
 * Phase 2b: Multi-pass greedy adjacency fallback (if 2a fails)
 * Phase 3: Direct swap cleanup for remaining non-adjacent pairs
 */
export function applyTagGroupOptimization(
  seatToGuest: Map<string, string>,
  tables: any[],
  tagGroups: TagSitTogetherGroup[],
  allGuests: any[],
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): void {
  if (tagGroups.length === 0) return;

  const guestLookup = new Map(allGuests.map(g => [g.id, g]));
  const allTagGroupGuestIds = buildAllTagGroupGuestIds(tagGroups);

  console.log(`Processing ${tagGroups.length} tag group(s)`);

  for (const group of tagGroups) {
    if (group.guestIds.length < 2) continue;

    // Filter to only guests that are actually seated
    const seatedGuestIds = group.guestIds.filter(gid =>
      findGuestSeat(gid, tables, seatToGuest) !== null
    );

    if (seatedGuestIds.length < 2) continue;

    console.log(`Tag group [${group.tag}]: ${seatedGuestIds.map(id => guestLookup.get(id)?.name || id).join(', ')}`);

    // Find current locations of all group members
    const groupLocations: { guestId: string; seat: any; table: any; isLocked: boolean }[] = [];
    for (const guestId of seatedGuestIds) {
      const isLocked = lockedGuestMap.has(guestId);
      const location = findGuestSeat(guestId, tables, seatToGuest);
      if (location) {
        groupLocations.push({ guestId, seat: location.seat, table: location.table, isLocked });
      }
    }

    // Check if all group members are already on the same table
    const tableIds = new Set(groupLocations.map(loc => loc.table.id));

    // =========================================================================
    // PHASE 1: CROSS-TABLE CONSOLIDATION
    // =========================================================================
    if (tableIds.size > 1) {
      console.log(`  Group spans ${tableIds.size} tables - attempting consolidation`);

      const targetTableResult = findBestTargetTableForGroup(
        seatedGuestIds,
        tables,
        seatToGuest,
        guestLookup,
        comparator,
        lockedGuestMap
      );

      if (!targetTableResult) {
        console.log(`  Could not find suitable target table for group`);
        continue;
      }

      const targetTable = targetTableResult.table;
      console.log(`  Target table: ${targetTable.label}`);

      // Identify guests needing to move
      const guestsToMove = groupLocations
        .filter(loc => loc.table.id !== targetTable.id && !loc.isLocked)
        .map(loc => loc.guestId);

      // Build set of other tag group guests to protect from swaps
      // (excluding the current group's members, since we're moving those)
      const protectedGuestIds = new Set<string>();
      for (const gid of allTagGroupGuestIds) {
        if (!seatedGuestIds.includes(gid)) {
          protectedGuestIds.add(gid);
        }
      }

      // Anchors: group members already on target table
      const anchorGuestIds = groupLocations
        .filter(loc => loc.table.id === targetTable.id)
        .map(loc => loc.guestId);

      for (const guestId of guestsToMove) {
        const guest = guestLookup.get(guestId);
        if (!guest) continue;

        // Get seats adjacent to anchor guests on target table
        const adjacentSeats: any[] = [];
        for (const anchorId of anchorGuestIds) {
          const anchorLoc = findGuestSeat(anchorId, tables, seatToGuest);
          if (anchorLoc && anchorLoc.table.id === targetTable.id) {
            const adjSeats = getAdjacentSeats(anchorLoc.seat, targetTable.seats);
            for (const adjSeat of adjSeats) {
              if (!adjSeat.locked && canPlaceGuestInSeat(guest, adjSeat)) {
                if (!adjacentSeats.find((s: any) => s.id === adjSeat.id)) {
                  adjacentSeats.push(adjSeat);
                }
              }
            }
          }
        }

        // Sort: empty seats first
        adjacentSeats.sort((a: any, b: any) => {
          const aEmpty = !seatToGuest.get(a.id);
          const bEmpty = !seatToGuest.get(b.id);
          if (aEmpty && !bEmpty) return -1;
          if (!aEmpty && bEmpty) return 1;
          return 0;
        });

        let moved = false;

        // Try adjacent seats first
        for (const targetSeat of adjacentSeats) {
          if (performTagGroupMove(guestId, targetSeat, tables, seatToGuest, guestLookup, lockedGuestMap, protectedGuestIds)) {
            moved = true;
            anchorGuestIds.push(guestId);
            break;
          }
        }

        // Fallback: any available seat on target table
        if (!moved) {
          const allTargetSeats = targetTable.seats
            .filter((s: any) => !s.locked && canPlaceGuestInSeat(guest, s))
            .sort((a: any, b: any) => {
              const aEmpty = !seatToGuest.get(a.id);
              const bEmpty = !seatToGuest.get(b.id);
              if (aEmpty && !bEmpty) return -1;
              if (!aEmpty && bEmpty) return 1;
              return 0;
            });

          for (const targetSeat of allTargetSeats) {
            if (performTagGroupMove(guestId, targetSeat, tables, seatToGuest, guestLookup, lockedGuestMap, protectedGuestIds)) {
              moved = true;
              anchorGuestIds.push(guestId);
              break;
            }
          }
        }

        if (!moved) {
          console.log(`  Could not move ${guest.name} to ${targetTable.label}`);
        }
      }

      // Re-check consolidation result
      const newLocations: typeof groupLocations = [];
      for (const guestId of seatedGuestIds) {
        const isLocked = lockedGuestMap.has(guestId);
        const location = findGuestSeat(guestId, tables, seatToGuest);
        if (location) {
          newLocations.push({ guestId, seat: location.seat, table: location.table, isLocked });
        }
      }

      const newTableIds = new Set(newLocations.map(loc => loc.table.id));
      if (newTableIds.size > 1) {
        console.log(`  Group still spans ${newTableIds.size} tables after consolidation`);
      } else {
        console.log(`  Group successfully consolidated on ${targetTable.label}`);
      }

      // =====================================================================
      // PHASE 1.5: AGGRESSIVE DISPLACEMENT
      // If group members are still not all on the target table, and the group
      // occupies more than half the table, displace lower-priority non-group
      // guests to make room. Displaced guests are re-seated on other tables.
      // =====================================================================
      if (newTableIds.size > 1) {
        const unlockedTargetSeats = targetTable.seats.filter((s: any) => !s.locked);
        const groupSizeOnTarget = newLocations.filter(loc => loc.table.id === targetTable.id).length;
        const totalGroupSize = seatedGuestIds.filter(gid => !lockedGuestMap.has(gid)).length;

        // Only attempt displacement if the group takes up more than half the table
        if (totalGroupSize > unlockedTargetSeats.length / 2) {
          const pendingMembers = newLocations
            .filter(loc => loc.table.id !== targetTable.id && !loc.isLocked)
            .map(loc => loc.guestId);

          if (pendingMembers.length > 0) {
            console.log(`  Phase 1.5: Attempting displacement for ${pendingMembers.length} remaining member(s)`);

            // Find non-group, non-locked occupants on target table, sorted by priority (lowest first)
            const targetTableOccupants: { guestId: string; seat: any; guest: any }[] = [];
            for (const seat of unlockedTargetSeats) {
              const occupantId = seatToGuest.get(seat.id);
              if (!occupantId) continue;
              if (lockedGuestMap.has(occupantId)) continue;
              if (seatedGuestIds.includes(occupantId)) continue; // Don't displace group members
              if (allTagGroupGuestIds.has(occupantId) && !seatedGuestIds.includes(occupantId)) continue; // Protect other tag groups

              const occupantGuest = guestLookup.get(occupantId);
              if (!occupantGuest) continue;
              targetTableOccupants.push({ guestId: occupantId, seat, guest: occupantGuest });
            }

            // Sort: lowest priority first (highest comparator value)
            targetTableOccupants.sort((a, b) => comparator(b.guest, a.guest));

            const displacedGuests: { guestId: string; guest: any }[] = [];

            for (const occupant of targetTableOccupants) {
              if (pendingMembers.length === 0) break;

              // Check if any pending group member can sit in this seat
              let matchedMemberIdx = -1;
              for (let i = 0; i < pendingMembers.length; i++) {
                const memberGuest = guestLookup.get(pendingMembers[i]);
                if (memberGuest && canPlaceGuestInSeat(memberGuest, occupant.seat)) {
                  matchedMemberIdx = i;
                  break;
                }
              }

              if (matchedMemberIdx === -1) continue;

              const memberId = pendingMembers[matchedMemberIdx];
              const memberLoc = findGuestSeat(memberId, tables, seatToGuest);
              if (!memberLoc) continue;

              // Displace: remove occupant, place group member in their seat
              seatToGuest.delete(occupant.seat.id);
              seatToGuest.delete(memberLoc.seat.id);
              seatToGuest.set(occupant.seat.id, memberId);

              // Track the displaced guest and their original seat for re-seating
              displacedGuests.push({ guestId: occupant.guestId, guest: occupant.guest });

              // Remove from pending list
              pendingMembers.splice(matchedMemberIdx, 1);

              console.log(`    Displaced ${occupant.guest.name} to make room for ${guestLookup.get(memberId)?.name}`);
            }

            // Re-seat displaced guests on other tables (highest priority first)
            displacedGuests.sort((a, b) => comparator(a.guest, b.guest));

            for (const displaced of displacedGuests) {
              let reseated = false;

              // Try empty compatible seats on other tables first
              for (const otherTable of tables) {
                if (otherTable.id === targetTable.id) continue;

                for (const seat of otherTable.seats) {
                  if (seat.locked) continue;
                  if (seatToGuest.has(seat.id)) continue;
                  if (!canPlaceGuestInSeat(displaced.guest, seat)) continue;

                  seatToGuest.set(seat.id, displaced.guestId);
                  reseated = true;
                  console.log(`    Re-seated ${displaced.guest.name} on ${otherTable.label}`);
                  break;
                }

                if (reseated) break;
              }

              // If no empty seat, swap with lowest-priority non-protected guest on another table
              if (!reseated) {
                let worstCandidate: { guestId: string; seat: any; table: any; guest: any } | null = null;

                for (const otherTable of tables) {
                  if (otherTable.id === targetTable.id) continue;

                  for (const seat of otherTable.seats) {
                    if (seat.locked) continue;
                    const occId = seatToGuest.get(seat.id);
                    if (!occId) continue;
                    if (lockedGuestMap.has(occId)) continue;
                    if (allTagGroupGuestIds.has(occId)) continue;

                    const occGuest = guestLookup.get(occId);
                    if (!occGuest) continue;
                    if (!canPlaceGuestInSeat(displaced.guest, seat)) continue;
                    if (!canPlaceGuestInSeat(occGuest, seat)) continue; // Ensure they can swap back

                    if (!worstCandidate || comparator(occGuest, worstCandidate.guest) > 0) {
                      worstCandidate = { guestId: occId, seat, table: otherTable, guest: occGuest };
                    }
                  }
                }

                if (worstCandidate) {
                  // Swap: displaced goes into worst candidate's seat, worst candidate becomes unseated
                  // (worst candidate takes displaced's original position - but displaced has no seat anymore)
                  // Simply place displaced guest in the seat, the worst candidate loses their seat
                  // We need to find a seat for the worst candidate too - but to avoid infinite recursion,
                  // just swap them: displaced takes worst's seat, worst goes to an empty seat if available
                  seatToGuest.delete(worstCandidate.seat.id);
                  seatToGuest.set(worstCandidate.seat.id, displaced.guestId);

                  // Try to find an empty seat for the evicted guest
                  let evictedReseated = false;
                  for (const t of tables) {
                    for (const s of t.seats) {
                      if (s.locked || seatToGuest.has(s.id)) continue;
                      if (!canPlaceGuestInSeat(worstCandidate.guest, s)) continue;
                      seatToGuest.set(s.id, worstCandidate.guestId);
                      evictedReseated = true;
                      break;
                    }
                    if (evictedReseated) break;
                  }

                  reseated = true;
                  console.log(`    Re-seated ${displaced.guest.name} by displacing ${worstCandidate.guest.name}`);
                }
              }

              if (!reseated) {
                console.log(`    Could not re-seat ${displaced.guest.name}`);
              }
            }
          }

          // Refresh locations after displacement
          const postDisplacementLocations: typeof groupLocations = [];
          for (const guestId of seatedGuestIds) {
            const isLocked = lockedGuestMap.has(guestId);
            const location = findGuestSeat(guestId, tables, seatToGuest);
            if (location) {
              postDisplacementLocations.push({ guestId, seat: location.seat, table: location.table, isLocked });
            }
          }

          const postDisplacementTableIds = new Set(postDisplacementLocations.map(loc => loc.table.id));
          if (postDisplacementTableIds.size === 1) {
            console.log(`  Group consolidated after displacement on ${targetTable.label}`);
          }

          // Update for Phase 2
          groupLocations.length = 0;
          groupLocations.push(...postDisplacementLocations);
        } else {
          // Update for Phase 2
          groupLocations.length = 0;
          groupLocations.push(...newLocations);
        }
      } else {
        // Update for Phase 2
        groupLocations.length = 0;
        groupLocations.push(...newLocations);
      }
    }

    // =========================================================================
    // PHASE 2a: CONTIGUOUS BLOCK PLACEMENT
    // Try to place all group members in a connected chain of adjacent seats.
    // =========================================================================
    const currentTableIds = new Set(groupLocations.map(loc => loc.table.id));

    let contiguousSuccess = false;

    for (const tableId of currentTableIds) {
      const tableLocations = groupLocations.filter(loc => loc.table.id === tableId);
      if (tableLocations.length < 2) continue;

      const table = tableLocations[0].table;
      const groupGuestIdsOnTable = tableLocations.map(loc => loc.guestId);

      contiguousSuccess = tryContiguousPlacement(
        groupGuestIdsOnTable,
        table,
        tables,
        seatToGuest,
        guestLookup,
        comparator,
        lockedGuestMap,
        allTagGroupGuestIds
      );

      if (contiguousSuccess) {
        console.log(`  Contiguous block placement succeeded for group [${group.tag}]`);
      }
    }

    // =========================================================================
    // PHASE 2b: MULTI-PASS GREEDY ADJACENCY FALLBACK
    // If contiguous block placement failed, fall back to iterative greedy swaps.
    // =========================================================================
    if (!contiguousSuccess) {
      console.log(`  Falling back to multi-pass greedy adjacency for group [${group.tag}]`);

      const MAX_ADJACENCY_PASSES = 3;

      for (let pass = 0; pass < MAX_ADJACENCY_PASSES; pass++) {
        let swapsMade = 0;

        // Refresh table IDs after potential Phase 1 changes
        const refreshedLocations: typeof groupLocations = [];
        for (const guestId of seatedGuestIds) {
          const location = findGuestSeat(guestId, tables, seatToGuest);
          if (location) {
            refreshedLocations.push({
              guestId,
              seat: location.seat,
              table: location.table,
              isLocked: lockedGuestMap.has(guestId),
            });
          }
        }
        const passTableIds = new Set(refreshedLocations.map(loc => loc.table.id));

        for (const tableId of passTableIds) {
          const tableLocations = refreshedLocations.filter(loc => loc.table.id === tableId);
          if (tableLocations.length < 2) continue;

          const table = tableLocations[0].table;
          const allSeats = table.seats;
          const groupGuestIdsOnTable = tableLocations.map(loc => loc.guestId);

          for (const guestId of groupGuestIdsOnTable) {
            if (lockedGuestMap.has(guestId)) continue;

            const guest = guestLookup.get(guestId);
            if (!guest) continue;

            const currentLoc = findGuestSeat(guestId, tables, seatToGuest);
            if (!currentLoc || currentLoc.table.id !== tableId) continue;

            // Count current adjacencies to group members
            const currentAdjacentMembers = groupGuestIdsOnTable.filter(otherId => {
              if (otherId === guestId) return false;
              const otherLoc = findGuestSeat(otherId, tables, seatToGuest);
              if (!otherLoc || otherLoc.table.id !== tableId) return false;
              const adjSeats = getAdjacentSeats(currentLoc.seat, allSeats);
              return adjSeats.some(s => seatToGuest.get(s.id) === otherId || (s.locked && s.assignedGuestId === otherId));
            });

            if (currentAdjacentMembers.length === groupGuestIdsOnTable.length - 1) continue;

            // Find candidate seats adjacent to any group member
            const candidateSeats: any[] = [];
            for (const otherId of groupGuestIdsOnTable) {
              if (otherId === guestId) continue;
              const otherLoc = findGuestSeat(otherId, tables, seatToGuest);
              if (!otherLoc || otherLoc.table.id !== tableId) continue;

              const adjSeats = getAdjacentSeats(otherLoc.seat, allSeats);
              for (const adjSeat of adjSeats) {
                if (adjSeat.locked) continue;
                if (!canPlaceGuestInSeat(guest, adjSeat)) continue;
                if (adjSeat.id === currentLoc.seat.id) continue;
                if (!candidateSeats.find((s: any) => s.id === adjSeat.id)) {
                  candidateSeats.push(adjSeat);
                }
              }
            }

            // Score each candidate by adjacency improvement
            let bestSeat: any = null;
            let bestScore = currentAdjacentMembers.length;

            for (const candidateSeat of candidateSeats) {
              const adjToCandidateSeats = getAdjacentSeats(candidateSeat, allSeats);
              let score = 0;

              for (const otherId of groupGuestIdsOnTable) {
                if (otherId === guestId) continue;
                const otherLoc = findGuestSeat(otherId, tables, seatToGuest);
                if (!otherLoc) continue;

                const isAdjacent = adjToCandidateSeats.some(s =>
                  seatToGuest.get(s.id) === otherId ||
                  (s.locked && s.assignedGuestId === otherId)
                );
                if (isAdjacent) score++;
              }

              if (score > bestScore) {
                bestScore = score;
                bestSeat = candidateSeat;
              }
            }

            if (bestSeat && bestScore > currentAdjacentMembers.length) {
              const occupant = seatToGuest.get(bestSeat.id);

              if (occupant) {
                if (allTagGroupGuestIds.has(occupant) && !groupGuestIdsOnTable.includes(occupant)) {
                  continue;
                }

                const otherGuest = guestLookup.get(occupant);
                if (!otherGuest || lockedGuestMap.has(occupant)) continue;
                if (!canPlaceGuestInSeat(otherGuest, currentLoc.seat)) continue;

                seatToGuest.delete(currentLoc.seat.id);
                seatToGuest.delete(bestSeat.id);
                seatToGuest.set(bestSeat.id, guestId);
                seatToGuest.set(currentLoc.seat.id, occupant);
                swapsMade++;
              } else {
                seatToGuest.delete(currentLoc.seat.id);
                seatToGuest.set(bestSeat.id, guestId);
                swapsMade++;
              }
            }
          }
        }

        if (swapsMade === 0) break; // Convergence reached
      }
    }

    // =========================================================================
    // PHASE 3: DIRECT SWAP CLEANUP FOR REMAINING NON-ADJACENT PAIRS
    // Skip when Phase 2a succeeded -- the contiguous block already ensures all
    // members form a connected chain. Running pair-based swaps would break
    // the chain by moving members out of the block to fix individual pairs.
    // =========================================================================
    if (contiguousSuccess) continue;

    // Refresh locations after Phase 2
    const phase3Locations: typeof groupLocations = [];
    for (const guestId of seatedGuestIds) {
      const location = findGuestSeat(guestId, tables, seatToGuest);
      if (location) {
        phase3Locations.push({
          guestId,
          seat: location.seat,
          table: location.table,
          isLocked: lockedGuestMap.has(guestId),
        });
      }
    }

    const phase3TableIds = new Set(phase3Locations.map(loc => loc.table.id));

    for (const tableId of phase3TableIds) {
      const tableLocations = phase3Locations.filter(loc => loc.table.id === tableId);
      if (tableLocations.length < 2) continue;

      const table = tableLocations[0].table;
      const groupGuestIdsOnTable = tableLocations.map(loc => loc.guestId);

      // Check all pairs for adjacency
      for (let i = 0; i < groupGuestIdsOnTable.length; i++) {
        for (let j = i + 1; j < groupGuestIdsOnTable.length; j++) {
          const guestAId = groupGuestIdsOnTable[i];
          const guestBId = groupGuestIdsOnTable[j];

          if (areGuestsAdjacent(guestAId, guestBId, tables, seatToGuest, lockedGuestMap)) {
            continue;
          }

          // Determine who moves: prefer lower priority, skip locked
          const guestA = guestLookup.get(guestAId);
          const guestB = guestLookup.get(guestBId);
          if (!guestA || !guestB) continue;

          let movingId: string;
          let stayingId: string;

          if (lockedGuestMap.has(guestAId) && lockedGuestMap.has(guestBId)) continue;
          if (lockedGuestMap.has(guestAId)) {
            movingId = guestBId;
            stayingId = guestAId;
          } else if (lockedGuestMap.has(guestBId)) {
            movingId = guestAId;
            stayingId = guestBId;
          } else {
            // Move lower priority guest (higher comparator value)
            const cmp = comparator(guestA, guestB);
            movingId = cmp <= 0 ? guestBId : guestAId;
            stayingId = cmp <= 0 ? guestAId : guestBId;
          }

          const movingGuest = guestLookup.get(movingId);
          if (!movingGuest) continue;

          const stayingLoc = findGuestSeat(stayingId, tables, seatToGuest);
          const movingLoc = findGuestSeat(movingId, tables, seatToGuest);
          if (!stayingLoc || !movingLoc) continue;
          if (stayingLoc.table.id !== movingLoc.table.id) continue;

          const adjacentToStaying = getAdjacentSeats(stayingLoc.seat, table.seats);

          // Try empty adjacent seat first
          const emptyAdj = adjacentToStaying.find(s =>
            !s.locked &&
            !seatToGuest.get(s.id) &&
            canPlaceGuestInSeat(movingGuest, s)
          );

          if (emptyAdj) {
            seatToGuest.delete(movingLoc.seat.id);
            seatToGuest.set(emptyAdj.id, movingId);
            continue;
          }

          // Try swapping with non-group, non-locked adjacent occupant
          for (const adjSeat of adjacentToStaying) {
            if (adjSeat.locked) continue;
            if (!canPlaceGuestInSeat(movingGuest, adjSeat)) continue;

            const occupantId = seatToGuest.get(adjSeat.id);
            if (!occupantId) continue;
            if (lockedGuestMap.has(occupantId)) continue;
            // Don't displace other tag group members (but allow same-group members to shift)
            if (allTagGroupGuestIds.has(occupantId) && !groupGuestIdsOnTable.includes(occupantId)) continue;

            const occupantGuest = guestLookup.get(occupantId);
            if (!occupantGuest) continue;
            if (!canPlaceGuestInSeat(occupantGuest, movingLoc.seat)) continue;

            // Perform swap
            seatToGuest.delete(movingLoc.seat.id);
            seatToGuest.delete(adjSeat.id);
            seatToGuest.set(adjSeat.id, movingId);
            seatToGuest.set(movingLoc.seat.id, occupantId);
            break;
          }
        }
      }
    }
  }
}
