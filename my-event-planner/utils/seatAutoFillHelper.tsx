// FIXED seatAutoFillHelper.tsx - With Cluster-Based Sit-Together Algorithm
// ============================================================================
// 
// KEY FIXES:
// 1. Changed getSitTogetherPartner to getAllSitTogetherPartners (returns ALL partners)
// 2. Added Union-Find algorithm to build sit-together clusters/groups
// 3. Rewrote applySitTogetherOptimization to work with groups, not just pairs
// 4. Properly handles cases like A+B, A+C where A should be between B and C
// 5. Reports violations for ALL unfulfilled sit-together rules
// ============================================================================

import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";
import { detectProximityViolations, ProximityViolation } from './violationDetector';
import { SeatMode, canGuestSitInSeat } from '@/types/Seat';

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

    // Tiebreaker 1: Host guests come before external guests
    const aIsHost = a?.fromHost === true;
    const bIsHost = b?.fromHost === true;
    if (aIsHost && !bIsHost) return -1; // a is host, b is external → a first
    if (!aIsHost && bIsHost) return 1;  // a is external, b is host → b first

    // Tiebreaker 2: Alphabetical by name (for guests of the same type)
    const aName = String(a?.name || "").toLowerCase();
    const bName = String(b?.name || "").toLowerCase();
    return aName.localeCompare(bName);
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

/**
 * FIXED: Get ALL sit-together partners for a guest (not just the first one)
 * 
 * This is the critical fix - the old function only returned one partner.
 * With rules A+B and A+C, we need to return [B, C] for guest A.
 */
function getAllSitTogetherPartners(guestId: string, rules: SitTogetherRule[]): string[] {
  const partners: string[] = [];
  for (const rule of rules) {
    if (rule.guest1Id === guestId && !partners.includes(rule.guest2Id)) {
      partners.push(rule.guest2Id);
    }
    if (rule.guest2Id === guestId && !partners.includes(rule.guest1Id)) {
      partners.push(rule.guest1Id);
    }
  }
  return partners;
}

/**
 * @deprecated Use getAllSitTogetherPartners instead
 * Kept for backward compatibility but now returns first partner only
 */
function getSitTogetherPartner(guestId: string, rules: SitTogetherRule[]): string | null {
  const partners = getAllSitTogetherPartners(guestId, rules);
  return partners.length > 0 ? partners[0] : null;
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
// SEAT MODE VALIDATION HELPERS
// ============================================================================

function canPlaceGuestInSeat(guest: any, seat: any): boolean {
  const mode: SeatMode = seat.mode || 'default';
  const guestFromHost = guest.fromHost === true;
  return canGuestSitInSeat(guestFromHost, mode);
}

function getNextCompatibleGuest(
  allCandidates: any[],
  assignedGuests: Set<string>,
  seat: any
): any | null {
  const available = allCandidates.filter(g =>
    !assignedGuests.has(g.id) && canPlaceGuestInSeat(g, seat)
  );
  if (available.length === 0) return null;
  return available[0];
}

function getNextCompatibleGuestOfType(
  allCandidates: any[],
  assignedGuests: Set<string>,
  isHost: boolean,
  seat: any
): any | null {
  const available = allCandidates.filter(g =>
    !assignedGuests.has(g.id) &&
    g.fromHost === isHost &&
    canPlaceGuestInSeat(g, seat)
  );
  if (available.length === 0) return null;
  return available[0];
}

// ============================================================================
// UNION-FIND FOR BUILDING SIT-TOGETHER CLUSTERS
// ============================================================================

/**
 * Union-Find data structure for grouping guests who must sit together
 */
class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.makeSet(x);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!)); // Path compression
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    // Union by rank
    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const x of this.parent.keys()) {
      const root = this.find(x);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(x);
    }
    return groups;
  }
}

/**
 * Build sit-together clusters using Union-Find
 * Returns groups of guests that should all sit adjacent to each other
 */
