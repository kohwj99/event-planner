// /services/seatAutoFillHelper.ts
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
 * - Clears only unlocked seats (via clearSeat).
 * - Respects locked seats.
 * - Uses a single combined sorted guest list (so ranking/sortRules are global).
 * - Assigns guests sequentially in seat priority: tableOrder asc, seatOrder asc (table 1 seat 1 first).
 */
export async function autoFillSeats(options: AutoFillOptions = {}) {
  const {
    includeHost = true,
    includeExternal = true,
    sortRules = [{ field: "ranking", direction: "asc" }],
  } = options;

  const seatStore = useSeatStore.getState();
  const guestStore = useGuestStore.getState();

  if (!includeHost && !includeExternal) {
    console.warn("autoFillSeats: no guest lists selected; aborting.");
    return;
  }

  // --- Collect candidates from guestStore (exclude deleted) ---
  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];

  // --- Identify guests locked into seats (they must not be reassigned) ---
  const lockedAssignedIds = new Set<string>();
  seatStore.tables.forEach((t) =>
    (t.seats ?? []).forEach((s: any) => {
      if (s.locked && s.assignedGuestId) lockedAssignedIds.add(s.assignedGuestId);
    })
  );

  // --- Filter out guests already locked into seats ---
  const hostCandidates = hostPool.filter((g: any) => !lockedAssignedIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedAssignedIds.has(g.id));

  // --- Combine candidates into a single list, sort by comparator (global rules) ---
  const comparator = makeComparator(sortRules);
  const combinedCandidates = [...hostCandidates, ...externalCandidates].sort(comparator);

  // --- Build current seatEntries (tableOrder, seatOrder) from the store (use tableNumber, seatNumber when present) ---
  const currentTablesSnapshot = useSeatStore.getState().tables; // read fresh snapshot
  type SeatEntry = {
    tableId: string;
    seatId: string;
    locked: boolean;
    tableOrder: number;
    seatOrder: number;
  };

  const tablesWithOrder = currentTablesSnapshot.map((t: any, idx: number) => {
    let tableOrder = typeof (t as any).tableNumber === "number" ? (t as any).tableNumber : undefined;
    if (tableOrder === undefined) {
      const parsed = parseInt(t.id, 10);
      tableOrder = !isNaN(parsed) ? parsed : idx;
    }
    return { table: t, tableOrder };
  });

  tablesWithOrder.sort((a, b) => a.tableOrder - b.tableOrder);

  let seatEntries: SeatEntry[] = [];
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

  seatEntries.sort((a, b) => {
    if (a.tableOrder !== b.tableOrder) return a.tableOrder - b.tableOrder;
    return a.seatOrder - b.seatOrder;
  });

  // --- Clear unlocked seats (only) using existing clearSeat(tableId, seatId) ---
  // Use the up-to-date snapshot when checking assignedGuestId, so read fresh tables each time.
  for (const entry of seatEntries) {
    if (entry.locked) continue;
    const latestTables = useSeatStore.getState().tables;
    const t = latestTables.find((x) => x.id === entry.tableId);
    if (!t) continue;
    const s = (t.seats ?? []).find((x: any) => x.id === entry.seatId);
    if (!s) continue;
    if (s.assignedGuestId) {
      seatStore.clearSeat(entry.tableId, entry.seatId);
    }
  }

  // --- After clearing, rebuild seatEntries from up-to-date state so we don't use stale assignment info ---
  const freshTables = useSeatStore.getState().tables;
  const freshTablesWithOrder = freshTables.map((t: any, idx: number) => {
    let tableOrder = typeof (t as any).tableNumber === "number" ? (t as any).tableNumber : undefined;
    if (tableOrder === undefined) {
      const parsed = parseInt(t.id, 10);
      tableOrder = !isNaN(parsed) ? parsed : idx;
    }
    return { table: t, tableOrder };
  });
  freshTablesWithOrder.sort((a, b) => a.tableOrder - b.tableOrder);

  seatEntries = [];
  freshTablesWithOrder.forEach(({ table, tableOrder }) => {
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
  seatEntries.sort((a, b) => {
    if (a.tableOrder !== b.tableOrder) return a.tableOrder - b.tableOrder;
    return a.seatOrder - b.seatOrder;
  });

  // --- Assignment: iterate seats in priority and assign from combinedCandidates sequentially.
  // Ensure we don't reassign lockedAssignedIds (already excluded from candidates) and avoid duplicates via assignedSet.
  const assignedSet = new Set<string>();
  lockedAssignedIds.forEach((id) => assignedSet.add(id));

  let ci = 0; // candidate index
  for (const entry of seatEntries) {
    if (entry.locked) continue;
    // latest seat state check (defensive)
    const latestTables2 = useSeatStore.getState().tables;
    const tNow = latestTables2.find((x) => x.id === entry.tableId);
    if (!tNow) continue;
    const sNow = (tNow.seats ?? []).find((x: any) => x.id === entry.seatId);
    if (!sNow) continue;
    if (sNow.assignedGuestId) continue; // skip if some other process assigned it

    // find next available candidate not already assigned
    while (ci < combinedCandidates.length && assignedSet.has(combinedCandidates[ci].id)) {
      ci++;
    }
    if (ci >= combinedCandidates.length) break;

    const guest = combinedCandidates[ci];
    assignedSet.add(guest.id);
    seatStore.assignGuestToSeat(entry.tableId, entry.seatId, guest.id);
    ci++;
  }
}
