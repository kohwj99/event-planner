// ============================================================================
// WEIGHTED SCORING seatAutoFillHelper.tsx - Hierarchical Rule System
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

// Rule hierarchy weights (higher = more important)
const RULE_WEIGHTS = {
  LOCKED_SEAT: 10000,      // Cannot violate
  SORTING_ORDER: 1000,     // Strong preference
  SIT_TOGETHER: 500,       // Important social rule
  SIT_AWAY: 400,           // Important social rule
  TABLE_RATIO: 50,         // Moderate preference
  TABLE_SPACING: 40,       // Moderate preference
};

let proximityViolations: ProximityViolation[] = [];

export function getProximityViolations(): ProximityViolation[] {
  return proximityViolations;
}

// ============================================================================
// SEATING UNIT - Represents single guest or sit-together pair
// ============================================================================

interface SeatingUnit {
  type: 'single' | 'pair';
  primary: any;
  secondary?: any;
  guests: any[]; // All guests in this unit
}

// ============================================================================
// PLACEMENT CONTEXT - Information about where we're placing
// ============================================================================

interface PlacementContext {
  tableId: string;
  seats: any[];
  seatIndex: number;
  assignedGuestsInTable: Set<string>;
  totalAssignedGuests: Set<string>;
  hostCount: number;
  externalCount: number;
  totalSeats: number;
  lastAssignedWasHost: boolean | null;
  consecutiveExternalCount: number;
}

// ============================================================================
// SCORING SYSTEM
// ============================================================================

interface PlacementScore {
  total: number;
  breakdown: {
    sortingOrder: number;
    sitTogether: number;
    sitAway: number;
    tableRatio: number;
    tableSpacing: number;
  };
  canPlace: boolean;
  reason?: string;
}

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

    const ida = String((a && a.id) || "");
    const idb = String((b && b.id) || "");
    return ida.localeCompare(idb);
  };
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

function getAdjacentSeats(seat: any, allSeats: any[]): any[] {
  if (!seat.adjacentSeats || seat.adjacentSeats.length === 0) return [];
  return seat.adjacentSeats
    .map((adjId: string) => allSeats.find((s: any) => s.id === adjId))
    .filter(Boolean);
}

// ============================================================================
// CREATE SEATING UNITS
// ============================================================================