function buildSitTogetherClusters(rules: SitTogetherRule[]): Map<string, string[]> {
  const uf = new UnionFind();

  for (const rule of rules) {
    uf.makeSet(rule.guest1Id);
    uf.makeSet(rule.guest2Id);
    uf.union(rule.guest1Id, rule.guest2Id);
  }

  return uf.getGroups();
}

/**
 * For a cluster, determine the optimal ordering (guest with most connections in middle)
 * Returns ordered array of guest IDs for best adjacent placement
 */
function getOptimalClusterOrder(
  clusterGuestIds: string[],
  rules: SitTogetherRule[],
  guestLookup: Map<string, any>,
  comparator: (a: any, b: any) => number
): string[] {
  if (clusterGuestIds.length <= 2) {
    // For pairs, sort by priority
    return clusterGuestIds.sort((a, b) => {
      const guestA = guestLookup.get(a);
      const guestB = guestLookup.get(b);
      if (!guestA || !guestB) return 0;
      return comparator(guestA, guestB);
    });
  }

  // Count connections for each guest in cluster
  const connectionCount = new Map<string, number>();
  for (const guestId of clusterGuestIds) {
    connectionCount.set(guestId, 0);
  }

  for (const rule of rules) {
    if (clusterGuestIds.includes(rule.guest1Id) && clusterGuestIds.includes(rule.guest2Id)) {
      connectionCount.set(rule.guest1Id, (connectionCount.get(rule.guest1Id) || 0) + 1);
      connectionCount.set(rule.guest2Id, (connectionCount.get(rule.guest2Id) || 0) + 1);
    }
  }

  // Sort by connection count (most connections first - they go in middle)
  // Secondary sort by priority
  const sorted = [...clusterGuestIds].sort((a, b) => {
    const countDiff = (connectionCount.get(b) || 0) - (connectionCount.get(a) || 0);
    if (countDiff !== 0) return countDiff;

    const guestA = guestLookup.get(a);
    const guestB = guestLookup.get(b);
    if (!guestA || !guestB) return 0;
    return comparator(guestA, guestB);
  });

  // Place most-connected guests in the middle
  // For [A, B, C] where A has most connections: result is [B, A, C]
  if (sorted.length >= 3) {
    const result: string[] = [];
    const center = sorted[0]; // Most connected goes in center
    const others = sorted.slice(1);

    // Distribute others around center
    for (let i = 0; i < others.length; i++) {
      if (i % 2 === 0) {
        result.push(others[i]);
      } else {
        result.unshift(others[i]);
      }
    }

    // Insert center in the middle
    const middleIndex = Math.floor(result.length / 2);
    result.splice(middleIndex, 0, center);

    return result;
  }

  return sorted;
}

// ============================================================================
// PRIORITY-BASED GUEST POOL BUILDER
// ============================================================================

function buildPrioritizedGuestPools(
  hostCandidates: any[],
  externalCandidates: any[],
  proximityRules: ProximityRules,
  comparator: (a: any, b: any) => number,
  totalAvailableSeats: number
): { prioritizedHost: any[]; prioritizedExternal: any[] } {
  const guestsInProximityRules = new Set<string>();

  proximityRules.sitTogether.forEach(rule => {
    guestsInProximityRules.add(rule.guest1Id);
    guestsInProximityRules.add(rule.guest2Id);
  });

  proximityRules.sitAway.forEach(rule => {
    guestsInProximityRules.add(rule.guest1Id);
    guestsInProximityRules.add(rule.guest2Id);
  });

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

    mustInclude.sort(comparator);
    regular.sort(comparator);

    return { mustInclude, regular };
  }

  const hostGroups = prioritizeGuests(hostCandidates);
  const externalGroups = prioritizeGuests(externalCandidates);

  const prioritizedHost: any[] = [
    ...hostGroups.mustInclude,
    ...hostGroups.regular
  ];

  const prioritizedExternal: any[] = [
    ...externalGroups.mustInclude,
    ...externalGroups.regular
  ];

  return {
    prioritizedHost,
    prioritizedExternal
  };
}

