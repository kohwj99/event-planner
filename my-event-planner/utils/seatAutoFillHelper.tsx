// /services/seatAutoFillService.ts
import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";

/**
 * SortField supports a user-facing 'organization' but guestStore uses 'company'.
 * We don't redefine guest types here — we operate on the guest objects returned by guestStore.
 */
export type SortField = "name" | "country" | "organization" | "ranking";
export type SortDirection = "asc" | "desc";

export interface SortRule {
  field: SortField;
  direction: SortDirection;
}

export interface AutoFillOptions {
  includeHost?: boolean;
  includeExternal?: boolean;
  sortRules?: SortRule[]; // ordered: first rule is highest priority
}

/** Helper: read nested field values and map organization->company */
function getGuestFieldValue(guest: any, field: SortField): string | number | undefined {
  if (!guest) return undefined;
  if (field === "organization") return (guest as any).company ?? (guest as any).organization ?? "";
  return (guest as any)[field];
}

/** Build comparator from ordered sort rules. ranking is numeric, others string (case-insensitive). */
function makeComparator(rules: SortRule[]) {
  return (a: any, b: any) => {
    for (const r of rules) {
      const { field, direction } = r;
      let av = getGuestFieldValue(a, field);
      let bv = getGuestFieldValue(b, field);

      // Normalize undefined/null
      if (av === undefined || av === null) av = "";
      if (bv === undefined || bv === null) bv = "";

      // numeric compare for ranking
      if (field === "ranking") {
        const na = Number(av) || 0;
        const nb = Number(bv) || 0;
        if (na < nb) return direction === "asc" ? -1 : 1;
        if (na > nb) return direction === "asc" ? 1 : -1;
        continue;
      }

      // string compare case-insensitive
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      if (sa < sb) return direction === "asc" ? -1 : 1;
      if (sa > sb) return direction === "asc" ? 1 : -1;
    }

    // final deterministic tie-breaker
    const ida = String((a && a.id) || "");
    const idb = String((b && b.id) || "");
    return ida.localeCompare(idb);
  };
}

/**
 * Autofill seats according to requested options.
 * - Does NOT create or assume new store actions beyond what you already have.
 * - Clears only unlocked seats (via clearSeat).
 * - Respects locked seats.
 * - Interleaves host and external lists if both included (host first).
 */
