// ============================================================================
// FIXED seatAutoFillHelper.tsx - Respects Custom Seat Ordering
// ============================================================================

import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";

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

export interface ProximityViolation {
  type: 'sit-together' | 'sit-away';
  guest1Id: string;
  guest2Id: string;
  guest1Name: string;
  guest2Name: string;
  tableId: string;
  tableLabel: string;
  seat1Id: string;
  seat2Id: string;
}

let proximityViolations: ProximityViolation[] = [];

export function getProximityViolations(): ProximityViolation[] {
  return proximityViolations;
}

/** Helper: read nested field values */
function getGuestFieldValue(guest: any, field: SortField): string | number | undefined {
  if (!guest) return undefined;
  if (field === "organization") return (guest as any).company ?? (guest as any).organization ?? "";
  return (guest as any)[field];
}

/** Build comparator from ordered sort rules */
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

    const ida = String((a && a.id) || "");
    const idb = String((b && b.id) || "");
    return ida.localeCompare(idb);
  };
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

/** Get the partner guest ID from sit-together rules */
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

/** Get all adjacent seat IDs for a given seat */
function getAdjacentSeats(seat: any, allSeats: any[]): any[] {
  if (!seat.adjacentSeats || seat.adjacentSeats.length === 0) return [];
  return seat.adjacentSeats
    .map((adjId: string) => allSeats.find((s) => s.id === adjId))
    .filter(Boolean);
}

/**
 * Build a proximity constraint map for strategic planning
 */
interface GuestConstraints {
  guestId: string;
  togetherWith: string | null;
  awayFrom: string[];
  priority: number;
}

function buildConstraintMap(
  allGuests: any[],
  proximityRules: ProximityRules
): Map<string, GuestConstraints> {
  const constraintMap = new Map<string, GuestConstraints>();
  
  for (const guest of allGuests) {
    const togetherWith = getSitTogetherPartner(guest.id, proximityRules.sitTogether);
    const awayFrom = getSitAwayGuests(guest.id, proximityRules.sitAway);
    const priority = (togetherWith ? 100 : 0) + (awayFrom.length * 10);
    
    constraintMap.set(guest.id, {
      guestId: guest.id,
      togetherWith,
      awayFrom,
      priority,
    });
  }
  
  return constraintMap;
}

/**
 * Re-order guest list to prioritize constrained guests
 */
function reorderByConstraints(
  guests: any[],
  constraintMap: Map<string, GuestConstraints>
): any[] {
  const guestsWithPriority = guests.map((g) => ({
    guest: g,
    constraints: constraintMap.get(g.id) || {
      guestId: g.id,
      togetherWith: null,
      awayFrom: [],
      priority: 0,
    },
  }));
  
  guestsWithPriority.sort((a, b) => b.constraints.priority - a.constraints.priority);
  return guestsWithPriority.map((item) => item.guest);
}

/**
 * Check if a guest can be safely placed in a seat
 */
function canSafelyPlace(
  guestId: string,
  seat: any,
  allSeats: any[],
  constraints: GuestConstraints,
  proximityRules: ProximityRules
): { safe: boolean; reason?: string } {
  const adjacentSeats = getAdjacentSeats(seat, allSeats);
  
  for (const adjSeat of adjacentSeats) {
    if (!adjSeat.assignedGuestId) continue;
    
    const adjGuestId = adjSeat.assignedGuestId;
    
    // Check sit-away violations
    if (constraints.awayFrom.includes(adjGuestId)) {
      return { safe: false, reason: `sit-away violation with ${adjGuestId}` };
    }
  }
  
  return { safe: true };
}

/**
 * Strategic pre-seating for sit-together pairs
 */