// ============================================================================
// INITIAL PLACEMENT WITH PRIORITY AWARENESS AND SEAT MODE SUPPORT
// ============================================================================

function makeComparatorWithHostTieBreak(baseComparator: (a: any, b: any) => number) {
  return (a: any, b: any) => {
    const sortResult = baseComparator(a, b);
    if (sortResult !== 0) return sortResult;

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

// ============================================================================
// CLUSTER-BASED SIT TOGETHER OPTIMIZATION (FIXED)
// ============================================================================

/**
 * Find the seat where a guest is currently assigned
 */
function findGuestSeat(
  guestId: string,
  tables: any[],
  seatToGuest: Map<string, string>
): { seat: any; table: any } | null {
  for (const table of tables) {
    for (const seat of table.seats) {
      if (seatToGuest.get(seat.id) === guestId) {
        return { seat, table };
      }
      // Also check locked seats
      if (seat.locked && seat.assignedGuestId === guestId) {
        return { seat, table };
      }
    }
  }
  return null;
}

/**
 * Check if two guests are currently adjacent
 */
function areGuestsAdjacent(
  guest1Id: string,
  guest2Id: string,
  tables: any[],
  seatToGuest: Map<string, string>,
  lockedGuestMap: Map<string, LockedGuestLocation>
): boolean {
  const loc1 = findGuestSeat(guest1Id, tables, seatToGuest);
  const loc2 = findGuestSeat(guest2Id, tables, seatToGuest);

  if (!loc1 || !loc2) return false;
  if (loc1.table.id !== loc2.table.id) return false;

  const adjacentSeats = getAdjacentSeats(loc1.seat, loc1.table.seats);
  return adjacentSeats.some(adjSeat => {
    const adjGuestId = seatToGuest.get(adjSeat.id) || (adjSeat.locked ? adjSeat.assignedGuestId : null);
    return adjGuestId === guest2Id;
  });
}

/**
 * Find contiguous empty seats starting from a given seat
 */
function findContiguousSeats(
  startSeat: any,
  allSeats: any[],
  count: number,
  seatToGuest: Map<string, string>,
  guests: any[],
  lockedGuestMap: Map<string, LockedGuestLocation>
): any[] {
  const result: any[] = [startSeat];
  const visited = new Set<string>([startSeat.id]);

  // BFS to find adjacent seats
  while (result.length < count) {
    let foundNext = false;

    for (const currentSeat of result) {
      const adjacentSeats = getAdjacentSeats(currentSeat, allSeats);

      for (const adjSeat of adjacentSeats) {
        if (visited.has(adjSeat.id)) continue;
        if (adjSeat.locked) continue;

        visited.add(adjSeat.id);
        result.push(adjSeat);
        foundNext = true;

        if (result.length >= count) break;
      }

      if (result.length >= count) break;
    }

    if (!foundNext) break;
  }

  return result;
}

/**
 * FIXED: Cluster-based sit-together optimization
 * 
 * This function:
 * 1. Builds clusters of guests who must sit together using Union-Find
 * 2. For each cluster, determines optimal seating order (most-connected guest in middle)
 * 3. Tries to place cluster members in adjacent seats
 * 4. Works with groups rather than processing pairs independently
 */
function applySitTogetherOptimization(
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
  for (const [rootId, clusterGuestIds] of clusters) {
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
    if (tableIds.size > 1) {
      console.log(`Cluster spans multiple tables - skipping optimization (violation will be reported)`);
      continue;
    }

    // Find the anchor: prioritize locked guests, then highest priority seated guest
    const lockedInCluster = clusterLocations.filter(loc => loc.isLocked);
    let anchor = lockedInCluster.length > 0
      ? lockedInCluster[0]
      : clusterLocations[0];

    if (!anchor) continue;

    const table = anchor.table;
    const allSeats = table.seats;

    // Try to arrange cluster members around the anchor
    const adjacentToAnchor = getAdjacentSeats(anchor.seat, allSeats);

    // For each guest in ordered cluster (except anchor), try to place adjacent
    for (let i = 0; i < orderedGuests.length; i++) {
      const guestId = orderedGuests[i];
      const guest = guestLookup.get(guestId);

      if (!guest) continue;
      if (lockedGuestMap.has(guestId)) continue; // Can't move locked guests

      // Get all partners this guest should be adjacent to
      const partners = getAllSitTogetherPartners(guestId, proximityRules.sitTogether);

      // Find a seat that maximizes adjacency to partners
      const currentLocation = findGuestSeat(guestId, tables, seatToGuest);
      if (!currentLocation || currentLocation.table.id !== table.id) continue;

      // Count how many partners are currently adjacent
      const currentAdjacentPartners = partners.filter(partnerId =>
        areGuestsAdjacent(guestId, partnerId, tables, seatToGuest, lockedGuestMap)
      );

      // If already adjacent to all partners, skip
      if (currentAdjacentPartners.length === partners.length) continue;

      // Find seats adjacent to at least one partner
      const partnerSeats: any[] = [];
      for (const partnerId of partners) {
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

        for (const partnerId of partners) {
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

              console.log(`Swapped ${guest.name} to improve cluster adjacency`);
            }
          }
        } else {
          // Empty seat - just move
          seatToGuest.delete(guestCurrentSeat.id);
          seatToGuest.set(bestSeat.id, guestId);

          console.log(`Moved ${guest.name} to empty adjacent seat`);
        }
      }
    }
  }

  // Second pass: Try direct swaps for remaining violations
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

    if (lockedGuestMap.has(guestToMove.id)) continue;

    const anchorLoc = findGuestSeat(anchorGuest.id, tables, seatToGuest);
    const movingLoc = findGuestSeat(guestToMove.id, tables, seatToGuest);

    if (!anchorLoc || !movingLoc) continue;
    if (anchorLoc.table.id !== movingLoc.table.id) continue; // Different tables

    const adjacentToAnchor = getAdjacentSeats(anchorLoc.seat, anchorLoc.table.seats);

    // Try to find an empty adjacent seat
    const emptyAdjacent = adjacentToAnchor.find(s =>
      !s.locked &&
      !seatToGuest.get(s.id) &&
      canPlaceGuestInSeat(guestToMove, s)
    );

    if (emptyAdjacent) {
      seatToGuest.delete(movingLoc.seat.id);
      seatToGuest.set(emptyAdjacent.id, guestToMove.id);
      console.log(`Direct move: ${guestToMove.name} to sit next to ${anchorGuest.name}`);
      continue;
    }

    // Try swapping with someone adjacent to anchor
    for (const adjSeat of adjacentToAnchor) {
      if (adjSeat.locked) continue;
      if (!canPlaceGuestInSeat(guestToMove, adjSeat)) continue;

      const adjGuestId = seatToGuest.get(adjSeat.id);
      if (!adjGuestId) continue;

      const adjGuest = guestLookup.get(adjGuestId);
      if (!adjGuest) continue;
      if (!canPlaceGuestInSeat(adjGuest, movingLoc.seat)) continue;

      // Check if adjacent guest has their own sit-together rules
      const adjGuestPartners = getAllSitTogetherPartners(adjGuestId, proximityRules.sitTogether);

      // Don't swap if it would break the adjacent guest's sit-together rule with anchor
      if (adjGuestPartners.includes(anchorGuest.id)) continue;

      // Perform swap
      seatToGuest.delete(movingLoc.seat.id);
      seatToGuest.delete(adjSeat.id);
      seatToGuest.set(adjSeat.id, guestToMove.id);
      seatToGuest.set(movingLoc.seat.id, adjGuestId);

      console.log(`Swap: ${guestToMove.name} <-> ${adjGuest.name} to satisfy sit-together`);
      break;
    }
  }
}

