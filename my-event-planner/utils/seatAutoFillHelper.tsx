// ENHANCED seatAutoFillHelper.tsx - With Priority-Based Guest Selection
// ============================================================================

import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";
import { detectProximityViolations, ProximityViolation } from './violationDetector';

export type SortField = "name" | "country" | "organization" | "ranking";
export type SortDirection = "asc" | "desc";

export interface SortRule {
  field: SortField;
  direction: SortDirection;
}

export interface RatioRule {
  enabled: boolean;
  hostRatio: number;
  externalRatio: number;
}

export interface SpacingRule {
  enabled: boolean;
  spacing: number;
  startWithExternal: boolean;
}

export interface TableRules {
  ratioRule: RatioRule;
  spacingRule: SpacingRule;
}

export interface SitTogetherRule {
  id: string;
  guest1Id: string;
  guest2Id: string;
}

export interface SitAwayRule {
  id: string;
  guest1Id: string;
  guest2Id: string;
}

export interface ProximityRules {
  sitTogether: SitTogetherRule[];
  sitAway: SitAwayRule[];
}

export interface AutoFillOptions {
  includeHost?: boolean;
  includeExternal?: boolean;
  sortRules?: SortRule[];
  tableRules?: TableRules;
  proximityRules?: ProximityRules;
}

// Store violations globally for access by stats panel
let proximityViolations: ProximityViolation[] = [];

