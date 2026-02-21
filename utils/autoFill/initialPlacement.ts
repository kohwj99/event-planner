/**
 * initialPlacement.ts
 *
 * Core initial seat assignment algorithm for the autofill pipeline.
 * This is the first pass that fills all tables with guests, handling three modes:
 *
 * 1. SPACING RULE: Alternates host/external guests in a configurable pattern
 *    (e.g., 1 host then 1 external, or 1 host then 2 externals). The spacing
 *    value controls how many of one type before switching. Seat modes (host-only,
 *    external-only) are respected even within the spacing pattern.
 *
 * 2. RATIO RULE: Distributes host/external guests per target counts calculated
 *    from the ratio (e.g., 2:1 host:external on a 9-seat table = 6 host, 3 external).
 *    Falls back to any available guest if target counts are exhausted.
 *
 * 3. DEFAULT: No table rules active - fills seats sequentially from the sorted
 *    unified candidate list, respecting only seat mode constraints.
 *
 * All three modes also:
 * - Respect locked seats (skip them)
 * - Check sit-away-with-locked constraints to avoid placing guests adjacent
 *   to locked seats that would create immovable violations
 * - Apply randomization to non-proximity-rule guests after sorting
 * - Sort tables by tableNumber and seats by seatNumber for deterministic order
 */

import { SeatMode } from '@/types/Seat';
import { TableRules, ProximityRules, RandomizeOrderConfig } from '@/types/Event';
import { LockedGuestLocation } from './autoFillTypes';
import { makeComparatorWithHostTieBreak, applyRandomizeOrder } from './guestSorting';
import { canPlaceGuestInSeat, getNextCompatibleGuest, getNextCompatibleGuestOfType } from './seatCompatibility';
import { wouldViolateSitAwayWithLocked } from './lockedGuestHelpers';
import { reorderForSitTogetherClusters } from './proximityReordering';

/**
 * Perform the initial placement of guests into seats across all tables.
 *
 * Takes sorted/prioritized host and external candidate arrays, and assigns
 * them to seats based on table rules (spacing, ratio, or default), while
 * respecting seat modes, locked seats, and sit-away constraints with locked guests.
 *
 * Returns a Map<seatId, guestId> representing the initial assignment.
 */
