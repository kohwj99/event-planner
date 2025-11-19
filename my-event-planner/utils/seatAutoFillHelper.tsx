//ENHANCED seatAutoFillHelper.tsx - With Smart VIP-Aware Sit-Away Logic
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

// export interface ProximityViolation {
//   type: 'sit-together' | 'sit-away' | 'table-config';
//   guest1Id: string;
//   guest2Id?: string;
//   guest1Name: string;
//   guest2Name?: string;
//   tableId: string;
//   tableLabel: string;
//   seat1Id?: string;
//   seat2Id?: string;
//   reason?: string;
// }

let proximityViolations: ProximityViolation[] = [];

export function getProximityViolations(): ProximityViolation[] {
  return proximityViolations;
}

// ============================================================================
// STEP 1: HELPER FUNCTIONS
// ============================================================================

/** Get nested field values from guest object */
function getGuestFieldValue(guest: any, field: SortField): string | number | undefined {
  if (!guest) return undefined;
  if (field === "organization") return (guest as any).company ?? (guest as any).organization ?? "";
  return (guest as any)[field];
}

/** Build multi-level comparator from sort rules */
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

/** Get adjacent seats based on adjacentSeats property */
function getAdjacentSeats(seat: any, allSeats: any[]): any[] {
  if (!seat.adjacentSeats || seat.adjacentSeats.length === 0) return [];
  return seat.adjacentSeats
    .map((adjId: string) => allSeats.find((s) => s.id === adjId))
    .filter(Boolean);
}

/** Check if two guests should sit together */
function shouldSitTogether(guest1Id: string, guest2Id: string, rules: SitTogetherRule[]): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

/** Check if two guests should sit away */
function shouldSitAway(guest1Id: string, guest2Id: string, rules: SitAwayRule[]): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

/** Get sit-together partner for a guest */
function getSitTogetherPartner(guestId: string, rules: SitTogetherRule[]): string | null {
  for (const rule of rules) {
    if (rule.guest1Id === guestId) return rule.guest2Id;
    if (rule.guest2Id === guestId) return rule.guest1Id;
  }
  return null;
}

/** Get all guests that should sit away from this guest */
function getSitAwayGuests(guestId: string, rules: SitAwayRule[]): string[] {
  const awayGuests: string[] = [];
  for (const rule of rules) {
    if (rule.guest1Id === guestId) awayGuests.push(rule.guest2Id);
    if (rule.guest2Id === guestId) awayGuests.push(rule.guest1Id);
  }
  return awayGuests;
}

/** NEW: Check if guest is VIP (ranking 1-4) */
function isVIP(guest: any): boolean {
  const ranking = Number(guest?.ranking) || Infinity;
  return ranking >= 1 && ranking <= 4;
}

// Locked guest location tracking
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

// Check if placing guest would violate sit-away with locked guests
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
// STEP 2: INITIAL PLACEMENT WITH TABLE CONFIGURATION
// ============================================================================

interface SeatingState {
  seatId: string;
  guestId: string | null;
  locked: boolean;
  seatNumber: number;
  tableId: string;
}

/**
 * Enhanced comparator that includes tie-breaking by host priority
 * Host priority is ONLY applied when sort scores are equal
 */
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
// STEP 3: PROXIMITY RULES - SIT TOGETHER (WITH LOCKED SUPPORT)
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
// STEP 4: ENHANCED SIT AWAY WITH VIP-AWARE SMART SWAPPING
// ============================================================================

/**
 * Calculate violation score for a seating arrangement
 * Lower is better
 */
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
      
      // Check sit-together violations
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner && !adjacentGuestIds.includes(togetherPartner)) {
        score += 10; // Sit-together violation penalty
      }
      
      // Check sit-away violations
      for (const adjGuestId of adjacentGuestIds) {
        if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
          score += 10; // Sit-away violation penalty
        }
      }
    }
  }
  
  return score;
}

