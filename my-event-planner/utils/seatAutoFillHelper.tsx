// /services/seatAutoFillHelper.ts
import { useSeatStore } from "@/store/seatStore";
import { useGuestStore, Guest } from "@/store/guestStore";
import { applyAutoFillRules, AutoFillRulesOptions } from "@/utils/rules";

export type SortField = "name" | "country" | "company" | "ranking";
export type SortDirection = "asc" | "desc";

export interface SortRule {
  field: SortField;
  direction: SortDirection;
}

export interface AutoFillOptions {
  includeHost?: boolean;
  includeExternal?: boolean;
  sortRules?: SortRule[];
  ruleOptions?: AutoFillRulesOptions;
}

function getGuestFieldValue(guest: Guest, field: SortField): string | number | undefined {
  if (!guest) return undefined;
  const value = guest[field as keyof Guest];
  if (typeof value === "string" || typeof value === "number") return value;
  return undefined;
}

function makeComparator(rules: SortRule[]) {
  return (a: Guest, b: Guest) => {
    for (const r of rules) {
      const { field, direction } = r;
      let av = getGuestFieldValue(a, field);
      let bv = getGuestFieldValue(b, field);

      if (av == null) av = "";
      if (bv == null) bv = "";

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
    return a.id.localeCompare(b.id);
  };
}

/**
 * Auto-fill seats respecting locked seats, seat order, and table rules.
 */
export async function autoFillSeats(options: AutoFillOptions = {}) {
  const {
    includeHost = true,
    includeExternal = true,
    sortRules = [{ field: "ranking", direction: "asc" }],
    ruleOptions,
  } = options;

  const seatStore = useSeatStore.getState();
  const guestStore = useGuestStore.getState();

  if (!includeHost && !includeExternal) return;

  // --- Locked guest IDs ---
  const lockedAssignedIds = new Set<string>();
  seatStore.tables.forEach((t) =>
    t.seats.forEach((s) => {
      if (s.locked && s.assignedGuestId) lockedAssignedIds.add(s.assignedGuestId);
    })
  );

  // --- Candidate pools ---
  const hostCandidates = includeHost
    ? guestStore.hostGuests.filter((g) => !g.deleted && !lockedAssignedIds.has(g.id))
    : [];
  const externalCandidates = includeExternal
    ? guestStore.externalGuests.filter((g) => !g.deleted && !lockedAssignedIds.has(g.id))
    : [];

  // --- Sort candidates globally ---
  const comparator = makeComparator(sortRules);
  const sortedHosts = [...hostCandidates].sort(comparator);
  const sortedExternals = [...externalCandidates].sort(comparator);

  // --- Combine hosts + externals sequentially ---
  const combinedCandidates: Guest[] = [...sortedHosts, ...sortedExternals];
  let candidateIndex = 0;

  // --- Build table guest matrix ---
  let tableGuestMatrix: Guest[][] = seatStore.tables.map((t) =>
    t.seats.map(() => {
      if (candidateIndex < combinedCandidates.length) {
        const guest = combinedCandidates[candidateIndex];
        candidateIndex++;
        return guest;
      }
      return combinedCandidates[combinedCandidates.length - 1]; // repeat last guest to satisfy type
    })
  );

  // --- Apply table-level rules ---
  tableGuestMatrix = applyAutoFillRules(tableGuestMatrix, ruleOptions);

  // --- Flatten for assignment ---
  const assignmentList: Guest[] = tableGuestMatrix.flat().filter(Boolean) as Guest[];

  // --- Build seat entries ---
  type SeatEntry = { tableId: string; seatId: string; locked: boolean; seatOrder: number };
  const seatEntries: SeatEntry[] = [];
  seatStore.tables.forEach((t) => {
    const sortedSeats = [...t.seats].sort((a, b) => a.seatNumber - b.seatNumber);
    sortedSeats.forEach((s) => {
      seatEntries.push({
        tableId: t.id,
        seatId: s.id,
        locked: !!s.locked,
        seatOrder: s.seatNumber,
      });
    });
  });

  // --- Clear unlocked seats ---
  seatEntries.forEach((entry) => {
    if (!entry.locked) seatStore.clearSeat(entry.tableId, entry.seatId);
  });

  // --- Assign guests sequentially ---
  const assignedSet = new Set<string>(lockedAssignedIds);
  let ci = 0;
  for (const entry of seatEntries) {
    if (entry.locked) continue;
    const table = seatStore.tables.find((t) => t.id === entry.tableId);
    const seat = table?.seats.find((s) => s.id === entry.seatId);
    if (!seat || seat.assignedGuestId) continue;

    while (ci < assignmentList.length && assignedSet.has(assignmentList[ci].id)) ci++;
    if (ci >= assignmentList.length) break;

    const guest = assignmentList[ci];
    assignedSet.add(guest.id);
    seatStore.assignGuestToSeat(entry.tableId, entry.seatId, guest.id);
    ci++;
  }
}