export async function autoFillSeats(options: AutoFillOptions = {}) {
  const {
    includeHost = true,
    includeExternal = true,
    sortRules = [{ field: "ranking", direction: "asc" }],
  } = options;

  const seatStore = useSeatStore.getState();
  const guestStore = useGuestStore.getState();

  // Validation
  if (!includeHost && !includeExternal) {
    console.warn("autoFillSeats: no guest lists selected; aborting.");
    return;
  }

  // Collect guest lists directly from guestStore (do not duplicate types)
  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];

  // Gather assigned guest ids that are on LOCKED seats to exclude them
  const lockedAssignedIds = new Set<string>();
  seatStore.tables.forEach((t) =>
    (t.seats ?? []).forEach((s: any) => {
      if (s.locked && s.assignedGuestId) lockedAssignedIds.add(s.assignedGuestId);
    })
  );

  // Filter out guests already 'locked' in seats (they should not be reassigned)
  const hostCandidates = hostPool.filter((g: any) => !lockedAssignedIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedAssignedIds.has(g.id));

  // Build comparators and sort each candidate list according to rules (rules apply within each list)
  const comparator = makeComparator(sortRules);
  hostCandidates.sort(comparator);
  externalCandidates.sort(comparator);

  // Build seat priority order:
  // - Table ordering: try table.tableNumber -> numeric parse of table.id -> fallback to store order index
  // - Seat ordering within table: seat.seatNumber -> numeric parse of seat.id -> index
  const tablesWithOrder = seatStore.tables.map((t: any, idx: number) => {
    let tableOrder = typeof (t as any).tableNumber === "number" ? (t as any).tableNumber : undefined;
    if (tableOrder === undefined) {
      const parsed = parseInt(t.id, 10);
      tableOrder = !isNaN(parsed) ? parsed : idx;
    }
    return { table: t, tableOrder };
  });

  tablesWithOrder.sort((a, b) => a.tableOrder - b.tableOrder);

  type SeatEntry = {
    tableId: string;
    seatId: string;
    locked: boolean;
    tableOrder: number;
    seatOrder: number;
  };

  const seatEntries: SeatEntry[] = [];

  tablesWithOrder.forEach(({ table, tableOrder }) => {
    (table.seats ?? []).forEach((s: any, sidx: number) => {
      let seatOrder = typeof s.seatNumber === "number" ? s.seatNumber : undefined;
      if (seatOrder === undefined) {
        const parsed = parseInt(s.id, 10);
        seatOrder = !isNaN(parsed) ? parsed : sidx + 1;
      }
      seatEntries.push({
        tableId: table.id,
        seatId: s.id,
        locked: !!s.locked,
        tableOrder,
        seatOrder,
      });
    });
  });

  // Sort global seatEntries by tableOrder then seatOrder
  seatEntries.sort((a, b) => {
    if (a.tableOrder !== b.tableOrder) return a.tableOrder - b.tableOrder;
    return a.seatOrder - b.seatOrder;
  });

  // Clear unlocked seats first using existing store action clearSeat(tableId, seatId)
  for (const entry of seatEntries) {
    if (!entry.locked) {
      // if seat currently has assignment, clear it
      const table = seatStore.tables.find((t) => t.id === entry.tableId);
      if (!table) continue;
      const seat = (table.seats ?? []).find((s: any) => s.id === entry.seatId);
      if (!seat) continue;
      if (seat.assignedGuestId) {
        seatStore.clearSeat(entry.tableId, entry.seatId);
      }
    }
  }

  // Remove any candidates who were previously assigned to unlocked seats that we just cleared:
  // (they were not in lockedAssignedIds, so cleared, and remain available — that's desired)
  // Build assignment loop
  const assignedSet = new Set<string>(); // track who we've assigned now (and include lockedAssignedIds to avoid duplicates)
  lockedAssignedIds.forEach((id) => assignedSet.add(id));

  // iterators
  let hi = 0;
  let ei = 0;

  const hostLen = hostCandidates.length;
  const extLen = externalCandidates.length;

  // Interleaving: host first then external, alternating. If one list exhausted, continue with other.
  const hostIncluded = includeHost && hostLen > 0;
  const externalIncluded = includeExternal && extLen > 0;

  let nextIsHost = true; // host starts

  const tryGetNextFromHost = () => {
    while (hi < hostCandidates.length && assignedSet.has(hostCandidates[hi].id)) hi++;
    if (hi < hostCandidates.length) {
      const id = hostCandidates[hi].id;
      hi++;
      return id;
    }
    return null;
  };

  const tryGetNextFromExternal = () => {
    while (ei < externalCandidates.length && assignedSet.has(externalCandidates[ei].id)) ei++;
    if (ei < externalCandidates.length) {
      const id = externalCandidates[ei].id;
      ei++;
      return id;
    }
    return null;
  };

  for (const entry of seatEntries) {
    if (entry.locked) continue;

    // If seat currently assigned (possible if not cleared due to logic), skip
    const tableNow = seatStore.tables.find((t) => t.id === entry.tableId);
    if (!tableNow) continue;
    const seatNow = (tableNow.seats ?? []).find((s: any) => s.id === entry.seatId);
    if (!seatNow) continue;
    if (seatNow.assignedGuestId) continue; // skip already (locked) or other assignment

    let chosenGuestId: string | null = null;

    if (hostIncluded && externalIncluded) {
      // alternating mode
      if (nextIsHost) {
        chosenGuestId = tryGetNextFromHost();
        if (!chosenGuestId) {
          // host exhausted -> try external
          chosenGuestId = tryGetNextFromExternal();
          if (!chosenGuestId) break; // no more guests
        }
      } else {
        chosenGuestId = tryGetNextFromExternal();
        if (!chosenGuestId) {
          chosenGuestId = tryGetNextFromHost();
          if (!chosenGuestId) break;
        }
      }
      // flip for next seat (always flip so pattern alternates)
      nextIsHost = !nextIsHost;
    } else if (hostIncluded) {
      chosenGuestId = tryGetNextFromHost();
      if (!chosenGuestId) break;
    } else if (externalIncluded) {
      chosenGuestId = tryGetNextFromExternal();
      if (!chosenGuestId) break;
    }

    if (chosenGuestId) {
      // double-check not assigned already (shouldn't happen, but defensive)
      if (assignedSet.has(chosenGuestId)) continue;
      assignedSet.add(chosenGuestId);
      seatStore.assignGuestToSeat(entry.tableId, entry.seatId, chosenGuestId);
    }
  }
}