/**
 * ENHANCED: VIP-aware sit-away optimization with smart seat selection
 * 
 * Key Features:
 * 1. Searches next 20 seats in sort order for best position
 * 2. Prefers VIP-VIP and non-VIP-non-VIP swaps first
 * 3. Only swaps across VIP/non-VIP boundary if necessary
 * 4. Reverts to original state if no improvement found
 * 5. Minimizes violation count for optimal arrangement
 */
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

    // Case 1: Both locked - can't move
    if (higherIsLocked && lowerIsLocked) continue;

    // Case 2: Higher is locked, lower is not - move lower away
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

      if (!areAdjacent) continue; // No violation

      // Smart seat selection for locked guest scenario
      smartMoveGuest(
        lowerPriority,
        lowerSeat,
        lowerTable, // Pass the actual table, not just ID
        seatToGuest,
        tables, // Pass all tables for cross-table search
        proximityRules,
        guestLookup,
        higherPriority.id // Must avoid this locked guest
      );

      continue;
    }

    // Case 3: Lower is locked, higher is not - don't move higher
    if (lowerIsLocked) continue;

    // Case 4: Neither locked - ENHANCED LOGIC
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

    if (!areAdjacent) continue; // No violation

    // ENHANCED: Smart move with VIP awareness
    smartMoveGuest(
      lowerPriority,
      lowerSeat,
      lowerTable, // Pass the actual table
      seatToGuest,
      tables, // Pass all tables for cross-table search
      proximityRules,
      guestLookup,
      higherPriority.id // Must avoid this guest
    );
  }
}