export function getProximityViolations(): ProximityViolation[] {
  return proximityViolations;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getGuestFieldValue(guest: any, field: SortField): string | number | undefined {
  if (!guest) return undefined;
  if (field === "organization") return (guest as any).company ?? (guest as any).organization ?? "";
  return (guest as any)[field];
}

function makeComparator(rules: SortRule[]) {
  return (a: any, b: any) => {
    for (const r of rules) {
      const { field, direction } = r;
      let av = getGuestFieldValue(a, field);
      let bv = getGuestFieldValue(b, field);

      if (av === undefined || av === null) av = "";
      if (bv === undefined || bv === null) bv = "";

      if (field === "ranking") {
        const na = Number(av) || 0;
        const nb = Number(bv) || 0;
        if (na < nb) return direction === "asc" ? -1 : 1;
        if (na > nb) return direction === "asc" ? 1 : -1;
        continue;
      }

      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      if (sa < sb) return direction === "asc" ? -1 : 1;
      if (sa > sb) return direction === "asc" ? 1 : -1;
    }

    return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
  };
}

function getAdjacentSeats(seat: any, allSeats: any[]): any[] {
  if (!seat.adjacentSeats || seat.adjacentSeats.length === 0) return [];
  return seat.adjacentSeats
    .map((adjId: string) => allSeats.find((s) => s.id === adjId))
    .filter(Boolean);
}

function shouldSitTogether(guest1Id: string, guest2Id: string, rules: SitTogetherRule[]): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

function shouldSitAway(guest1Id: string, guest2Id: string, rules: SitAwayRule[]): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

function getSitTogetherPartner(guestId: string, rules: SitTogetherRule[]): string | null {
  for (const rule of rules) {
    if (rule.guest1Id === guestId) return rule.guest2Id;
    if (rule.guest2Id === guestId) return rule.guest1Id;
  }
  return null;
}

function getSitAwayGuests(guestId: string, rules: SitAwayRule[]): string[] {
  const awayGuests: string[] = [];
  for (const rule of rules) {
    if (rule.guest1Id === guestId) awayGuests.push(rule.guest2Id);
    if (rule.guest2Id === guestId) awayGuests.push(rule.guest1Id);
  }
  return awayGuests;
}

function isVIP(guest: any): boolean {
  const ranking = Number(guest?.ranking) || Infinity;
  return ranking >= 1 && ranking <= 4;
}

interface LockedGuestLocation {
  guestId: string;
  tableId: string;
  seatId: string;
  seat: any;
  table: any;
}

function buildLockedGuestMap(tables: any[]): Map<string, LockedGuestLocation> {
  const lockedMap = new Map<string, LockedGuestLocation>();

  for (const table of tables) {
    for (const seat of table.seats || []) {
      if (seat.locked && seat.assignedGuestId) {
        lockedMap.set(seat.assignedGuestId, {
          guestId: seat.assignedGuestId,
          tableId: table.id,
          seatId: seat.id,
          seat,
          table,
        });
      }
    }
  }

  return lockedMap;
}

function wouldViolateSitAwayWithLocked(
  guestId: string,
  seat: any,
  allSeats: any[],
  lockedGuestMap: Map<string, LockedGuestLocation>,
  proximityRules: ProximityRules
): boolean {
  const sitAwayGuests = getSitAwayGuests(guestId, proximityRules.sitAway);
  if (sitAwayGuests.length === 0) return false;

  const adjacentSeats = getAdjacentSeats(seat, allSeats);

  for (const adjSeat of adjacentSeats) {
    if (adjSeat.locked && adjSeat.assignedGuestId) {
      if (sitAwayGuests.includes(adjSeat.assignedGuestId)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// NEW: PRIORITY-BASED GUEST POOL BUILDER
// ============================================================================

/**
 * Build prioritized guest pools that ensure guests with proximity rules are included
 * even if they're lower-ranked
 */
function buildPrioritizedGuestPools(
  hostCandidates: any[],
  externalCandidates: any[],
  proximityRules: ProximityRules,
  comparator: (a: any, b: any) => number,
  totalAvailableSeats: number
): { prioritizedHost: any[]; prioritizedExternal: any[] } {
  // Get all guests involved in proximity rules
  const guestsInProximityRules = new Set<string>();
  
  proximityRules.sitTogether.forEach(rule => {
    guestsInProximityRules.add(rule.guest1Id);
    guestsInProximityRules.add(rule.guest2Id);
  });
  
  proximityRules.sitAway.forEach(rule => {
    guestsInProximityRules.add(rule.guest1Id);
    guestsInProximityRules.add(rule.guest2Id);
  });

  // Separate guests into priority groups
  function prioritizeGuests(candidates: any[]) {
    const mustInclude: any[] = [];
    const regular: any[] = [];
    
    candidates.forEach(guest => {
      if (guestsInProximityRules.has(guest.id)) {
        mustInclude.push(guest);
      } else {
        regular.push(guest);
      }
    });
    
    // Sort each group independently
    mustInclude.sort(comparator);
    regular.sort(comparator);
    
    return { mustInclude, regular };
  }

  const hostGroups = prioritizeGuests(hostCandidates);
  const externalGroups = prioritizeGuests(externalCandidates);
  
  // Calculate how many seats each group gets
  const totalGuests = hostCandidates.length + externalCandidates.length;
  const seatsToFill = Math.min(totalAvailableSeats, totalGuests);
  
  // Prioritize guests with rules, then fill remaining seats by sort order
  const prioritizedHost: any[] = [];
  const prioritizedExternal: any[] = [];
  
  // First, add all must-include guests
  prioritizedHost.push(...hostGroups.mustInclude);
  prioritizedExternal.push(...externalGroups.mustInclude);
  
  const remainingSeats = seatsToFill - (prioritizedHost.length + prioritizedExternal.length);
  
  if (remainingSeats > 0) {
    // Add regular guests to fill remaining seats
    const hostRatio = hostCandidates.length / totalGuests;
    const hostSeatsRemaining = Math.ceil(remainingSeats * hostRatio);
    const externalSeatsRemaining = remainingSeats - hostSeatsRemaining;
    
    prioritizedHost.push(...hostGroups.regular.slice(0, hostSeatsRemaining));
    prioritizedExternal.push(...externalGroups.regular.slice(0, externalSeatsRemaining));
  }
  
  return {
    prioritizedHost,
    prioritizedExternal
  };
}

// ============================================================================
// INITIAL PLACEMENT WITH PRIORITY AWARENESS
// ============================================================================

function makeComparatorWithHostTieBreak(baseComparator: (a: any, b: any) => number) {
  return (a: any, b: any) => {
    const sortResult = baseComparator(a, b);

    if (sortResult !== 0) {
      return sortResult;
    }

    const aIsHost = a.fromHost === true;
    const bIsHost = b.fromHost === true;

    if (aIsHost && !bIsHost) return -1;
    if (!aIsHost && bIsHost) return 1;

    return String(a.id || "").localeCompare(String(b.id || ""));
  };
}

function getNextGuestFromUnifiedList(
  allCandidates: any[],
  assignedGuests: Set<string>,
  comparator: (a: any, b: any) => number
): any | null {
  const available = allCandidates.filter(g => !assignedGuests.has(g.id));
  if (available.length === 0) return null;
  return available[0];
}

function getNextGuestOfType(
  allCandidates: any[],
  assignedGuests: Set<string>,
  isHost: boolean
): any | null {
  const available = allCandidates.filter(g =>
    !assignedGuests.has(g.id) && g.fromHost === isHost
  );
  if (available.length === 0) return null;
  return available[0];
}

function performInitialPlacement(
  tables: any[],
  hostCandidates: any[],
  externalCandidates: any[],
  lockedGuestIds: Set<string>,
  lockedGuestMap: Map<string, LockedGuestLocation>,
  tableRules?: TableRules,
  comparator?: (a: any, b: any) => number,
  proximityRules?: ProximityRules
): Map<string, string> {
  const seatToGuest = new Map<string, string>();
  const assignedGuests = new Set<string>(lockedGuestIds);

  const comparatorWithTieBreak = makeComparatorWithHostTieBreak(comparator || ((a, b) => 0));
  const allCandidates = [...hostCandidates, ...externalCandidates].sort(comparatorWithTieBreak);

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
      const spacing = tableRules.spacingRule.spacing;
      let seatIdx = 0;

      while (seatIdx < unlockedSeats.length) {
        const seat = unlockedSeats[seatIdx];
        let nextHost = getNextGuestOfType(allCandidates, assignedGuests, true);

        if (nextHost && proximityRules) {
          if (wouldViolateSitAwayWithLocked(nextHost.id, seat, seats, lockedGuestMap, proximityRules)) {
            const availableHosts = allCandidates.filter(g =>
              !assignedGuests.has(g.id) && g.fromHost === true
            );
            nextHost = availableHosts.find(h =>
              !wouldViolateSitAwayWithLocked(h.id, seat, seats, lockedGuestMap, proximityRules)
            ) || nextHost;
          }
        }

        if (nextHost) {
          seatToGuest.set(seat.id, nextHost.id);
          assignedGuests.add(nextHost.id);
          seatIdx++;
        } else {
          break;
        }

        for (let s = 0; s < spacing && seatIdx < unlockedSeats.length; s++) {
          const spacingSeat = unlockedSeats[seatIdx];
          let nextExternal = getNextGuestOfType(allCandidates, assignedGuests, false);

          if (nextExternal && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextExternal.id, spacingSeat, seats, lockedGuestMap, proximityRules)) {
              const availableExternals = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && g.fromHost === false
              );
              nextExternal = availableExternals.find(e =>
                !wouldViolateSitAwayWithLocked(e.id, spacingSeat, seats, lockedGuestMap, proximityRules)
              ) || nextExternal;
            }
          }

          if (nextExternal) {
            seatToGuest.set(spacingSeat.id, nextExternal.id);
            assignedGuests.add(nextExternal.id);
          }
          seatIdx++;
        }
      }

      while (seatIdx < unlockedSeats.length) {
        const seat = unlockedSeats[seatIdx];
        let nextGuest = getNextGuestFromUnifiedList(allCandidates, assignedGuests, comparatorWithTieBreak);

        if (nextGuest && proximityRules) {
          if (wouldViolateSitAwayWithLocked(nextGuest.id, seat, seats, lockedGuestMap, proximityRules)) {
            const availableGuests = allCandidates.filter(g => !assignedGuests.has(g.id));
            nextGuest = availableGuests.find(g =>
              !wouldViolateSitAwayWithLocked(g.id, seat, seats, lockedGuestMap, proximityRules)
            ) || nextGuest;
          }
        }

        if (nextGuest) {
          seatToGuest.set(seat.id, nextGuest.id);
          assignedGuests.add(nextGuest.id);
        }
        seatIdx++;
      }

    } else if (tableRules?.ratioRule.enabled) {
      let hostPlaced = 0;
      let externalPlaced = 0;

      for (const seat of unlockedSeats) {
        const shouldPlaceHost = hostPlaced < targetHostCount;
        const shouldPlaceExternal = externalPlaced < targetExternalCount;

        if (shouldPlaceHost) {
          let nextHost = getNextGuestOfType(allCandidates, assignedGuests, true);

          if (nextHost && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextHost.id, seat, seats, lockedGuestMap, proximityRules)) {
              const availableHosts = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && g.fromHost === true
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
          let nextExternal = getNextGuestOfType(allCandidates, assignedGuests, false);

          if (nextExternal && proximityRules) {
            if (wouldViolateSitAwayWithLocked(nextExternal.id, seat, seats, lockedGuestMap, proximityRules)) {
              const availableExternals = allCandidates.filter(g =>
                !assignedGuests.has(g.id) && g.fromHost === false
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

        let nextGuest = getNextGuestFromUnifiedList(allCandidates, assignedGuests, comparatorWithTieBreak);

        if (nextGuest && proximityRules) {
          if (wouldViolateSitAwayWithLocked(nextGuest.id, seat, seats, lockedGuestMap, proximityRules)) {
            const availableGuests = allCandidates.filter(g => !assignedGuests.has(g.id));
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
      for (const seat of unlockedSeats) {
        let nextGuest = getNextGuestFromUnifiedList(allCandidates, assignedGuests, comparatorWithTieBreak);

        if (nextGuest && proximityRules) {
          if (wouldViolateSitAwayWithLocked(nextGuest.id, seat, seats, lockedGuestMap, proximityRules)) {
            const availableGuests = allCandidates.filter(g => !assignedGuests.has(g.id));
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

// ============================================================================
// SIT TOGETHER OPTIMIZATION (WITH LOCKED SUPPORT)
// ============================================================================

function applySitTogetherOptimization(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  allGuests: any[],
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): void {
  const guestLookup = new Map(allGuests.map(g => [g.id, g]));

  const sortedPairs = [...proximityRules.sitTogether]
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

    const higherIsLocked = lockedGuestMap.has(higherPriority.id);
    const lowerIsLocked = lockedGuestMap.has(lowerPriority.id);

    if (higherIsLocked && lowerIsLocked) continue;

    if (higherIsLocked) {
      const lockedLocation = lockedGuestMap.get(higherPriority.id)!;

      let lowerSeat: any = null;
      for (const table of tables) {
        for (const seat of table.seats) {
          if (seatToGuest.get(seat.id) === lowerPriority.id) {
            lowerSeat = seat;
            break;
          }
        }
        if (lowerSeat) break;
      }

      if (!lowerSeat) continue;

      const adjacentSeats = getAdjacentSeats(lockedLocation.seat, lockedLocation.table.seats);
      const isAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);

      if (isAdjacent) continue;

      const emptyAdjacentSeat = adjacentSeats.find(s =>
        !s.locked && !seatToGuest.get(s.id)
      );

      if (emptyAdjacentSeat) {
        seatToGuest.delete(lowerSeat.id);
        seatToGuest.set(emptyAdjacentSeat.id, lowerPriority.id);
        continue;
      }

      for (const adjSeat of adjacentSeats) {
        if (adjSeat.locked) continue;

        const adjGuestId = seatToGuest.get(adjSeat.id);
        if (!adjGuestId) continue;

        const adjPartner = getSitTogetherPartner(adjGuestId, proximityRules.sitTogether);
        if (adjPartner) {
          const partnerAdjacentToAdj = getAdjacentSeats(adjSeat, lockedLocation.table.seats)
            .some(s => seatToGuest.get(s.id) === adjPartner || (s.locked && s.assignedGuestId === adjPartner));

          if (partnerAdjacentToAdj) continue;
        }

        seatToGuest.delete(lowerSeat.id);
        seatToGuest.delete(adjSeat.id);
        seatToGuest.set(adjSeat.id, lowerPriority.id);
        seatToGuest.set(lowerSeat.id, adjGuestId);
        break;
      }

      continue;
    }

    if (lowerIsLocked) {
      const lockedLocation = lockedGuestMap.get(lowerPriority.id)!;

      let higherSeat: any = null;
      for (const table of tables) {
        for (const seat of table.seats) {
          if (seatToGuest.get(seat.id) === higherPriority.id) {
            higherSeat = seat;
            break;
          }
        }
        if (higherSeat) break;
      }

      if (!higherSeat) continue;

      const adjacentSeats = getAdjacentSeats(lockedLocation.seat, lockedLocation.table.seats);
      const isAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === higherPriority.id);

      if (isAdjacent) continue;

      const emptyAdjacentSeat = adjacentSeats.find(s =>
        !s.locked && !seatToGuest.get(s.id)
      );

      if (emptyAdjacentSeat) {
        seatToGuest.delete(higherSeat.id);
        seatToGuest.set(emptyAdjacentSeat.id, higherPriority.id);
        continue;
      }

      for (const adjSeat of adjacentSeats) {
        if (adjSeat.locked) continue;

        const adjGuestId = seatToGuest.get(adjSeat.id);
        if (!adjGuestId) continue;

        const adjPartner = getSitTogetherPartner(adjGuestId, proximityRules.sitTogether);
        if (adjPartner) {
          const partnerAdjacentToAdj = getAdjacentSeats(adjSeat, lockedLocation.table.seats)
            .some(s => seatToGuest.get(s.id) === adjPartner || (s.locked && s.assignedGuestId === adjPartner));

          if (partnerAdjacentToAdj) continue;
        }

        seatToGuest.delete(higherSeat.id);
        seatToGuest.delete(adjSeat.id);
        seatToGuest.set(adjSeat.id, higherPriority.id);
        seatToGuest.set(higherSeat.id, adjGuestId);
        break;
      }

      continue;
    }

    let higherSeat: any = null;
    let higherTable: any = null;

    for (const table of tables) {
      for (const seat of table.seats) {
        if (seatToGuest.get(seat.id) === higherPriority.id) {
          higherSeat = seat;
          higherTable = table;
          break;
        }
      }
      if (higherSeat) break;
    }

    if (!higherSeat || !higherTable) continue;

    let lowerSeat: any = null;

    for (const table of tables) {
      for (const seat of table.seats) {
        if (seatToGuest.get(seat.id) === lowerPriority.id) {
          lowerSeat = seat;
          break;
        }
      }
      if (lowerSeat) break;
    }

    if (!lowerSeat) continue;

    const adjacentSeats = getAdjacentSeats(higherSeat, higherTable.seats);
    const isAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);

    if (isAdjacent) continue;

    const emptyAdjacentSeat = adjacentSeats.find(s =>
      !s.locked && !seatToGuest.get(s.id)
    );

    if (emptyAdjacentSeat) {
      seatToGuest.delete(lowerSeat.id);
      seatToGuest.set(emptyAdjacentSeat.id, lowerPriority.id);
      continue;
    }

    for (const adjSeat of adjacentSeats) {
      if (adjSeat.locked) continue;

      const adjGuestId = seatToGuest.get(adjSeat.id);
      if (!adjGuestId) continue;

      const adjPartner = getSitTogetherPartner(adjGuestId, proximityRules.sitTogether);
      if (adjPartner) {
        const partnerAdjacentToAdj = getAdjacentSeats(adjSeat, higherTable.seats)
          .some(s => seatToGuest.get(s.id) === adjPartner || (s.locked && s.assignedGuestId === adjPartner));

        if (partnerAdjacentToAdj) continue;
      }

      seatToGuest.delete(lowerSeat.id);
      seatToGuest.delete(adjSeat.id);
      seatToGuest.set(adjSeat.id, lowerPriority.id);
      seatToGuest.set(lowerSeat.id, adjGuestId);
      break;
    }
  }
}

// ============================================================================
// SIT AWAY OPTIMIZATION WITH VIP-AWARE SMART SWAPPING
// ============================================================================

function calculateViolationScore(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules
): number {
  let score = 0;
  
  for (const table of tables) {
    const seats = table.seats || [];
    
    for (const seat of seats) {
      const guestId = seat.locked && seat.assignedGuestId 
        ? seat.assignedGuestId 
        : seatToGuest.get(seat.id);
        
      if (!guestId) continue;
      
      const adjacentSeats = getAdjacentSeats(seat, seats);
      const adjacentGuestIds = adjacentSeats
        .map(s => {
          if (s.locked && s.assignedGuestId) return s.assignedGuestId;
          return seatToGuest.get(s.id);
        })
        .filter(Boolean) as string[];
      
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner && !adjacentGuestIds.includes(togetherPartner)) {
        score += 10;
      }
      
      for (const adjGuestId of adjacentGuestIds) {
        if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
          score += 10;
        }
      }
    }
  }
  
  return score;
}

function smartMoveGuest(
  guestToMove: any,
  currentSeat: any,
  table: any,
  seatToGuest: Map<string, string>,
  allTables: any[],
  proximityRules: ProximityRules,
  guestLookup: Map<string, any>,
  mustAvoidGuestId?: string
): boolean {
  const originalState = new Map(seatToGuest);
  const originalScore = calculateViolationScore(originalState, allTables, proximityRules);

  const allSeats = [...table.seats].sort((a, b) => {
    const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
    const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
    return aSeatNum - bSeatNum;
  });

  const currentIdx = allSeats.findIndex(s => s.id === currentSeat.id);
  if (currentIdx === -1) return false;

  const searchRange = 20;
  const candidateSeats = [];
  
  for (let i = currentIdx + 1; i < allSeats.length && candidateSeats.length < searchRange; i++) {
    const seat = allSeats[i];
    if (!seat.locked) {
      candidateSeats.push(seat);
    }
  }

  if (candidateSeats.length === 0) {
    return false;
  }

  const isMovingGuestVIP = isVIP(guestToMove);

  let bestScore = originalScore;
  let bestState: Map<string, string> | null = null;

  for (const candidateSeat of candidateSeats) {
    const occupantId = seatToGuest.get(candidateSeat.id);
    
    if (!occupantId) {
      const testState = new Map(originalState);
      testState.delete(currentSeat.id);
      testState.set(candidateSeat.id, guestToMove.id);
      
      if (mustAvoidGuestId) {
        const adjSeats = getAdjacentSeats(candidateSeat, allSeats);
        const wouldViolate = adjSeats.some(s => {
          const adjGuestId = s.locked && s.assignedGuestId 
            ? s.assignedGuestId 
            : testState.get(s.id);
          return adjGuestId === mustAvoidGuestId;
        });
        
        if (wouldViolate) continue;
      }
      
      const testScore = calculateViolationScore(testState, allTables, proximityRules);
      
      if (testScore < bestScore) {
        bestScore = testScore;
        bestState = testState;
      }
      
      continue;
    }
    
    const occupant = guestLookup.get(occupantId);
    if (!occupant) continue;
    
    const isOccupantVIP = isVIP(occupant);
    
    if (isMovingGuestVIP === isOccupantVIP) {
      const testState = new Map(originalState);
      testState.delete(currentSeat.id);
      testState.delete(candidateSeat.id);
      testState.set(candidateSeat.id, guestToMove.id);
      testState.set(currentSeat.id, occupantId);
      
      if (mustAvoidGuestId) {
        const adjSeats = getAdjacentSeats(candidateSeat, allSeats);
        const wouldViolate = adjSeats.some(s => {
          const adjGuestId = s.locked && s.assignedGuestId 
            ? s.assignedGuestId 
            : testState.get(s.id);
          return adjGuestId === mustAvoidGuestId;
        });
        
        if (wouldViolate) continue;
      }
      
      const testScore = calculateViolationScore(testState, allTables, proximityRules);
      
      if (testScore < bestScore) {
        bestScore = testScore;
        bestState = testState;
      }
    }
  }

  if (!bestState || bestScore >= originalScore) {
    for (const candidateSeat of candidateSeats) {
      const occupantId = seatToGuest.get(candidateSeat.id);
      if (!occupantId) continue;
      
      const occupant = guestLookup.get(occupantId);
      if (!occupant) continue;
      
      const isOccupantVIP = isVIP(occupant);
      
      if (isMovingGuestVIP !== isOccupantVIP) {
        const testState = new Map(originalState);
        testState.delete(currentSeat.id);
        testState.delete(candidateSeat.id);
        testState.set(candidateSeat.id, guestToMove.id);
        testState.set(currentSeat.id, occupantId);
        
        if (mustAvoidGuestId) {
          const adjSeats = getAdjacentSeats(candidateSeat, allSeats);
          const wouldViolate = adjSeats.some(s => {
            const adjGuestId = s.locked && s.assignedGuestId 
              ? s.assignedGuestId 
              : testState.get(s.id);
            return adjGuestId === mustAvoidGuestId;
          });
          
          if (wouldViolate) continue;
        }
        
        const testScore = calculateViolationScore(testState, allTables, proximityRules);
        
        if (testScore < bestScore) {
          bestScore = testScore;
          bestState = testState;
        }
      }
    }
  }

  if (bestState && bestScore < originalScore) {
    seatToGuest.clear();
    for (const [seatId, guestId] of bestState.entries()) {
      seatToGuest.set(seatId, guestId);
    }
    return true;
  }

  return false;
}

function applySitAwayOptimization(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  allGuests: any[],
  comparator: (a: any, b: any) => number,
  lockedGuestMap: Map<string, LockedGuestLocation>
): void {
  const guestLookup = new Map(allGuests.map(g => [g.id, g]));

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

    const higherIsLocked = lockedGuestMap.has(higherPriority.id);
    const lowerIsLocked = lockedGuestMap.has(lowerPriority.id);

    if (higherIsLocked && lowerIsLocked) continue;

    if (higherIsLocked) {
      const higherLocation = lockedGuestMap.get(higherPriority.id)!;

      let lowerSeat: any = null;
      let lowerTable: any = null;

      for (const table of tables) {
        for (const seat of table.seats) {
          if (seatToGuest.get(seat.id) === lowerPriority.id) {
            lowerSeat = seat;
            lowerTable = table;
            break;
          }
        }
        if (lowerSeat) break;
      }

      if (!lowerSeat || lowerTable.id !== higherLocation.tableId) continue;

      const adjacentSeats = getAdjacentSeats(higherLocation.seat, higherLocation.table.seats);
      const areAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);

      if (!areAdjacent) continue;

      smartMoveGuest(
        lowerPriority,
        lowerSeat,
        lowerTable,
        seatToGuest,
        tables,
        proximityRules,
        guestLookup,
        higherPriority.id
      );

      continue;
    }

    if (lowerIsLocked) continue;

    let higherSeat: any = null;
    let higherTable: any = null;
    let lowerSeat: any = null;
    let lowerTable: any = null;

    for (const table of tables) {
      for (const seat of table.seats) {
        const guestId = seatToGuest.get(seat.id);
        if (guestId === higherPriority.id) {
          higherSeat = seat;
          higherTable = table;
        }
        if (guestId === lowerPriority.id) {
          lowerSeat = seat;
          lowerTable = table;
        }
      }
    }

    if (!higherSeat || !lowerSeat || higherTable.id !== lowerTable.id) continue;

    const adjacentSeats = getAdjacentSeats(higherSeat, higherTable.seats);
    const areAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);

    if (!areAdjacent) continue;

    smartMoveGuest(
      lowerPriority,
      lowerSeat,
      lowerTable,
      seatToGuest,
      tables,
      proximityRules,
      guestLookup,
      higherPriority.id
    );
  }
}

// ============================================================================
// MAIN AUTOFILL FUNCTION
// ============================================================================

export async function autoFillSeats(options: AutoFillOptions = {}) {
  const {
    includeHost = true,
    includeExternal = true,
    sortRules = [{ field: "ranking", direction: "asc" }],
    tableRules,
    proximityRules = { sitTogether: [], sitAway: [] },
  } = options;

  const seatStore = useSeatStore.getState();
  const guestStore = useGuestStore.getState();

  if (!includeHost && !includeExternal) {
    console.warn("autoFillSeats: no guest lists selected; aborting.");
    return;
  }

  proximityViolations = [];

  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];
  const allGuests = [...hostPool, ...externalPool];

  const guestLookup: Record<string, any> = {};
  allGuests.forEach(g => guestLookup[g.id] = g);

  const tables = useSeatStore.getState().tables;
  const lockedGuestMap = buildLockedGuestMap(tables);

  const lockedGuestIds = new Set<string>();
  seatStore.tables.forEach((t: any) =>
    (t.seats ?? []).forEach((s: any) => {
      if (s.locked && s.assignedGuestId) {
        lockedGuestIds.add(s.assignedGuestId);
      }
    })
  );

  // Calculate total available seats
  const totalAvailableSeats = tables.reduce((sum, table) => {
    return sum + table.seats.filter((s: any) => !s.locked).length;
  }, 0);

  const hostCandidates = hostPool.filter((g: any) => !lockedGuestIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedGuestIds.has(g.id));

  const comparator = makeComparator(sortRules);

  // NEW: Build prioritized guest pools
  const { prioritizedHost, prioritizedExternal } = buildPrioritizedGuestPools(
    hostCandidates,
    externalCandidates,
    proximityRules,
    comparator,
    totalAvailableSeats
  );

  console.log('Prioritized guest pools:', {
    hostTotal: hostCandidates.length,
    hostPrioritized: prioritizedHost.length,
    externalTotal: externalCandidates.length,
    externalPrioritized: prioritizedExternal.length,
    availableSeats: totalAvailableSeats
  });

  // Clear unlocked seats
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
    proximityRules
  );

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

  // Apply assignments to store
  for (const [seatId, guestId] of seatToGuest.entries()) {
    for (const table of tablesAfterClear) {
      const seat = table.seats.find((s: any) => s.id === seatId);
      if (seat && !seat.locked) {
        seatStore.assignGuestToSeat(table.id, seatId, guestId);
        break;
      }
    }
  }

  // Get final tables and detect violations using centralized function
  const finalTables = useSeatStore.getState().tables;
  proximityViolations = detectProximityViolations(
    finalTables,
    proximityRules,
    guestLookup
  );

  console.log(`Autofill completed. Violations: ${proximityViolations.length}`);
}