function strategicPreSeatPairs(
  tables: any[],
  allGuests: any[],
  assignedSet: Set<string>,
  proximityRules: ProximityRules,
  constraintMap: Map<string, GuestConstraints>,
  seatStore: any
): void {
  const guestMap = new Map(allGuests.map((g) => [g.id, g]));
  const seatedPairs = new Set<string>();
  
  const rulesWithPriority = proximityRules.sitTogether.map((rule) => {
    const c1 = constraintMap.get(rule.guest1Id);
    const c2 = constraintMap.get(rule.guest2Id);
    const combinedPriority = (c1?.priority || 0) + (c2?.priority || 0);
    return { rule, priority: combinedPriority };
  });
  
  rulesWithPriority.sort((a, b) => b.priority - a.priority);
  
  for (const { rule } of rulesWithPriority) {
    const pairKey = [rule.guest1Id, rule.guest2Id].sort().join('-');
    if (seatedPairs.has(pairKey)) continue;
    
    const guest1 = guestMap.get(rule.guest1Id);
    const guest2 = guestMap.get(rule.guest2Id);
    
    if (!guest1 || !guest2 || assignedSet.has(guest1.id) || assignedSet.has(guest2.id)) {
      continue;
    }
    
    const c1 = constraintMap.get(guest1.id)!;
    const c2 = constraintMap.get(guest2.id)!;
    
    for (const table of tables) {
      const seats = (table.seats || []).filter((s: any) => !s.locked);
      let foundSeats = false;
      
      for (const seat of seats) {
        if (seat.assignedGuestId) continue;
        
        const adjacentSeats = getAdjacentSeats(seat, seats);
        
        for (const adjSeat of adjacentSeats) {
          if (!adjSeat.assignedGuestId && !adjSeat.locked) {
            const safe1 = canSafelyPlace(guest1.id, seat, seats, c1, proximityRules);
            const safe2 = canSafelyPlace(guest2.id, adjSeat, seats, c2, proximityRules);
            
            if (safe1.safe && safe2.safe) {
              seatStore.assignGuestToSeat(table.id, seat.id, guest1.id);
              seatStore.assignGuestToSeat(table.id, adjSeat.id, guest2.id);
              
              assignedSet.add(guest1.id);
              assignedSet.add(guest2.id);
              seatedPairs.add(pairKey);
              
              foundSeats = true;
              break;
            }
          }
        }
        
        if (foundSeats) break;
      }
      
      if (foundSeats) break;
    }
  }
}

/**
 * Smart guest selection that ALWAYS reconsiders all unassigned guests
 */