/**
 * Smart guest mover with VIP-aware swapping logic
 * 
 * Algorithm:
 * 1. Save original state for potential rollback
 * 2. Get next 20 seats in sort order from current position
 * 3. Phase 1: Try same-tier swaps (VIP-VIP or non-VIP-non-VIP)
 * 4. Phase 2: If Phase 1 fails, try cross-tier swaps
 * 5. Evaluate each candidate position by violation score
 * 6. Select position with lowest violation score
 * 7. If no improvement, revert to original state
 */
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
  // Save original state for rollback
  const originalState = new Map(seatToGuest);
  const originalScore = calculateViolationScore(originalState, allTables, proximityRules);

  // Sort all seats by seatNumber (sort order)
  const allSeats = [...table.seats].sort((a, b) => {
    const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
    const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
    return aSeatNum - bSeatNum;
  });

  const currentIdx = allSeats.findIndex(s => s.id === currentSeat.id);
  if (currentIdx === -1) return false;

  // Get next 20 seats (or until end of table)
  const searchRange = 20;
  const candidateSeats = [];
  
  for (let i = currentIdx + 1; i < allSeats.length && candidateSeats.length < searchRange; i++) {
    const seat = allSeats[i];
    if (!seat.locked) {
      candidateSeats.push(seat);
    }
  }

  if (candidateSeats.length === 0) {
    return false; // No candidates to try
  }

  const isMovingGuestVIP = isVIP(guestToMove);

  // Track best solution
  let bestScore = originalScore;
  let bestState: Map<string, string> | null = null;

  // PHASE 1: Try same-tier swaps first (VIP-VIP or non-VIP-non-VIP)
  for (const candidateSeat of candidateSeats) {
    const occupantId = seatToGuest.get(candidateSeat.id);
    
    // Check if seat is empty
    if (!occupantId) {
      // Try moving to empty seat
      const testState = new Map(originalState);
      testState.delete(currentSeat.id);
      testState.set(candidateSeat.id, guestToMove.id);
      
      // Check if this position avoids the mustAvoid guest
      if (mustAvoidGuestId) {
        const adjSeats = getAdjacentSeats(candidateSeat, allSeats);
        const wouldViolate = adjSeats.some(s => {
          const adjGuestId = s.locked && s.assignedGuestId 
            ? s.assignedGuestId 
            : testState.get(s.id);
          return adjGuestId === mustAvoidGuestId;
        });
        
        if (wouldViolate) continue; // Skip this position
      }
      
      const testScore = calculateViolationScore(testState, allTables, proximityRules);
      
      if (testScore < bestScore) {
        bestScore = testScore;
        bestState = testState;
      }
      
      continue;
    }
    
    // Occupied seat - consider swapping
    const occupant = guestLookup.get(occupantId);
    if (!occupant) continue;
    
    const isOccupantVIP = isVIP(occupant);
    
    // PHASE 1: Only swap within same tier
    if (isMovingGuestVIP === isOccupantVIP) {
      // Try swapping
      const testState = new Map(originalState);
      testState.delete(currentSeat.id);
      testState.delete(candidateSeat.id);
      testState.set(candidateSeat.id, guestToMove.id);
      testState.set(currentSeat.id, occupantId);
      
      // Check if new position avoids mustAvoid guest
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

  // PHASE 2: If no improvement, try cross-tier swaps
  if (!bestState || bestScore >= originalScore) {
    for (const candidateSeat of candidateSeats) {
      const occupantId = seatToGuest.get(candidateSeat.id);
      if (!occupantId) continue; // Already tried empty seats
      
      const occupant = guestLookup.get(occupantId);
      if (!occupant) continue;
      
      const isOccupantVIP = isVIP(occupant);
      
      // PHASE 2: Try cross-tier swaps (VIP <-> non-VIP)
      if (isMovingGuestVIP !== isOccupantVIP) {
        const testState = new Map(originalState);
        testState.delete(currentSeat.id);
        testState.delete(candidateSeat.id);
        testState.set(candidateSeat.id, guestToMove.id);
        testState.set(currentSeat.id, occupantId);
        
        // Check if new position avoids mustAvoid guest
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

  // Apply best solution if found
  if (bestState && bestScore < originalScore) {
    // Clear and apply best state
    seatToGuest.clear();
    for (const [seatId, guestId] of bestState.entries()) {
      seatToGuest.set(seatId, guestId);
    }
    return true; // Success
  }

  // No improvement found - state already at original, no need to revert
  return false; // Failed to improve
}

// ============================================================================
// STEP 5: VIOLATION DETECTION (WITH LOCKED SUPPORT)
// ============================================================================

function detectViolations(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  allGuests: any[],
  tableRules?: TableRules
): ProximityViolation[] {
  const violations: ProximityViolation[] = [];
  const guestLookup = new Map(allGuests.map(g => [g.id, g]));

  for (const table of tables) {
    const seats = table.seats || [];

    for (const seat of seats) {
      const guestId = seat.locked && seat.assignedGuestId
        ? seat.assignedGuestId
        : seatToGuest.get(seat.id);

      if (!guestId) continue;

      const guest = guestLookup.get(guestId);
      if (!guest) continue;

      const adjacentSeats = getAdjacentSeats(seat, seats);

      const adjacentGuestIds = adjacentSeats
        .map(s => {
          if (s.locked && s.assignedGuestId) return s.assignedGuestId;
          return seatToGuest.get(s.id);
        })
        .filter(Boolean) as string[];

      // Check sit-together violations
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner) {
        const partner = guestLookup.get(togetherPartner);
        if (partner && !adjacentGuestIds.includes(togetherPartner)) {
          const partnerAssigned = Array.from(seatToGuest.values()).includes(togetherPartner) ||
            tables.some(t => t.seats.some((s: any) => s.locked && s.assignedGuestId === togetherPartner));

          if (partnerAssigned) {
            const alreadyReported = violations.some(v =>
              v.type === 'sit-together' &&
              ((v.guest1Id === guestId && v.guest2Id === togetherPartner) ||
                (v.guest1Id === togetherPartner && v.guest2Id === guestId))
            );

            if (!alreadyReported) {
              violations.push({
                type: 'sit-together',
                guest1Id: guestId,
                guest2Id: togetherPartner,
                guest1Name: guest.name,
                guest2Name: partner.name,
                tableId: table.id,
                tableLabel: table.label,
                seat1Id: seat.id,
              });
            }
          }
        }
      }

      // Check sit-away violations
      for (const adjGuestId of adjacentGuestIds) {
        if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
          const adjGuest = guestLookup.get(adjGuestId);
          const adjSeat = seats.find((s: any) =>
            (s.locked && s.assignedGuestId === adjGuestId) ||
            seatToGuest.get(s.id) === adjGuestId
          );

          if (adjGuest && adjSeat) {
            const alreadyReported = violations.some(v =>
              v.type === 'sit-away' &&
              ((v.guest1Id === guestId && v.guest2Id === adjGuestId) ||
                (v.guest1Id === adjGuestId && v.guest2Id === guestId))
            );

            if (!alreadyReported) {
              violations.push({
                type: 'sit-away',
                guest1Id: guestId,
                guest2Id: adjGuestId,
                guest1Name: guest.name,
                guest2Name: adjGuest.name,
                tableId: table.id,
                tableLabel: table.label,
                seat1Id: seat.id,
                seat2Id: adjSeat.id,
              });
            }
          }
        }
      }
    }
  }

  return violations;
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

  // Reset violations
  proximityViolations = [];

  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];
  const allGuests = [...hostPool, ...externalPool];

  // Build guest lookup
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

  const hostCandidates = hostPool.filter((g: any) => !lockedGuestIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedGuestIds.has(g.id));

  const comparator = makeComparator(sortRules);
  const sortedHostCandidates = [...hostCandidates].sort(comparator);
  const sortedExternalCandidates = [...externalCandidates].sort(comparator);

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
    sortedHostCandidates,
    sortedExternalCandidates,
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