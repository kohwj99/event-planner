// ============================================================================
// FIXED seatAutoFillHelper.tsx - With Table Rules Integration
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

export interface TableConfigViolation {
  type: 'ratio' | 'spacing';
  tableId: string;
  tableLabel: string;
  expected: string;
  actual: string;
  severity: 'minor' | 'major';
}

let proximityViolations: ProximityViolation[] = [];
let tableConfigViolations: TableConfigViolation[] = [];

export function getProximityViolations(): ProximityViolation[] {
  return proximityViolations;
}

export function getTableConfigViolations(): TableConfigViolation[] {
  return tableConfigViolations;
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
 * Check if a guest can be safely placed in a seat (sit-away check)
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
 * Get current table composition for table rules
 */
function getTableComposition(tableSeats: any[], guestLookup: Map<string, any>) {
  let hostCount = 0;
  let externalCount = 0;
  
  for (const seat of tableSeats) {
    if (!seat.assignedGuestId) continue;
    const guest = guestLookup.get(seat.assignedGuestId);
    if (!guest) continue;
    
    if (guest.fromHost) {
      hostCount++;
    } else {
      externalCount++;
    }
  }
  
  return { hostCount, externalCount, total: hostCount + externalCount };
}

/**
 * Check if adding a guest would significantly violate ratio rule
 */
function wouldViolateRatioRule(
  tableSeats: any[],
  guestIsHost: boolean,
  guestLookup: Map<string, any>,
  ratioRule: RatioRule
): boolean {
  if (!ratioRule.enabled) return false;
  
  const composition = getTableComposition(tableSeats, guestLookup);
  const newHostCount = guestIsHost ? composition.hostCount + 1 : composition.hostCount;
  const newExternalCount = guestIsHost ? composition.externalCount : composition.externalCount + 1;
  const newTotal = newHostCount + newExternalCount;
  
  if (newTotal === 0) return false;
  
  const expectedHostRatio = ratioRule.hostRatio / (ratioRule.hostRatio + ratioRule.externalRatio);
  const actualHostRatio = newHostCount / newTotal;
  
  // Use 30% tolerance for best effort
  const tolerance = 0.3;
  const deviation = Math.abs(actualHostRatio - expectedHostRatio);
  
  return deviation > tolerance;
}

/**
 * Check spacing rule - look at consecutive guests of same type
 */
function wouldViolateSpacingRule(
  seat: any,
  tableSeats: any[],
  guestIsHost: boolean,
  guestLookup: Map<string, any>,
  spacingRule: SpacingRule
): boolean {
  if (!spacingRule.enabled) return false;
  
  const seatIndex = tableSeats.findIndex(s => s.id === seat.id);
  if (seatIndex < 0) return false;
  
  // Look back at previous consecutive external guests
  let consecutiveExternal = 0;
  
  for (let i = seatIndex - 1; i >= 0; i--) {
    const prevSeat = tableSeats[i];
    if (!prevSeat.assignedGuestId) break;
    
    const prevGuest = guestLookup.get(prevSeat.assignedGuestId);
    if (!prevGuest) break;
    
    if (prevGuest.fromHost) {
      break;
    } else {
      consecutiveExternal++;
    }
  }
  
  // If we've had N consecutive external guests and trying to add another
  if (!guestIsHost && consecutiveExternal >= spacingRule.spacing) {
    return true;
  }
  
  return false;
}

/**
 * Score a guest for a seat based on table rules (lower = better)
 */
function scoreGuestForSeat(
  guest: any,
  seat: any,
  tableSeats: any[],
  guestLookup: Map<string, any>,
  tableRules?: TableRules
): number {
  if (!tableRules) return 0;
  
  let score = 0;
  const guestIsHost = guest.fromHost;
  
  if (tableRules.ratioRule.enabled) {
    if (wouldViolateRatioRule(tableSeats, guestIsHost, guestLookup, tableRules.ratioRule)) {
      score += 50; // Penalty for ratio violation
    }
  }
  
  if (tableRules.spacingRule.enabled) {
    if (wouldViolateSpacingRule(seat, tableSeats, guestIsHost, guestLookup, tableRules.spacingRule)) {
      score += 30; // Penalty for spacing violation
    }
  }
  
  return score;
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
 * Smart guest selection with table rules consideration
 */
function selectBestGuestForSeat(
  allCandidates: any[],
  assignedSet: Set<string>,
  nextSeat: any,
  allSeats: any[],
  constraintMap: Map<string, GuestConstraints>,
  proximityRules: ProximityRules,
  comparator: (a: any, b: any) => number,
  guestLookup: Map<string, any>,
  tableRules?: TableRules
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
  
  // PRIORITY 2: Find best available guest considering proximity AND table rules
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
  
  // Try to find best candidate considering both proximity and table rules
  let bestCandidate: any = null;
  let bestScore = Infinity;
  
  for (const candidate of sortedUnassigned) {
    const constraints = constraintMap.get(candidate.id);
    if (!constraints) continue;
    
    // Check sit-away (mandatory)
    const safetyCheck = canSafelyPlace(candidate.id, nextSeat, allSeats, constraints, proximityRules);
    if (!safetyCheck.safe) continue;
    
    // Score based on table rules (best effort)
    const tableScore = scoreGuestForSeat(candidate, nextSeat, allSeats, guestLookup, tableRules);
    
    if (tableScore < bestScore) {
      bestCandidate = candidate;
      bestScore = tableScore;
      
      // If we found a perfect fit, use it
      if (bestScore === 0) break;
    }
  }
  
  return bestCandidate;
}

/**
 * Detect violations after seating is complete
 */
function detectViolations(
  proximityRules: ProximityRules,
  tableRules: TableRules | undefined,
  guestStore: any,
  guestLookup: Map<string, any>
): void {
  const seatStore = useSeatStore.getState();
  
  proximityViolations = [];
  tableConfigViolations = [];
  
  // Detect proximity violations
  for (const table of seatStore.tables) {
    const seats = table.seats || [];
    
    for (const seat of seats) {
      if (!seat.assignedGuestId) continue;
      
      const guestId = seat.assignedGuestId;
      const guest = guestLookup.get(guestId);
      if (!guest) continue;
      
      const adjacentSeats = getAdjacentSeats(seat, seats);
      const adjacentGuestIds = adjacentSeats
        .map((s) => s.assignedGuestId)
        .filter(Boolean) as string[];
      
      // Check sit-together violations
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner) {
        const partner = guestLookup.get(togetherPartner);
        if (partner && !adjacentGuestIds.includes(togetherPartner)) {
          const partnerAssigned = seatStore.tables.some((t: any) =>
            t.seats.some((s: any) => s.assignedGuestId === togetherPartner)
          );
          
          if (partnerAssigned) {
            const alreadyReported = proximityViolations.some(
              (v) =>
                v.type === 'sit-together' &&
                ((v.guest1Id === guestId && v.guest2Id === togetherPartner) ||
                  (v.guest1Id === togetherPartner && v.guest2Id === guestId))
            );
            
            if (!alreadyReported) {
              proximityViolations.push({
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
          const adjGuest = guestLookup.get(adjGuestId);
          const adjSeat = seats.find((s: any) => s.assignedGuestId === adjGuestId);
          
          if (adjGuest && adjSeat) {
            const alreadyReported = proximityViolations.some(
              (v) =>
                v.type === 'sit-away' &&
                ((v.guest1Id === guestId && v.guest2Id === adjGuestId) ||
                  (v.guest1Id === adjGuestId && v.guest2Id === guestId))
            );
            
            if (!alreadyReported) {
              proximityViolations.push({
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
  
  // Detect table configuration violations
  if (!tableRules) return;
  
  for (const table of seatStore.tables) {
    const seats = table.seats || [];
    const composition = getTableComposition(seats, guestLookup);
    
    // Check ratio violations
    if (tableRules.ratioRule.enabled && composition.total > 0) {
      const expectedRatio = tableRules.ratioRule.hostRatio / 
        (tableRules.ratioRule.hostRatio + tableRules.ratioRule.externalRatio);
      const actualRatio = composition.hostCount / composition.total;
      
      const deviation = Math.abs(actualRatio - expectedRatio);
      const tolerance = 0.2;
      
      if (deviation > tolerance) {
        const severity = deviation > 0.4 ? 'major' : 'minor';
        
        tableConfigViolations.push({
          type: 'ratio',
          tableId: table.id,
          tableLabel: table.label,
          expected: `${Math.round(expectedRatio * 100)}% host guests`,
          actual: `${Math.round(actualRatio * 100)}% host (${composition.hostCount}H / ${composition.externalCount}E)`,
          severity,
        });
      }
    }
    
    // Check spacing violations
    if (tableRules.spacingRule.enabled) {
      const sortedSeats = [...seats].sort((a, b) => (a.seatNumber || 999) - (b.seatNumber || 999));
      
      let consecutiveExternal = 0;
      let maxConsecutiveExternal = 0;
      
      for (const seat of sortedSeats) {
        if (!seat.assignedGuestId) continue;
        
        const guest = guestLookup.get(seat.assignedGuestId);
        if (!guest) continue;
        
        if (guest.fromHost) {
          consecutiveExternal = 0;
        } else {
          consecutiveExternal++;
          maxConsecutiveExternal = Math.max(maxConsecutiveExternal, consecutiveExternal);
        }
      }
      
      if (maxConsecutiveExternal > tableRules.spacingRule.spacing) {
        const severity = maxConsecutiveExternal > tableRules.spacingRule.spacing * 2 ? 'major' : 'minor';
        
        tableConfigViolations.push({
          type: 'spacing',
          tableId: table.id,
          tableLabel: table.label,
          expected: `Max ${tableRules.spacingRule.spacing} consecutive external guests`,
          actual: `Found ${maxConsecutiveExternal} consecutive external guests`,
          severity,
        });
      }
    }
  }
}

/**
 * MAIN AUTOFILL FUNCTION - Respects custom seat ordering with table rules
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
  tableConfigViolations = [];

  // Collect candidates
  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];
  const allGuests = [...hostPool, ...externalPool];
  const guestLookup = new Map(allGuests.map(g => [g.id, g]));

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

  // Sort candidates SEPARATELY for each list
  const comparator = makeComparator(sortRules);
  let sortedHostCandidates = [...hostCandidates].sort(comparator);
  let sortedExternalCandidates = [...externalCandidates].sort(comparator);
  
  // Re-order to prioritize constrained guests within each list
  sortedHostCandidates = reorderByConstraints(sortedHostCandidates, constraintMap);
  sortedExternalCandidates = reorderByConstraints(sortedExternalCandidates, constraintMap);
  
  // Combine all candidates (maintaining constraint priority)
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
      const parsed = parseInt(t.label.match(/\d+/)?.[0] || '999');
      tableOrder = !isNaN(parsed) ? parsed : idx;
    }
    return { table: t, tableOrder };
  });
  
  tablesWithOrder.sort((a, b) => a.tableOrder - b.tableOrder);

  for (const { table } of tablesWithOrder) {
    // Sort seats by seatNumber (respects custom ordering)
    const seats = (table.seats ?? [])
      .map((s: any) => ({ ...s }))
      .sort((a: any, b: any) => {
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
        comparator,
        guestLookup,
        tableRules
      );
      
      if (guestToAssign) {
        globalAssignedSet.add(guestToAssign.id);
        seatStore.assignGuestToSeat(table.id, seat.id, guestToAssign.id);
      }
    }
  }
  
  // Detect violations
  detectViolations(proximityRules, tableRules, guestStore, guestLookup);
}