function createSeatingUnits(
  guests: any[],
  proximityRules: ProximityRules
): SeatingUnit[] {
  const units: SeatingUnit[] = [];
  const processedGuests = new Set<string>();

  for (const guest of guests) {
    if (processedGuests.has(guest.id)) continue;

    const partnerId = getSitTogetherPartner(guest.id, proximityRules.sitTogether);

    if (partnerId) {
      const partner = guests.find((g: any) => g.id === partnerId);
      if (partner && !processedGuests.has(partnerId)) {
        units.push({
          type: 'pair',
          primary: guest,
          secondary: partner,
          guests: [guest, partner],
        });

        processedGuests.add(guest.id);
        processedGuests.add(partnerId);
        continue;
      }
    }

    units.push({
      type: 'single',
      primary: guest,
      guests: [guest],
    });

    processedGuests.add(guest.id);
  }

  return units;
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Score how well this unit fits the sorting order expectation
 */
function scoreSortingOrder(
  unit: SeatingUnit,
  expectedGuest: any,
  comparator: (a: any, b: any) => number
): number {
  if (!expectedGuest) return 0;

  // Compare primary guest with expected guest
  const comparison = comparator(unit.primary, expectedGuest);

  // Perfect match
  if (comparison === 0) return RULE_WEIGHTS.SORTING_ORDER;

  // Close match (within reasonable range)
  const distance = Math.abs(comparison);
  if (distance <= 5) return RULE_WEIGHTS.SORTING_ORDER * 0.8;
  if (distance <= 10) return RULE_WEIGHTS.SORTING_ORDER * 0.5;

  return RULE_WEIGHTS.SORTING_ORDER * 0.2;
}

/**
 * Score sit-together compliance
 */
function scoreSitTogether(
  unit: SeatingUnit,
  context: PlacementContext,
  proximityRules: ProximityRules
): number {
  if (unit.type === 'single') {
    // Check if this guest has a partner already seated nearby
    const partnerId = getSitTogetherPartner(unit.primary.id, proximityRules.sitTogether);
    if (partnerId && context.assignedGuestsInTable.has(partnerId)) {
      const seat = context.seats[context.seatIndex];
      const adjacentSeats = getAdjacentSeats(seat, context.seats);
      const isAdjacentToPartner = adjacentSeats.some((s: any) => s.assignedGuestId === partnerId);

      if (isAdjacentToPartner) {
        return RULE_WEIGHTS.SIT_TOGETHER; // Excellent - completing the pair
      } else {
        return -RULE_WEIGHTS.SIT_TOGETHER; // Bad - separating them further
      }
    }
    return 0; // Neutral - no partner considerations
  } else {
    // Pair unit - check if we can place them adjacent
    const seat = context.seats[context.seatIndex];
    const adjacentSeats = getAdjacentSeats(seat, context.seats);
    const hasEmptyAdjacent = adjacentSeats.some((s: any) => !s.assignedGuestId && !s.locked);

    if (hasEmptyAdjacent) {
      return RULE_WEIGHTS.SIT_TOGETHER; // Can place pair together
    } else {
      return -RULE_WEIGHTS.SIT_TOGETHER * 2; // Cannot place pair - severe penalty
    }
  }
}

/**
 * Score sit-away compliance
 */
function scoreSitAway(
  unit: SeatingUnit,
  context: PlacementContext,
  proximityRules: ProximityRules
): number {
  const seat = context.seats[context.seatIndex];
  const adjacentSeats = getAdjacentSeats(seat, context.seats);

  let violations = 0;

  for (const guest of unit.guests) {
    const awayGuests = getSitAwayGuests(guest.id, proximityRules.sitAway);

    for (const adjSeat of adjacentSeats) {
      if (adjSeat.assignedGuestId && awayGuests.includes(adjSeat.assignedGuestId)) {
        violations++;
      }
    }
  }

  if (violations > 0) {
    return -RULE_WEIGHTS.SIT_AWAY * violations * 10; // Severe penalty - MUST NOT violate
  }

  return RULE_WEIGHTS.SIT_AWAY * 0.1; // Small bonus for not violating
}

/**
 * Score table ratio compliance
 */
function scoreTableRatio(
  unit: SeatingUnit,
  context: PlacementContext,
  tableRules?: TableRules
): number {
  if (!tableRules?.ratioRule?.enabled) return 0;

  const { hostRatio, externalRatio } = tableRules.ratioRule;
  const totalRatio = hostRatio + externalRatio;
  if (totalRatio === 0) return 0;

  const targetHostRatio = hostRatio / totalRatio;
  const currentHostRatio = context.totalSeats > 0
    ? context.hostCount / context.totalSeats
    : 0;

  const isHost = unit.primary.fromHost;

  if (isHost && currentHostRatio < targetHostRatio) {
    return RULE_WEIGHTS.TABLE_RATIO; // Helps achieve target ratio
  } else if (!isHost && currentHostRatio > targetHostRatio) {
    return RULE_WEIGHTS.TABLE_RATIO; // Helps achieve target ratio
  } else if (Math.abs(currentHostRatio - targetHostRatio) < 0.1) {
    return RULE_WEIGHTS.TABLE_RATIO * 0.5; // Close to target
  }

  return -RULE_WEIGHTS.TABLE_RATIO * 0.5; // Moves away from target
}

/**
 * Score table spacing compliance
 */
function scoreTableSpacing(
  unit: SeatingUnit,
  context: PlacementContext,
  tableRules?: TableRules
): number {
  if (!tableRules?.spacingRule?.enabled) return 0;

  const { spacing, startWithExternal } = tableRules.spacingRule;
  const isHost = unit.primary.fromHost;

  // First seat
  if (context.lastAssignedWasHost === null) {
    if ((startWithExternal && !isHost) || (!startWithExternal && isHost)) {
      return RULE_WEIGHTS.TABLE_SPACING; // Correct starting guest
    }
    return -RULE_WEIGHTS.TABLE_SPACING * 0.3;
  }

  // Subsequent seats
  if (context.lastAssignedWasHost) {
    // Last was host, should place external
    if (!isHost) {
      return RULE_WEIGHTS.TABLE_SPACING;
    }
    return -RULE_WEIGHTS.TABLE_SPACING * 0.5;
  } else {
    // Last was external
    if (context.consecutiveExternalCount >= spacing) {
      // Should place host now
      if (isHost) {
        return RULE_WEIGHTS.TABLE_SPACING;
      }
      return -RULE_WEIGHTS.TABLE_SPACING * 0.5;
    } else {
      // Can continue with external
      if (!isHost) {
        return RULE_WEIGHTS.TABLE_SPACING * 0.5;
      }
      return -RULE_WEIGHTS.TABLE_SPACING * 0.3;
    }
  }
}

/**
 * Calculate total weighted score for placing a unit at current position
 */
function calculatePlacementScore(
  unit: SeatingUnit,
  context: PlacementContext,
  expectedGuest: any,
  comparator: (a: any, b: any) => number,
  options: AutoFillOptions
): PlacementScore {
  const seat = context.seats[context.seatIndex];

  // Check absolute constraints
  if (seat.locked || seat.assignedGuestId) {
    return {
      total: -Infinity,
      breakdown: { sortingOrder: 0, sitTogether: 0, sitAway: 0, tableRatio: 0, tableSpacing: 0 },
      canPlace: false,
      reason: "Seat is locked or occupied",
    };
  }

  // Check if all guests in unit are already assigned
  const alreadyAssigned = unit.guests.some((g: any) => context.totalAssignedGuests.has(g.id));
  if (alreadyAssigned) {
    return {
      total: -Infinity,
      breakdown: { sortingOrder: 0, sitTogether: 0, sitAway: 0, tableRatio: 0, tableSpacing: 0 },
      canPlace: false,
      reason: "Guest already assigned",
    };
  }

  // Calculate individual scores
  const sortingScore = scoreSortingOrder(unit, expectedGuest, comparator);
  const sitTogetherScore = scoreSitTogether(unit, context, options.proximityRules || { sitTogether: [], sitAway: [] });
  const sitAwayScore = scoreSitAway(unit, context, options.proximityRules || { sitTogether: [], sitAway: [] });
  const ratioScore = scoreTableRatio(unit, context, options.tableRules);
  const spacingScore = scoreTableSpacing(unit, context, options.tableRules);

  // Sit-away violations are absolute - cannot place
  if (sitAwayScore < -RULE_WEIGHTS.SIT_AWAY) {
    return {
      total: -Infinity,
      breakdown: {
        sortingOrder: sortingScore,
        sitTogether: sitTogetherScore,
        sitAway: sitAwayScore,
        tableRatio: ratioScore,
        tableSpacing: spacingScore,
      }, canPlace: false,
      reason: "Sit-away violation",
    };
  }

  // Sit-together pair that can't be placed together
  if (unit.type === 'pair' && sitTogetherScore < -RULE_WEIGHTS.SIT_TOGETHER) {
    return {
      total: -Infinity,
      breakdown: {
        sortingOrder: sortingScore,
        sitTogether: sitTogetherScore,
        sitAway: sitAwayScore,
        tableRatio: ratioScore,
        tableSpacing: spacingScore,
      }, canPlace: false,
      reason: "Cannot place pair together",
    };
  }

  const total = sortingScore + sitTogetherScore + sitAwayScore + ratioScore + spacingScore;

  return {
    total,
    breakdown: {
      sortingOrder: sortingScore,
      sitTogether: sitTogetherScore,
      sitAway: sitAwayScore,
      tableRatio: ratioScore,
      tableSpacing: spacingScore,
    },
    canPlace: true,
  };
}

// ============================================================================
// PLACEMENT LOGIC
// ============================================================================

function placeUnit(
  unit: SeatingUnit,
  context: PlacementContext,
  seatStore: any
): boolean {
  const seat = context.seats[context.seatIndex];

  if (unit.type === 'single') {
    seatStore.assignGuestToSeat(context.tableId, seat.id, unit.primary.id);
    context.totalAssignedGuests.add(unit.primary.id);
    context.assignedGuestsInTable.add(unit.primary.id);

    if (unit.primary.fromHost) {
      context.hostCount++;
      context.lastAssignedWasHost = true;
      context.consecutiveExternalCount = 0;
    } else {
      context.externalCount++;
      context.lastAssignedWasHost = false;
      context.consecutiveExternalCount++;
    }

    return true;
  } else {
    // Place pair
    const adjacentSeats = getAdjacentSeats(seat, context.seats);
    const emptyAdjacent = adjacentSeats.find((s: any) => !s.assignedGuestId && !s.locked);

    if (!emptyAdjacent) return false;

    seatStore.assignGuestToSeat(context.tableId, seat.id, unit.primary.id);
    seatStore.assignGuestToSeat(context.tableId, emptyAdjacent.id, unit.secondary!.id);

    context.totalAssignedGuests.add(unit.primary.id);
    context.totalAssignedGuests.add(unit.secondary!.id);
    context.assignedGuestsInTable.add(unit.primary.id);
    context.assignedGuestsInTable.add(unit.secondary!.id);

    // Update counts
    [unit.primary, unit.secondary].forEach((g: any) => {
      if (g.fromHost) {
        context.hostCount++;
      } else {
        context.externalCount++;
      }
    });

    context.lastAssignedWasHost = unit.secondary!.fromHost;
    context.consecutiveExternalCount = unit.secondary!.fromHost ? 0 : context.consecutiveExternalCount + 2;

    return true;
  }
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
        .map((s: any) => s.assignedGuestId)
        .filter(Boolean) as string[];

      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner) {
        const partner = guestLookup[togetherPartner];
        if (partner && !adjacentGuestIds.includes(togetherPartner)) {
          const partnerAssigned = seatStore.tables.some((t: any) =>
            t.seats.some((s: any) => s.assignedGuestId === togetherPartner)
          );

          if (partnerAssigned) {
            const alreadyReported = violations.some(
              (v: any) =>
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

      for (const adjGuestId of adjacentGuestIds) {
        if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
          const adjGuest = guestLookup[adjGuestId];
          const adjSeat = seats.find((s: any) => s.assignedGuestId === adjGuestId);

          if (adjGuest && adjSeat) {
            const alreadyReported = violations.some(
              (v: any) =>
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
    console.warn("autoFillSeats: no guest lists selected");
    return;
  }

  proximityViolations = [];

  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];

  const lockedAssignedIds = new Set<string>();
  seatStore.tables.forEach((t: any) =>
    (t.seats ?? []).forEach((s: any) => {
      if (s.locked && s.assignedGuestId) lockedAssignedIds.add(s.assignedGuestId);
    })
  );

  const hostCandidates = hostPool.filter((g: any) => !lockedAssignedIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedAssignedIds.has(g.id));

  const comparator = makeComparator(sortRules);

  // Clear unlocked seats
  for (const table of seatStore.tables) {
    for (const seat of table.seats ?? []) {
      if (!seat.locked && seat.assignedGuestId) {
        seatStore.clearSeat(table.id, seat.id);
      }
    }
  }

  // Create seating units
  const hostUnits = createSeatingUnits(hostCandidates, proximityRules);
  const externalUnits = createSeatingUnits(externalCandidates, proximityRules);
  const allUnits = [...hostUnits, ...externalUnits].sort((a, b) => comparator(a.primary, b.primary));

  // Sort guests for expected order
  const allSortedGuests = [...hostCandidates, ...externalCandidates].sort(comparator);

  // Build tables
  const tables = seatStore.tables.map((t: any, idx: number) => {
    let tableOrder = typeof (t as any).tableNumber === "number" ? (t as any).tableNumber : undefined;
    if (tableOrder === undefined) {
      const parsed = parseInt(t.id, 10);
      tableOrder = !isNaN(parsed) ? parsed : idx;
    }
    return { table: t, tableOrder };
  }).sort((a: any, b: any) => a.tableOrder - b.tableOrder);

  const globalAssignedGuests = new Set<string>();
  lockedAssignedIds.forEach((id) => globalAssignedGuests.add(id));

  let expectedGuestIndex = 0;

  // Fill each table
  for (const { table } of tables) {
    const seats = (table.seats ?? [])
      .map((s: any) => ({ ...s }))
      .sort((a: any, b: any) => {
        const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
        const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
        return aSeatNum - bSeatNum;
      });

    const context: PlacementContext = {
      tableId: table.id,
      seats,
      seatIndex: 0,
      assignedGuestsInTable: new Set(),
      totalAssignedGuests: globalAssignedGuests,
      hostCount: 0,
      externalCount: 0,
      totalSeats: seats.filter((s: any) => !s.locked).length,
      lastAssignedWasHost: null,
      consecutiveExternalCount: 0,
    };

    for (let seatIdx = 0; seatIdx < seats.length; seatIdx++) {
      const seat = seats[seatIdx];
      if (seat.locked || seat.assignedGuestId) continue;

      context.seatIndex = seatIdx;

      // Find best unit for this seat
      let bestUnit: SeatingUnit | null = null;
      let bestScore = -Infinity;

      const expectedGuest = expectedGuestIndex < allSortedGuests.length
        ? allSortedGuests[expectedGuestIndex]
        : null;

      for (const unit of allUnits) {
        const score = calculatePlacementScore(unit, context, expectedGuest, comparator, options);

        if (score.canPlace && score.total > bestScore) {
          bestScore = score.total;
          bestUnit = unit;
        }
      }

      if (bestUnit) {
        placeUnit(bestUnit, context, seatStore);
        expectedGuestIndex++;
      }
    }
  }

  proximityViolations = detectViolations(proximityRules, guestStore);
}