// /services/seatAutoFillHelper.ts
import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";

export type SortField = "name" | "country" | "organization" | "ranking";
export type SortDirection = "asc" | "desc";

export interface SortRule {
  field: SortField;
  direction: SortDirection;
}

// --- Table Rules ---
export interface RatioRule {
  enabled: boolean;
  hostRatio: number;    // e.g., 20
  externalRatio: number; // e.g., 80
}

export interface SpacingRule {
  enabled: boolean;
  spacing: number; // e.g., 1 = host, external, host, external...
  startWithExternal: boolean; // NEW: option to start with external instead of host
}

export interface TableRules {
  ratioRule: RatioRule;
  spacingRule: SpacingRule;
}

export interface AutoFillOptions {
  includeHost?: boolean;
  includeExternal?: boolean;
  sortRules?: SortRule[];
  tableRules?: TableRules;
}

/** Helper: read nested field values and map organization->company */
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

/** 
 * Calculate target counts for host and external guests per table based on ratio rule
 */
function calculateRatioCounts(
  totalSeats: number,
  hostRatio: number,
  externalRatio: number
): { hostTarget: number; externalTarget: number } {
  const totalRatio = hostRatio + externalRatio;
  if (totalRatio === 0) {
    return { hostTarget: 0, externalTarget: 0 };
  }
  
  const hostTarget = Math.round((totalSeats * hostRatio) / totalRatio);
  const externalTarget = totalSeats - hostTarget;
  
  return { hostTarget, externalTarget };
}

/**
 * Helper to find next available guest from a candidate list
 */
function findNextAvailableGuest(
  candidates: any[],
  startIndex: number,
  assignedSet: Set<string>
): any | null {
  for (let i = startIndex; i < candidates.length; i++) {
    if (!assignedSet.has(candidates[i].id)) {
      return candidates[i];
    }
  }
  return null;
}

/**
 * Autofill seats with COMBINED table rules support
 * Both Ratio and Spacing rules can work together
 */