function selectBestGuestForSeat(
  allCandidates: any[],
  assignedSet: Set<string>,
  nextSeat: any,
  allSeats: any[],
  constraintMap: Map<string, GuestConstraints>,
  proximityRules: ProximityRules,
  comparator: (a: any, b: any) => number
): any | null {
  const adjacentSeats = getAdjacentSeats(nextSeat, allSeats);
  const adjacentGuestIds = adjacentSeats
    .map((s) => s.assignedGuestId)
    .filter(Boolean) as string[];
  
  // PRIORITY 1: Check if any adjacent guest has an unassigned sit-together partner
  for (const adjGuestId of adjacentGuestIds) {
    const partner = getSitTogetherPartner(adjGuestId, proximityRules.sitTogether);
    if (partner && !assignedSet.has(partner)) {
      const partnerGuest = allCandidates.find((c) => c.id === partner);
      if (partnerGuest) {
        const constraints = constraintMap.get(partner);
        if (constraints) {
          const safetyCheck = canSafelyPlace(partner, nextSeat, allSeats, constraints, proximityRules);
          if (safetyCheck.safe) {
            return partnerGuest;
          }
        }
      }
    }
  }
  
  // PRIORITY 2: Find best available guest from ALL unassigned candidates
  const unassignedCandidates = allCandidates.filter((c) => !assignedSet.has(c.id));
  
  // Sort by constraints first, then by original sort order
  const sortedUnassigned = [...unassignedCandidates].sort((a, b) => {
    const ca = constraintMap.get(a.id);
    const cb = constraintMap.get(b.id);
    
    // Prioritize guests with sit-together partners still unassigned
    const aHasUnassignedPartner = ca?.togetherWith && !assignedSet.has(ca.togetherWith);
    const bHasUnassignedPartner = cb?.togetherWith && !assignedSet.has(cb.togetherWith);
    
    if (aHasUnassignedPartner && !bHasUnassignedPartner) return -1;
    if (!aHasUnassignedPartner && bHasUnassignedPartner) return 1;
    
    // Then by original sort order
    return comparator(a, b);
  });
  
  // Try each candidate in order until we find one that's safe
  for (const candidate of sortedUnassigned) {
    const constraints = constraintMap.get(candidate.id);
    if (!constraints) continue;
    
    const safetyCheck = canSafelyPlace(candidate.id, nextSeat, allSeats, constraints, proximityRules);
    
    if (safetyCheck.safe) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Detect violations after seating is complete
 */
function detectViolations(proximityRules: ProximityRules, guestStore: any): ProximityViolation[] {
  const violations: ProximityViolation[] = [];
  const seatStore = useSeatStore.getState();
  const allGuests = [...guestStore.hostGuests, ...guestStore.externalGuests];
  const guestLookup: Record<string, any> = {};
  allGuests.forEach((g: any) => (guestLookup[g.id] = g));
  
  for (const table of seatStore.tables) {
    const seats = table.seats || [];
    
    for (const seat of seats) {
      if (!seat.assignedGuestId) continue;
      
      const guestId = seat.assignedGuestId;
      const guest = guestLookup[guestId];
      if (!guest) continue;
      
      const adjacentSeats = getAdjacentSeats(seat, seats);
      const adjacentGuestIds = adjacentSeats
        .map((s) => s.assignedGuestId)
        .filter(Boolean) as string[];
      
      // Check sit-together violations
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner) {
        const partner = guestLookup[togetherPartner];
        if (partner && !adjacentGuestIds.includes(togetherPartner)) {
          const partnerAssigned = seatStore.tables.some((t: any) =>
            t.seats.some((s: any) => s.assignedGuestId === togetherPartner)
          );
          
          if (partnerAssigned) {
            const alreadyReported = violations.some(
              (v) =>
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
                seat2Id: '',
              });
            }
          }
        }
      }
      
      // Check sit-away violations
      for (const adjGuestId of adjacentGuestIds) {
        if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
          const adjGuest = guestLookup[adjGuestId];
          const adjSeat = seats.find((s: any) => s.assignedGuestId === adjGuestId);
          
          if (adjGuest && adjSeat) {
            const alreadyReported = violations.some(
              (v) =>
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

/**
 * MAIN AUTOFILL FUNCTION - Respects custom seat ordering
 */
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

  // Collect candidates
  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];
  const allGuests = [...hostPool, ...externalPool];

  // Build constraint map
  const constraintMap = buildConstraintMap(allGuests, proximityRules);

  // Identify locked guests
  const lockedAssignedIds = new Set<string>();
  seatStore.tables.forEach((t: any) =>
    (t.seats ?? []).forEach((s: any) => {
      if (s.locked && s.assignedGuestId) lockedAssignedIds.add(s.assignedGuestId);
    })
  );

  // Filter out locked guests
  const hostCandidates = hostPool.filter((g: any) => !lockedAssignedIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedAssignedIds.has(g.id));

  // Sort candidates
  const comparator = makeComparator(sortRules);
  let sortedHostCandidates = [...hostCandidates].sort(comparator);
  let sortedExternalCandidates = [...externalCandidates].sort(comparator);
  
  // Re-order to prioritize constrained guests
  sortedHostCandidates = reorderByConstraints(sortedHostCandidates, constraintMap);
  sortedExternalCandidates = reorderByConstraints(sortedExternalCandidates, constraintMap);
  
  // Combine all candidates
  const allSortedCandidates = [...sortedHostCandidates, ...sortedExternalCandidates].sort((a, b) => {
    const ca = constraintMap.get(a.id)!;
    const cb = constraintMap.get(b.id)!;
    if (ca.priority !== cb.priority) return cb.priority - ca.priority;
    return comparator(a, b);
  });

  // Clear unlocked seats
  const currentTablesSnapshot = useSeatStore.getState().tables;
  for (const table of currentTablesSnapshot) {
    for (const seat of table.seats ?? []) {
      if (!seat.locked && seat.assignedGuestId) {
        seatStore.clearSeat(table.id, seat.id);
      }
    }
  }

  // Track globally assigned guests
  const globalAssignedSet = new Set<string>();
  lockedAssignedIds.forEach((id) => globalAssignedSet.add(id));

  // Phase 1: Strategic pre-seating for sit-together pairs
  const freshTables = useSeatStore.getState().tables;
  strategicPreSeatPairs(freshTables, allGuests, globalAssignedSet, proximityRules, constraintMap, seatStore);

  // Phase 2: Fill remaining seats - RESPECTS CUSTOM SEAT ORDERING
  const tablesAfterPreSeating = useSeatStore.getState().tables;
  const tablesWithOrder = tablesAfterPreSeating.map((t: any, idx: number) => {
    let tableOrder = typeof (t as any).tableNumber === "number" ? (t as any).tableNumber : undefined;
    if (tableOrder === undefined) {
      const parsed = parseInt(t.id, 10);
      tableOrder = !isNaN(parsed) ? parsed : idx;
    }
    return { table: t, tableOrder };
  });
  
  tablesWithOrder.sort((a, b) => a.tableOrder - b.tableOrder);

  for (const { table } of tablesWithOrder) {
    // CRITICAL FIX: Sort seats by seatNumber (which reflects custom ordering)
    // The seatNumber property contains the user's custom seat order
    const seats = (table.seats ?? [])
      .map((s: any) => ({ ...s }))
      .sort((a: any, b: any) => {
        // Sort by seatNumber directly - this respects custom ordering
        const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
        const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
        return aSeatNum - bSeatNum;
      });
    
    const unlockedSeats = seats.filter((s: any) => !s.locked);
    
    // Process seats in order: Seat 1, Seat 2, Seat 3, etc.
    for (const seat of unlockedSeats) {
      if (seat.assignedGuestId) continue;
      
      const guestToAssign = selectBestGuestForSeat(
        allSortedCandidates,
        globalAssignedSet,
        seat,
        seats,
        constraintMap,
        proximityRules,
        comparator
      );
      
      if (guestToAssign) {
        globalAssignedSet.add(guestToAssign.id);
        seatStore.assignGuestToSeat(table.id, seat.id, guestToAssign.id);
      }
    }
  }
  
  // Detect violations
  proximityViolations = detectViolations(proximityRules, guestStore);
}