// ============================================================================
// SIT AWAY OPTIMIZATION (FIXED - WITH VIOLATION COUNTING & CROSS-TABLE SUPPORT)
// ============================================================================

/**
 * Count the total number of violations for current seatToGuest arrangement
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
 * Helper to find guest seat considering both seatToGuest map and locked seats
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
 * Check if a seat is adjacent to a specific guest
 */
function isSeatAdjacentToGuest(
  seat: any,
  table: any,
  guestId: string,
  seatToGuest: Map<string, string>,
  lockedGuestMap: Map<string, LockedGuestLocation>
): boolean {
  const adjacentSeats = getAdjacentSeats(seat, table.seats);

  for (const adjSeat of adjacentSeats) {
    const guestInAdjSeat = seatToGuest.get(adjSeat.id) || (adjSeat.locked ? adjSeat.assignedGuestId : null);
    if (guestInAdjSeat === guestId) return true;
  }

  return false;
}

/**
 * Get all candidate seats across all tables that are NOT adjacent to a specific guest
 * Prioritizes same-table seats first, then other tables
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
 * FIXED: Sit-away optimization with proper violation counting and cross-table support
 * 
 * Algorithm:
 * 1. For each sit-away pair, check if they are currently adjacent
 * 2. If adjacent, find candidate seats that are NOT adjacent to the other guest
 * 3. Try up to MAX_ATTEMPTS swaps, evaluating total violations after each
 * 4. Keep the swap only if it reduces total violations
 * 5. If no improvement after all attempts, leave as-is (violation will be reported)
 */