export async function autoFillSeats(options: AutoFillOptions = {}) {
  const {
    includeHost = true,
    includeExternal = true,
    sortRules = [{ field: "ranking", direction: "asc" }],
    tableRules,
  } = options;

  const seatStore = useSeatStore.getState();
  const guestStore = useGuestStore.getState();

  if (!includeHost && !includeExternal) {
    console.warn("autoFillSeats: no guest lists selected; aborting.");
    return;
  }

  // --- Collect candidates from guestStore ---
  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];

  // --- Identify guests locked into seats ---
  const lockedAssignedIds = new Set<string>();
  seatStore.tables.forEach((t) =>
    (t.seats ?? []).forEach((s: any) => {
      if (s.locked && s.assignedGuestId) lockedAssignedIds.add(s.assignedGuestId);
    })
  );

  // --- Filter out locked guests ---
  const hostCandidates = hostPool.filter((g: any) => !lockedAssignedIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedAssignedIds.has(g.id));

  // --- Sort candidates separately (maintaining host/external distinction) ---
  const comparator = makeComparator(sortRules);
  const sortedHostCandidates = [...hostCandidates].sort(comparator);
  const sortedExternalCandidates = [...externalCandidates].sort(comparator);

  // --- Clear unlocked seats ---
  const currentTablesSnapshot = useSeatStore.getState().tables;
  
  for (const table of currentTablesSnapshot) {
    for (const seat of table.seats ?? []) {
      if (!seat.locked && seat.assignedGuestId) {
        seatStore.clearSeat(table.id, seat.id);
      }
    }
  }

  // --- Build table structure with priority ordering ---
  const freshTables = useSeatStore.getState().tables;
  const tablesWithOrder = freshTables.map((t: any, idx: number) => {
    let tableOrder = typeof (t as any).tableNumber === "number" ? (t as any).tableNumber : undefined;
    if (tableOrder === undefined) {
      const parsed = parseInt(t.id, 10);
      tableOrder = !isNaN(parsed) ? parsed : idx;
    }
    return { table: t, tableOrder };
  });
  
  tablesWithOrder.sort((a, b) => a.tableOrder - b.tableOrder);

  // --- Track assigned guests globally ---
  const globalAssignedSet = new Set<string>();
  lockedAssignedIds.forEach((id) => globalAssignedSet.add(id));

  // --- Assign guests table by table ---
  let globalHostIndex = 0;
  let globalExternalIndex = 0;

  for (const { table } of tablesWithOrder) {
    type SeatWithOrder = {
      id: string;
      locked?: boolean;
      assignedGuestId?: string | null;
      seatOrder: number;
      [key: string]: any;
    };

    const seats: SeatWithOrder[] = (table.seats ?? []).map((s: any, sidx: number) => {
      let seatOrder = typeof s.seatNumber === "number" ? s.seatNumber : undefined;
      if (seatOrder === undefined) {
        const parsed = parseInt(s.id, 10);
        seatOrder = !isNaN(parsed) ? parsed : sidx + 1;
      }
      return { ...s, seatOrder };
    });
    
    // Sort seats within this table
    seats.sort((a: SeatWithOrder, b: SeatWithOrder) => a.seatOrder - b.seatOrder);
    
    // Get unlocked seats for this table
    const unlockedSeats = seats.filter((s: SeatWithOrder) => !s.locked);
    const totalSeatsInTable = unlockedSeats.length;
    
    if (totalSeatsInTable === 0) continue;

    // --- Determine which rules are active ---
    const useRatioRule = tableRules?.ratioRule?.enabled;
    const useSpacingRule = tableRules?.spacingRule?.enabled;

    // --- COMBINED RULES MODE: Both Ratio and Spacing ---
    if (useRatioRule && useSpacingRule) {
      const { hostRatio, externalRatio } = tableRules!.ratioRule;
      const { spacing, startWithExternal } = tableRules!.spacingRule;
      
      // Calculate targets from ratio rule
      const { hostTarget, externalTarget } = calculateRatioCounts(
        totalSeatsInTable,
        hostRatio,
        externalRatio
      );

      let hostAssigned = 0;
      let externalAssigned = 0;
      let nextIsHost = !startWithExternal; // Start based on config
      let consecutiveCounter = 0; // Count consecutive guests of current type

      for (const seat of unlockedSeats) {
        let guestToAssign: any = null;
        
        // Check if we've exceeded ratio targets
        const hostLimitReached = hostAssigned >= hostTarget;
        const externalLimitReached = externalAssigned >= externalTarget;

        // Determine what type of guest to assign next
        if (nextIsHost) {
          // Try to assign host
          if (!hostLimitReached) {
            guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
            if (guestToAssign) {
              globalHostIndex++;
              hostAssigned++;
              consecutiveCounter = 0; // Reset counter
              nextIsHost = false; // Switch to external for next spacing guests
            } else {
              // No host available, try external
              if (!externalLimitReached) {
                guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
                if (guestToAssign) {
                  globalExternalIndex++;
                  externalAssigned++;
                  consecutiveCounter++;
                }
              }
            }
          } else {
            // Host limit reached, must use external
            if (!externalLimitReached) {
              guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
              if (guestToAssign) {
                globalExternalIndex++;
                externalAssigned++;
                consecutiveCounter++;
              }
            }
          }
        } else {
          // Try to assign external
          if (!externalLimitReached) {
            guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
            if (guestToAssign) {
              globalExternalIndex++;
              externalAssigned++;
              consecutiveCounter++;
              
              // Check if we've assigned 'spacing' number of external guests
              if (consecutiveCounter >= spacing) {
                nextIsHost = true; // Switch back to host
                consecutiveCounter = 0;
              }
            } else {
              // No external available, try host
              if (!hostLimitReached) {
                guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
                if (guestToAssign) {
                  globalHostIndex++;
                  hostAssigned++;
                  nextIsHost = false;
                  consecutiveCounter = 0;
                }
              }
            }
          } else {
            // External limit reached, must use host
            if (!hostLimitReached) {
              guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
              if (guestToAssign) {
                globalHostIndex++;
                hostAssigned++;
                nextIsHost = false;
                consecutiveCounter = 0;
              }
            }
          }
        }

        if (guestToAssign) {
          globalAssignedSet.add(guestToAssign.id);
          seatStore.assignGuestToSeat(table.id, seat.id, guestToAssign.id);
        }
      }

    } else if (useSpacingRule) {
      // --- SPACING RULE ONLY ---
      const { spacing, startWithExternal } = tableRules!.spacingRule;
      
      let hostAssigned = 0;
      let externalAssigned = 0;
      let nextIsHost = !startWithExternal;
      let consecutiveCounter = 0;

      for (const seat of unlockedSeats) {
        let guestToAssign: any = null;

        if (nextIsHost) {
          // Try to assign a host guest
          guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
          if (guestToAssign) {
            globalHostIndex++;
            hostAssigned++;
            consecutiveCounter = 0;
            nextIsHost = false;
          } else {
            // No more host guests, fall back to external
            guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
            if (guestToAssign) {
              globalExternalIndex++;
              externalAssigned++;
              consecutiveCounter++;
            }
          }
        } else {
          // Assign external guest
          guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
          if (guestToAssign) {
            globalExternalIndex++;
            externalAssigned++;
            consecutiveCounter++;
            
            // Check if we've assigned 'spacing' number of guests
            if (consecutiveCounter >= spacing) {
              nextIsHost = true;
              consecutiveCounter = 0;
            }
          } else {
            // No more external guests, fall back to host
            guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
            if (guestToAssign) {
              globalHostIndex++;
              hostAssigned++;
              nextIsHost = false;
              consecutiveCounter = 0;
            }
          }
        }

        if (guestToAssign) {
          globalAssignedSet.add(guestToAssign.id);
          seatStore.assignGuestToSeat(table.id, seat.id, guestToAssign.id);
        }
      }

    } else if (useRatioRule) {
      // --- RATIO RULE ONLY ---
      const { hostRatio, externalRatio } = tableRules!.ratioRule;
      const { hostTarget, externalTarget } = calculateRatioCounts(
        totalSeatsInTable,
        hostRatio,
        externalRatio
      );

      let hostAssigned = 0;
      let externalAssigned = 0;

      for (const seat of unlockedSeats) {
        let guestToAssign: any = null;
        
        const needsMoreHost = hostAssigned < hostTarget;
        const needsMoreExternal = externalAssigned < externalTarget;
        
        if (needsMoreHost && !needsMoreExternal) {
          // Only need host
          guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
          if (guestToAssign) {
            globalHostIndex++;
            hostAssigned++;
          }
        } else if (needsMoreExternal && !needsMoreHost) {
          // Only need external
          guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
          if (guestToAssign) {
            globalExternalIndex++;
            externalAssigned++;
          }
        } else if (needsMoreHost && needsMoreExternal) {
          // Need both - decide based on how far behind we are on ratio
          const hostRatioCurrent = totalSeatsInTable > 0 ? hostAssigned / totalSeatsInTable : 0;
          const targetHostRatio = (hostRatio + externalRatio) > 0 ? hostRatio / (hostRatio + externalRatio) : 0.5;
          
          if (hostRatioCurrent < targetHostRatio) {
            // Try host first
            guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
            if (guestToAssign) {
              globalHostIndex++;
              hostAssigned++;
            } else {
              // Fall back to external
              guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
              if (guestToAssign) {
                globalExternalIndex++;
                externalAssigned++;
              }
            }
          } else {
            // Try external first
            guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
            if (guestToAssign) {
              globalExternalIndex++;
              externalAssigned++;
            } else {
              // Fall back to host
              guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
              if (guestToAssign) {
                globalHostIndex++;
                hostAssigned++;
              }
            }
          }
        } else {
          // Both targets met, fill with whatever is available
          guestToAssign = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
          if (guestToAssign) {
            globalHostIndex++;
            hostAssigned++;
          } else {
            guestToAssign = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
            if (guestToAssign) {
              globalExternalIndex++;
              externalAssigned++;
            }
          }
        }

        if (guestToAssign) {
          globalAssignedSet.add(guestToAssign.id);
          seatStore.assignGuestToSeat(table.id, seat.id, guestToAssign.id);
        }
      }
    } else {
      // --- NO TABLE RULES: Combined sorted assignment ---
      // Merge both lists while maintaining their individual sort orders
      // Pick the "next best" guest from either list based on the comparator
      
      for (const seat of unlockedSeats) {
        let guestToAssign: any = null;
        
        // Get next available from each list
        const nextHost = findNextAvailableGuest(sortedHostCandidates, globalHostIndex, globalAssignedSet);
        const nextExternal = findNextAvailableGuest(sortedExternalCandidates, globalExternalIndex, globalAssignedSet);
        
        // Compare and pick the better one according to sort rules
        if (nextHost && nextExternal) {
          // Both available - use comparator to decide
          const comparison = comparator(nextHost, nextExternal);
          if (comparison <= 0) {
            // Host comes first (or equal)
            guestToAssign = nextHost;
            globalHostIndex++;
          } else {
            // External comes first
            guestToAssign = nextExternal;
            globalExternalIndex++;
          }
        } else if (nextHost) {
          // Only host available
          guestToAssign = nextHost;
          globalHostIndex++;
        } else if (nextExternal) {
          // Only external available
          guestToAssign = nextExternal;
          globalExternalIndex++;
        }

        if (guestToAssign) {
          globalAssignedSet.add(guestToAssign.id);
          seatStore.assignGuestToSeat(table.id, seat.id, guestToAssign.id);
        }
      }
    }
  }
}