export function performInitialPlacement(
  tables: any[],
  hostCandidates: any[],
  externalCandidates: any[],
  lockedGuestIds: Set<string>,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  tableRules?: TableRules,
  comparator?: (a: any, b: any) => number,
  proximityRules?: ProximityRules,
  randomizeOrder?: RandomizeOrderConfig,
  guestsInProximityRules?: Set<string>
): Map<string, string> {
  const seatToGuest = new Map<string, string>();
  const assignedGuests = new Set<string>(lockedGuestIds);

  const comparatorWithTieBreak = makeComparatorWithHostTieBreak(comparator || ((_a, _b) => 0));
  let allCandidates = [...hostCandidates, ...externalCandidates].sort(comparatorWithTieBreak);

  // Reorder so that sit-together cluster members are placed immediately after
  // the highest-priority member of their cluster, preventing cross-table moves
  // that could demote high-priority guests during sit-together optimization
  if (proximityRules?.sitTogether && proximityRules.sitTogether.length > 0) {
    allCandidates = reorderForSitTogetherClusters(
      allCandidates,
      proximityRules.sitTogether,
      comparatorWithTieBreak
    );
  }

  // Apply randomization AFTER the sort, but only to non-proximity-rule guests
  // This ensures proximity rules are still enforced properly
  if (randomizeOrder && randomizeOrder.enabled && randomizeOrder.partitions.length > 0 && guestsInProximityRules) {
    console.log('performInitialPlacement: Applying randomization after sort');
    console.log(`  Total candidates: ${allCandidates.length}`);
    console.log(`  Guests in proximity rules: ${guestsInProximityRules.size}`);

    // Separate guests into proximity-rule and regular
    const proximityGuests: any[] = [];
    const regularGuests: any[] = [];

    allCandidates.forEach(guest => {
      if (guestsInProximityRules.has(guest.id)) {
        proximityGuests.push(guest);
      } else {
        regularGuests.push(guest);
      }
    });

    console.log(`  Proximity guests (not randomized): ${proximityGuests.length}`);
    console.log(`  Regular guests (will be randomized): ${regularGuests.length}`);

    // Randomize only the regular guests
    const randomizedRegular = applyRandomizeOrder(regularGuests, randomizeOrder);

    // Recombine: proximity guests first (maintain their priority), then randomized regular
    allCandidates = [...proximityGuests, ...randomizedRegular];
  }

  const sortedTables = [...tables].sort((a, b) => {
    const aNum = typeof a.tableNumber === "number" ? a.tableNumber : parseInt(a.id, 10) || 0;
    const bNum = typeof b.tableNumber === "number" ? b.tableNumber : parseInt(b.id, 10) || 0;
    return aNum - bNum;
  });

  for (const table of sortedTables) {
    const seats = [...(table.seats ?? [])].sort((a, b) => {
      const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
      const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
      return aSeatNum - bSeatNum;
    });

    const unlockedSeats = seats.filter((s: any) => !s.locked);
    const totalUnlockedSeats = unlockedSeats.length;
    let targetHostCount = 0;
    let targetExternalCount = 0;

    if (tableRules?.ratioRule.enabled) {
      const totalRatio = tableRules.ratioRule.hostRatio + tableRules.ratioRule.externalRatio;
      if (totalRatio > 0) {
        targetHostCount = Math.floor((tableRules.ratioRule.hostRatio / totalRatio) * totalUnlockedSeats);
        targetExternalCount = totalUnlockedSeats - targetHostCount;
      }
    }

    if (tableRules?.spacingRule.enabled) {
      // =====================================================================
      // SPACING RULE: Alternating host/external pattern
      // =====================================================================
      const spacing = tableRules.spacingRule.spacing;
      const startWithExternal = tableRules.spacingRule.startWithExternal ?? false;

      const hasHostsRemaining = () => allCandidates.some(g => !assignedGuests.has(g.id) && g.fromHost === true);
      const hasExternalsRemaining = () => allCandidates.some(g => !assignedGuests.has(g.id) && g.fromHost === false);

      let patternActive = hasHostsRemaining() && hasExternalsRemaining();
      let patternPosition = 0;

      const isHostTurn = (pos: number) => {
        if (startWithExternal) {
          return pos === spacing;
        } else {
          return pos === 0;
        }
      };

      for (let seatIdx = 0; seatIdx < unlockedSeats.length; seatIdx++) {
        const seat = unlockedSeats[seatIdx];
        const seatMode: SeatMode = seat.mode || 'default';

        if (patternActive) {
          if (!hasHostsRemaining() || !hasExternalsRemaining()) {
            patternActive = false;
          }
        }

        if (patternActive) {
          if (seatMode === 'host-only') {
            let nextHost = getNextCompatibleGuestOfType(allCandidates, assignedGuests, true, seat);

            if (nextHost && proximityRules) {
              if (wouldViolateSitAwayWithLocked(nextHost.id, seat, seats, lockedGuestMap, proximityRules)) {
                const availableHosts = allCandidates.filter(g =>
                  !assignedGuests.has(g.id) && g.fromHost === true && canPlaceGuestInSeat(g, seat)
                );
                nextHost = availableHosts.find(h =>
                  !wouldViolateSitAwayWithLocked(h.id, seat, seats, lockedGuestMap, proximityRules)
                ) || nextHost;
              }
            }

            if (nextHost) {
              seatToGuest.set(seat.id, nextHost.id);
              assignedGuests.add(nextHost.id);
            }
            continue;
          } else if (seatMode === 'external-only') {
            let nextExternal = getNextCompatibleGuestOfType(allCandidates, assignedGuests, false, seat);

            if (nextExternal && proximityRules) {
              if (wouldViolateSitAwayWithLocked(nextExternal.id, seat, seats, lockedGuestMap, proximityRules)) {
                const availableExternals = allCandidates.filter(g =>
                  !assignedGuests.has(g.id) && g.fromHost === false && canPlaceGuestInSeat(g, seat)
                );
                nextExternal = availableExternals.find(e =>
                  !wouldViolateSitAwayWithLocked(e.id, seat, seats, lockedGuestMap, proximityRules)
                ) || nextExternal;
              }
            }

            if (nextExternal) {
              seatToGuest.set(seat.id, nextExternal.id);
              assignedGuests.add(nextExternal.id);
            }
            continue;
          }

          if (isHostTurn(patternPosition)) {
            let nextHost = getNextCompatibleGuestOfType(allCandidates, assignedGuests, true, seat);

            if (nextHost && proximityRules) {
              if (wouldViolateSitAwayWithLocked(nextHost.id, seat, seats, lockedGuestMap, proximityRules)) {
                const availableHosts = allCandidates.filter(g =>
                  !assignedGuests.has(g.id) && g.fromHost === true && canPlaceGuestInSeat(g, seat)
                );
                nextHost = availableHosts.find(h =>
                  !wouldViolateSitAwayWithLocked(h.id, seat, seats, lockedGuestMap, proximityRules)
                ) || nextHost;
              }
            }

            if (nextHost) {
              seatToGuest.set(seat.id, nextHost.id);
              assignedGuests.add(nextHost.id);
              patternPosition++;
              if (patternPosition > spacing) {
                patternPosition = 0;
              }
            } else {
              patternActive = false;
              seatIdx--;
            }
          } else {
            let nextExternal = getNextCompatibleGuestOfType(allCandidates, assignedGuests, false, seat);

            if (nextExternal && proximityRules) {
              if (wouldViolateSitAwayWithLocked(nextExternal.id, seat, seats, lockedGuestMap, proximityRules)) {
                const availableExternals = allCandidates.filter(g =>
                  !assignedGuests.has(g.id) && g.fromHost === false && canPlaceGuestInSeat(g, seat)
                );
                nextExternal = availableExternals.find(e =>
                  !wouldViolateSitAwayWithLocked(e.id, seat, seats, lockedGuestMap, proximityRules)
                ) || nextExternal;
              }
            }

            if (nextExternal) {
              seatToGuest.set(seat.id, nextExternal.id);
              assignedGuests.add(nextExternal.id);
              patternPosition++;
              if (patternPosition > spacing) {
                patternPosition = 0;
              }
            } else {
              patternActive = false;
              seatIdx--;
            }
          }
        } else {
          let nextGuest = getNextCompatibleGuest(allCandidates, assignedGuests, seat);

          if (nextGuest && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextGuest.id, seat, seats, lockedGuestMap, proximityRules)) {
              const availableGuests = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && canPlaceGuestInSeat(g, seat)
              );
              nextGuest = availableGuests.find(g =>
                !wouldViolateSitAwayWithLocked(g.id, seat, seats, lockedGuestMap, proximityRules)
              ) || nextGuest;
            }
          }

          if (nextGuest) {
            seatToGuest.set(seat.id, nextGuest.id);
            assignedGuests.add(nextGuest.id);
          }
        }
      }

    } else if (tableRules?.ratioRule.enabled) {
      // =====================================================================
      // RATIO RULE: Host/external target counts per table
      // =====================================================================
      let hostPlaced = 0;
      let externalPlaced = 0;

      for (const seat of unlockedSeats) {
        const seatMode: SeatMode = seat.mode || 'default';

        if (seatMode === 'host-only') {
          let nextHost = getNextCompatibleGuestOfType(allCandidates, assignedGuests, true, seat);

          if (nextHost && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextHost.id, seat, seats, lockedGuestMap, proximityRules)) {
              const availableHosts = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && g.fromHost === true && canPlaceGuestInSeat(g, seat)
              );
              nextHost = availableHosts.find(h =>
                !wouldViolateSitAwayWithLocked(h.id, seat, seats, lockedGuestMap, proximityRules)
              ) || nextHost;
            }
          }

          if (nextHost) {
            seatToGuest.set(seat.id, nextHost.id);
            assignedGuests.add(nextHost.id);
            hostPlaced++;
          }
          continue;
        } else if (seatMode === 'external-only') {
          let nextExternal = getNextCompatibleGuestOfType(allCandidates, assignedGuests, false, seat);

          if (nextExternal && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextExternal.id, seat, seats, lockedGuestMap, proximityRules)) {
              const availableExternals = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && g.fromHost === false && canPlaceGuestInSeat(g, seat)
              );
              nextExternal = availableExternals.find(e =>
                !wouldViolateSitAwayWithLocked(e.id, seat, seats, lockedGuestMap, proximityRules)
              ) || nextExternal;
            }
          }

          if (nextExternal) {
            seatToGuest.set(seat.id, nextExternal.id);
            assignedGuests.add(nextExternal.id);
            externalPlaced++;
          }
          continue;
        }

        const shouldPlaceHost = hostPlaced < targetHostCount;
        const shouldPlaceExternal = externalPlaced < targetExternalCount;

        if (shouldPlaceHost) {
          let nextHost = getNextCompatibleGuestOfType(allCandidates, assignedGuests, true, seat);

          if (nextHost && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextHost.id, seat, seats, lockedGuestMap, proximityRules)) {
              const availableHosts = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && g.fromHost === true && canPlaceGuestInSeat(g, seat)
              );
              nextHost = availableHosts.find(h =>
                !wouldViolateSitAwayWithLocked(h.id, seat, seats, lockedGuestMap, proximityRules)
              ) || nextHost;
            }
          }

          if (nextHost) {
            seatToGuest.set(seat.id, nextHost.id);
            assignedGuests.add(nextHost.id);
            hostPlaced++;
            continue;
          }
        }

        if (shouldPlaceExternal) {
          let nextExternal = getNextCompatibleGuestOfType(allCandidates, assignedGuests, false, seat);

          if (nextExternal && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextExternal.id, seat, seats, lockedGuestMap, proximityRules)) {
              const availableExternals = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && g.fromHost === false && canPlaceGuestInSeat(g, seat)
              );
              nextExternal = availableExternals.find(e =>
                !wouldViolateSitAwayWithLocked(e.id, seat, seats, lockedGuestMap, proximityRules)
              ) || nextExternal;
            }
          }

          if (nextExternal) {
            seatToGuest.set(seat.id, nextExternal.id);
            assignedGuests.add(nextExternal.id);
            externalPlaced++;
            continue;
          }
        }

        let nextGuest = getNextCompatibleGuest(allCandidates, assignedGuests, seat);

        if (nextGuest && proximityRules) {
          if (wouldViolateSitAwayWithLocked(nextGuest.id, seat, seats, lockedGuestMap, proximityRules)) {
            const availableGuests = allCandidates.filter(g =>
              !assignedGuests.has(g.id) && canPlaceGuestInSeat(g, seat)
            );
            nextGuest = availableGuests.find(g =>
              !wouldViolateSitAwayWithLocked(g.id, seat, seats, lockedGuestMap, proximityRules)
            ) || nextGuest;
          }
        }

        if (nextGuest) {
          seatToGuest.set(seat.id, nextGuest.id);
          assignedGuests.add(nextGuest.id);
        }
      }

    } else {
      // =====================================================================
      // DEFAULT: No table rules - fill sequentially by sorted order
      // =====================================================================
      for (const seat of unlockedSeats) {
        let nextGuest = getNextCompatibleGuest(allCandidates, assignedGuests, seat);

        if (nextGuest && proximityRules) {
          if (wouldViolateSitAwayWithLocked(nextGuest.id, seat, seats, lockedGuestMap, proximityRules)) {
            const availableGuests = allCandidates.filter(g =>
              !assignedGuests.has(g.id) && canPlaceGuestInSeat(g, seat)
            );
            nextGuest = availableGuests.find(g =>
              !wouldViolateSitAwayWithLocked(g.id, seat, seats, lockedGuestMap, proximityRules)
            ) || nextGuest;
          }
        }

        if (nextGuest) {
          seatToGuest.set(seat.id, nextGuest.id);
          assignedGuests.add(nextGuest.id);
        }
      }
    }
  }

  return seatToGuest;
}