function applySitAwayOptimization(
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
      const targetTable = candidate.table;
      const targetGuestId = seatToGuest.get(targetSeat.id);

      // Save current state for potential rollback
      const originalMovingSeatId = movingLoc.seat.id;
      const originalMovingGuestId = guestToMove.id;

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
        const wouldCreateNewViolation = targetSitAwayGuests.some(avoidId =>
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
          console.log(`  Swap ${guestToMove.name} <-> ${targetGuest.name}: violations ${baselineViolations} -> ${newViolations} âœ“`);
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
          console.log(`  Move ${guestToMove.name} to empty seat: violations ${baselineViolations} -> ${newViolations} âœ“`);
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

// ============================================================================
// FINAL COMPREHENSIVE VIOLATION CHECK
// ============================================================================

/**
 * Comprehensive final violation check that explicitly goes through ALL rules
 * and ensures ALL violations are captured and reported.
 * 
 * This function is called at the very end of autofill to guarantee
 * no violations are missed, regardless of what the optimization algorithms did.
 */
function performFinalViolationCheck(
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

  const totalAvailableSeats = tables.reduce((sum, table) => {
    return sum + table.seats.filter((s: any) => !s.locked).length;
  }, 0);

  const hostCandidates = hostPool.filter((g: any) => !lockedGuestIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedGuestIds.has(g.id));

  const comparator = makeComparator(sortRules);

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

  // =========================================================================
  // ASSIGN GUESTS TO SEATS IN STORE
  // =========================================================================
  const seatStoreForAssign = useSeatStore.getState();

  // Temporarily disable proximity rules during assignment to avoid mid-assignment checks
  seatStoreForAssign.setProximityRules(null);
  seatStoreForAssign.setGuestLookup(guestLookup);

  for (const [seatId, guestId] of seatToGuest.entries()) {
    for (const table of tablesAfterClear) {
      const seat = table.seats.find((s: any) => s.id === seatId);
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

  // Summary logging
  console.log('========================================');
  console.log(`AUTOFILL COMPLETE`);
  console.log(`Total violations: ${proximityViolations.length}`);

  const sitTogetherViolations = proximityViolations.filter(v => v.type === 'sit-together');
  const sitAwayViolations = proximityViolations.filter(v => v.type === 'sit-away');

  console.log(`  - Sit-together violations: ${sitTogetherViolations.length}`);
  console.log(`  - Sit-away violations: ${sitAwayViolations.length}`);

  if (proximityViolations.length > 0) {
    console.log('Violation details:');
    for (const v of proximityViolations) {
      console.log(`  ${v.guest1Name} & ${v.guest2Name}: ${v.reason}`);
    }
  }
  console.log('========================================');
}