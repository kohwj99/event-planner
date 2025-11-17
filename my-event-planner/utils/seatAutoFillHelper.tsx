// // ============================================================================
// // ENHANCED seatAutoFillHelper.tsx - Complete Implementation
// // ============================================================================

// import { useSeatStore } from "@/store/seatStore";
// import { useGuestStore } from "@/store/guestStore";

// export type SortField = "name" | "country" | "organization" | "ranking";
// export type SortDirection = "asc" | "desc";

// export interface SortRule {
//   field: SortField;
//   direction: SortDirection;
// }

// export interface RatioRule {
//   enabled: boolean;
//   hostRatio: number;
//   externalRatio: number;
// }

// export interface SpacingRule {
//   enabled: boolean;
//   spacing: number;
//   startWithExternal: boolean;
// }

// export interface TableRules {
//   ratioRule: RatioRule;
//   spacingRule: SpacingRule;
// }

// export interface SitTogetherRule {
//   id: string;
//   guest1Id: string;
//   guest2Id: string;
// }

// export interface SitAwayRule {
//   id: string;
//   guest1Id: string;
//   guest2Id: string;
// }

// export interface ProximityRules {
//   sitTogether: SitTogetherRule[];
//   sitAway: SitAwayRule[];
// }

// export interface AutoFillOptions {
//   includeHost?: boolean;
//   includeExternal?: boolean;
//   sortRules?: SortRule[];
//   tableRules?: TableRules;
//   proximityRules?: ProximityRules;
// }

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

// let proximityViolations: ProximityViolation[] = [];

// export function getProximityViolations(): ProximityViolation[] {
//   return proximityViolations;
// }

// // ============================================================================
// // STEP 1: HELPER FUNCTIONS
// // ============================================================================

// /** Get nested field values from guest object */
// function getGuestFieldValue(guest: any, field: SortField): string | number | undefined {
//   if (!guest) return undefined;
//   if (field === "organization") return (guest as any).company ?? (guest as any).organization ?? "";
//   return (guest as any)[field];
// }

// /** Build multi-level comparator from sort rules */
// function makeComparator(rules: SortRule[]) {
//   return (a: any, b: any) => {
//     for (const r of rules) {
//       const { field, direction } = r;
//       let av = getGuestFieldValue(a, field);
//       let bv = getGuestFieldValue(b, field);

//       if (av === undefined || av === null) av = "";
//       if (bv === undefined || bv === null) bv = "";

//       if (field === "ranking") {
//         const na = Number(av) || 0;
//         const nb = Number(bv) || 0;
//         if (na < nb) return direction === "asc" ? -1 : 1;
//         if (na > nb) return direction === "asc" ? 1 : -1;
//         continue;
//       }

//       const sa = String(av).toLowerCase();
//       const sb = String(bv).toLowerCase();
//       if (sa < sb) return direction === "asc" ? -1 : 1;
//       if (sa > sb) return direction === "asc" ? 1 : -1;
//     }

//     return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
//   };
// }

// /** Get adjacent seats based on adjacentSeats property */
// function getAdjacentSeats(seat: any, allSeats: any[]): any[] {
//   if (!seat.adjacentSeats || seat.adjacentSeats.length === 0) return [];
//   return seat.adjacentSeats
//     .map((adjId: string) => allSeats.find((s) => s.id === adjId))
//     .filter(Boolean);
// }

// /** Check if two guests should sit together */
// function shouldSitTogether(guest1Id: string, guest2Id: string, rules: SitTogetherRule[]): boolean {
//   return rules.some(
//     (rule) =>
//       (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
//       (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
//   );
// }

// /** Check if two guests should sit away */
// function shouldSitAway(guest1Id: string, guest2Id: string, rules: SitAwayRule[]): boolean {
//   return rules.some(
//     (rule) =>
//       (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
//       (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
//   );
// }

// /** Get sit-together partner for a guest */
// function getSitTogetherPartner(guestId: string, rules: SitTogetherRule[]): string | null {
//   for (const rule of rules) {
//     if (rule.guest1Id === guestId) return rule.guest2Id;
//     if (rule.guest2Id === guestId) return rule.guest1Id;
//   }
//   return null;
// }

// /** Get all guests that should sit away from this guest */
// function getSitAwayGuests(guestId: string, rules: SitAwayRule[]): string[] {
//   const awayGuests: string[] = [];
//   for (const rule of rules) {
//     if (rule.guest1Id === guestId) awayGuests.push(rule.guest2Id);
//     if (rule.guest2Id === guestId) awayGuests.push(rule.guest1Id);
//   }
//   return awayGuests;
// }

// // ============================================================================
// // STEP 2: INITIAL PLACEMENT WITH TABLE CONFIGURATION
// // ============================================================================

// interface SeatingState {
//   seatId: string;
//   guestId: string | null;
//   locked: boolean;
//   seatNumber: number;
//   tableId: string;
// }

// function performInitialPlacement(
//   tables: any[],
//   hostCandidates: any[],
//   externalCandidates: any[],
//   lockedGuestIds: Set<string>,
//   tableRules?: TableRules,
//   comparator?: (a: any, b: any) => number
// ): Map<string, string> {
//   const seatToGuest = new Map<string, string>();
//   const assignedGuests = new Set<string>(lockedGuestIds);

//   let hostIdx = 0;
//   let externalIdx = 0;

//   // Sort tables by order
//   const sortedTables = [...tables].sort((a, b) => {
//     const aNum = typeof a.tableNumber === "number" ? a.tableNumber : parseInt(a.id, 10) || 0;
//     const bNum = typeof b.tableNumber === "number" ? b.tableNumber : parseInt(b.id, 10) || 0;
//     return aNum - bNum;
//   });

//   for (const table of sortedTables) {
//     // Sort seats by seatNumber (respects custom ordering)
//     const seats = [...(table.seats ?? [])].sort((a, b) => {
//       const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
//       const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
//       return aSeatNum - bSeatNum;
//     });

//     const unlockedSeats = seats.filter((s: any) => !s.locked);

//     // Calculate table configuration targets
//     const totalUnlockedSeats = unlockedSeats.length;
//     let targetHostCount = 0;
//     let targetExternalCount = 0;

//     if (tableRules?.ratioRule.enabled) {
//       const totalRatio = tableRules.ratioRule.hostRatio + tableRules.ratioRule.externalRatio;
//       if (totalRatio > 0) {
//         targetHostCount = Math.floor((tableRules.ratioRule.hostRatio / totalRatio) * totalUnlockedSeats);
//         targetExternalCount = totalUnlockedSeats - targetHostCount;
//       }
//     }

//     // Apply spacing rule if enabled
//     if (tableRules?.spacingRule.enabled) {
//       const spacing = tableRules.spacingRule.spacing;
//       let seatIdx = 0;

//       while (seatIdx < unlockedSeats.length) {
//         const seat = unlockedSeats[seatIdx];

//         // Place host
//         if (hostIdx < hostCandidates.length && !assignedGuests.has(hostCandidates[hostIdx].id)) {
//           seatToGuest.set(seat.id, hostCandidates[hostIdx].id);
//           assignedGuests.add(hostCandidates[hostIdx].id);
//           hostIdx++;
//           seatIdx++;
//         } else {
//           seatIdx++;
//           continue;
//         }

//         // Place external guests according to spacing
//         for (let s = 0; s < spacing && seatIdx < unlockedSeats.length; s++) {
//           const spacingSeat = unlockedSeats[seatIdx];
//           if (externalIdx < externalCandidates.length && !assignedGuests.has(externalCandidates[externalIdx].id)) {
//             seatToGuest.set(spacingSeat.id, externalCandidates[externalIdx].id);
//             assignedGuests.add(externalCandidates[externalIdx].id);
//             externalIdx++;
//           }
//           seatIdx++;
//         }
//       }
//     } else if (tableRules?.ratioRule.enabled) {
//       // Apply ratio rule
//       let hostPlaced = 0;
//       let externalPlaced = 0;

//       for (const seat of unlockedSeats) {
//         // Decide whether to place host or external based on ratio
//         const shouldPlaceHost = hostPlaced < targetHostCount && hostIdx < hostCandidates.length;
//         const shouldPlaceExternal = externalPlaced < targetExternalCount && externalIdx < externalCandidates.length;

//         if (shouldPlaceHost && !assignedGuests.has(hostCandidates[hostIdx].id)) {
//           seatToGuest.set(seat.id, hostCandidates[hostIdx].id);
//           assignedGuests.add(hostCandidates[hostIdx].id);
//           hostIdx++;
//           hostPlaced++;
//         } else if (shouldPlaceExternal && !assignedGuests.has(externalCandidates[externalIdx].id)) {
//           seatToGuest.set(seat.id, externalCandidates[externalIdx].id);
//           assignedGuests.add(externalCandidates[externalIdx].id);
//           externalIdx++;
//           externalPlaced++;
//         } else {
//           // Fill remaining with available guests
//           if (hostIdx < hostCandidates.length && !assignedGuests.has(hostCandidates[hostIdx].id)) {
//             seatToGuest.set(seat.id, hostCandidates[hostIdx].id);
//             assignedGuests.add(hostCandidates[hostIdx].id);
//             hostIdx++;
//           } else if (externalIdx < externalCandidates.length && !assignedGuests.has(externalCandidates[externalIdx].id)) {
//             seatToGuest.set(seat.id, externalCandidates[externalIdx].id);
//             assignedGuests.add(externalCandidates[externalIdx].id);
//             externalIdx++;
//           }
//         }
//       }
//     } else {
//       // No special rules - just fill in order
//       for (const seat of unlockedSeats) {
//         if (hostIdx < hostCandidates.length && !assignedGuests.has(hostCandidates[hostIdx].id)) {
//           seatToGuest.set(seat.id, hostCandidates[hostIdx].id);
//           assignedGuests.add(hostCandidates[hostIdx].id);
//           hostIdx++;
//         } else if (externalIdx < externalCandidates.length && !assignedGuests.has(externalCandidates[externalIdx].id)) {
//           seatToGuest.set(seat.id, externalCandidates[externalIdx].id);
//           assignedGuests.add(externalCandidates[externalIdx].id);
//           externalIdx++;
//         }
//       }
//     }
//   }

//   return seatToGuest;
// }

// // ============================================================================
// // STEP 3: PROXIMITY RULES - SIT TOGETHER
// // ============================================================================

// function applySitTogetherOptimization(
//   seatToGuest: Map<string, string>,
//   tables: any[],
//   proximityRules: ProximityRules,
//   allGuests: any[],
//   comparator: (a: any, b: any) => number
// ): void {
//   const guestLookup = new Map(allGuests.map(g => [g.id, g]));
  
//   // Create sorted list of sit-together pairs
//   const sortedPairs = [...proximityRules.sitTogether]
//     .map(rule => {
//       const g1 = guestLookup.get(rule.guest1Id);
//       const g2 = guestLookup.get(rule.guest2Id);
      
//       if (!g1 || !g2) return null;
      
//       // Determine higher priority guest
//       const cmp = comparator(g1, g2);
//       const higherPriority = cmp <= 0 ? g1 : g2;
//       const lowerPriority = cmp <= 0 ? g2 : g1;
      
//       return { rule, higherPriority, lowerPriority };
//     })
//     .filter(Boolean)
//     .sort((a, b) => comparator(a!.higherPriority, b!.higherPriority));

//   // Process each pair
//   for (const pairData of sortedPairs) {
//     if (!pairData) continue;
    
//     const { higherPriority, lowerPriority } = pairData;
    
//     // Find where higher priority guest is seated
//     let higherSeat: any = null;
//     let higherTable: any = null;
    
//     for (const table of tables) {
//       for (const seat of table.seats) {
//         if (seatToGuest.get(seat.id) === higherPriority.id) {
//           higherSeat = seat;
//           higherTable = table;
//           break;
//         }
//       }
//       if (higherSeat) break;
//     }
    
//     if (!higherSeat || !higherTable) continue;
    
//     // Find where lower priority guest is seated
//     let lowerSeat: any = null;
    
//     for (const table of tables) {
//       for (const seat of table.seats) {
//         if (seatToGuest.get(seat.id) === lowerPriority.id) {
//           lowerSeat = seat;
//           break;
//         }
//       }
//       if (lowerSeat) break;
//     }
    
//     if (!lowerSeat) continue;
    
//     // Check if they're already adjacent
//     const adjacentSeats = getAdjacentSeats(higherSeat, higherTable.seats);
//     const isAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);
    
//     if (isAdjacent) continue; // Already together
    
//     // Try to find an adjacent seat to move lower priority guest
//     const emptyAdjacentSeat = adjacentSeats.find(s => 
//       !s.locked && !seatToGuest.get(s.id)
//     );
    
//     if (emptyAdjacentSeat) {
//       // Move lower priority guest to adjacent seat
//       seatToGuest.delete(lowerSeat.id);
//       seatToGuest.set(emptyAdjacentSeat.id, lowerPriority.id);
//       continue;
//     }
    
//     // Try to swap with adjacent guest if it doesn't break another sit-together
//     for (const adjSeat of adjacentSeats) {
//       if (adjSeat.locked) continue;
      
//       const adjGuestId = seatToGuest.get(adjSeat.id);
//       if (!adjGuestId) continue;
      
//       // Check if this guest has a sit-together partner
//       const adjPartner = getSitTogetherPartner(adjGuestId, proximityRules.sitTogether);
//       if (adjPartner) {
//         // Don't swap if it would break a sit-together
//         const partnerAdjacentToAdj = getAdjacentSeats(adjSeat, higherTable.seats)
//           .some(s => seatToGuest.get(s.id) === adjPartner);
        
//         if (partnerAdjacentToAdj) continue; // Would break sit-together
//       }
      
//       // Perform swap
//       seatToGuest.delete(lowerSeat.id);
//       seatToGuest.delete(adjSeat.id);
//       seatToGuest.set(adjSeat.id, lowerPriority.id);
//       seatToGuest.set(lowerSeat.id, adjGuestId);
//       break;
//     }
//   }
// }

// // ============================================================================
// // STEP 4: PROXIMITY RULES - SIT AWAY
// // ============================================================================

// function applySitAwayOptimization(
//   seatToGuest: Map<string, string>,
//   tables: any[],
//   proximityRules: ProximityRules,
//   allGuests: any[],
//   comparator: (a: any, b: any) => number
// ): void {
//   const guestLookup = new Map(allGuests.map(g => [g.id, g]));
  
//   // Sort sit-away pairs by priority
//   const sortedPairs = [...proximityRules.sitAway]
//     .map(rule => {
//       const g1 = guestLookup.get(rule.guest1Id);
//       const g2 = guestLookup.get(rule.guest2Id);
      
//       if (!g1 || !g2) return null;
      
//       const cmp = comparator(g1, g2);
//       const higherPriority = cmp <= 0 ? g1 : g2;
//       const lowerPriority = cmp <= 0 ? g2 : g1;
      
//       return { rule, higherPriority, lowerPriority };
//     })
//     .filter(Boolean)
//     .sort((a, b) => comparator(a!.higherPriority, b!.higherPriority));

//   // Check each pair for violations
//   for (const pairData of sortedPairs) {
//     if (!pairData) continue;
    
//     const { higherPriority, lowerPriority } = pairData;
    
//     // Find seats for both guests
//     let higherSeat: any = null;
//     let higherTable: any = null;
//     let lowerSeat: any = null;
//     let lowerTable: any = null;
    
//     for (const table of tables) {
//       for (const seat of table.seats) {
//         const guestId = seatToGuest.get(seat.id);
//         if (guestId === higherPriority.id) {
//           higherSeat = seat;
//           higherTable = table;
//         }
//         if (guestId === lowerPriority.id) {
//           lowerSeat = seat;
//           lowerTable = table;
//         }
//       }
//     }
    
//     if (!higherSeat || !lowerSeat || higherTable.id !== lowerTable.id) continue;
    
//     // Check if they're adjacent (violation)
//     const adjacentSeats = getAdjacentSeats(higherSeat, higherTable.seats);
//     const areAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);
    
//     if (!areAdjacent) continue; // No violation
    
//     // Try to move lower priority guest
//     const allSeats = [...higherTable.seats].sort((a, b) => {
//       const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
//       const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
//       return aSeatNum - bSeatNum;
//     });
    
//     // Find index of current seat
//     const currentIdx = allSeats.findIndex(s => s.id === lowerSeat.id);
    
//     // Try shift down (to next seats)
//     for (let i = currentIdx + 1; i < allSeats.length; i++) {
//       const targetSeat = allSeats[i];
//       if (targetSeat.locked) continue;
      
//       // Check if this position would still violate
//       const targetAdjacentSeats = getAdjacentSeats(targetSeat, allSeats);
//       const wouldViolate = targetAdjacentSeats.some(s => 
//         seatToGuest.get(s.id) === higherPriority.id
//       );
      
//       if (!wouldViolate) {
//         // Perform shift down
//         const targetGuestId = seatToGuest.get(targetSeat.id);
//         seatToGuest.delete(lowerSeat.id);
//         seatToGuest.delete(targetSeat.id);
//         seatToGuest.set(targetSeat.id, lowerPriority.id);
//         if (targetGuestId) {
//           seatToGuest.set(lowerSeat.id, targetGuestId);
//         }
//         break;
//       }
//     }
//   }
// }

// // ============================================================================
// // STEP 5: VIOLATION DETECTION
// // ============================================================================

// function detectViolations(
//   seatToGuest: Map<string, string>,
//   tables: any[],
//   proximityRules: ProximityRules,
//   allGuests: any[],
//   tableRules?: TableRules
// ): ProximityViolation[] {
//   const violations: ProximityViolation[] = [];
//   const guestLookup = new Map(allGuests.map(g => [g.id, g]));
  
//   for (const table of tables) {
//     const seats = table.seats || [];
    
//     for (const seat of seats) {
//       const guestId = seatToGuest.get(seat.id);
//       if (!guestId) continue;
      
//       const guest = guestLookup.get(guestId);
//       if (!guest) continue;
      
//       const adjacentSeats = getAdjacentSeats(seat, seats);
//       const adjacentGuestIds = adjacentSeats
//         .map(s => seatToGuest.get(s.id))
//         .filter(Boolean) as string[];
      
//       // Check sit-together violations
//       const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
//       if (togetherPartner) {
//         const partner = guestLookup.get(togetherPartner);
//         if (partner && !adjacentGuestIds.includes(togetherPartner)) {
//           const partnerAssigned = Array.from(seatToGuest.values()).includes(togetherPartner);
          
//           if (partnerAssigned) {
//             const alreadyReported = violations.some(v =>
//               v.type === 'sit-together' &&
//               ((v.guest1Id === guestId && v.guest2Id === togetherPartner) ||
//                 (v.guest1Id === togetherPartner && v.guest2Id === guestId))
//             );
            
//             if (!alreadyReported) {
//               violations.push({
//                 type: 'sit-together',
//                 guest1Id: guestId,
//                 guest2Id: togetherPartner,
//                 guest1Name: guest.name,
//                 guest2Name: partner.name,
//                 tableId: table.id,
//                 tableLabel: table.label,
//                 seat1Id: seat.id,
//               });
//             }
//           }
//         }
//       }
      
//       // Check sit-away violations
//       for (const adjGuestId of adjacentGuestIds) {
//         if (shouldSitAway(guestId, adjGuestId, proximityRules.sitAway)) {
//           const adjGuest = guestLookup.get(adjGuestId);
//           // const adjSeat = seats.find(s => seatToGuest.get(s.id) === adjGuestId);
//           //           const adjSeat = seats.find(s => seatToGuest.get(s.id) === adjGuestId);
//           const adjSeat = seats.find((s: any) => seatToGuest.get(s.id) === adjGuestId);

//           if (adjGuest && adjSeat) {
//             const alreadyReported = violations.some(v =>
//               v.type === 'sit-away' &&
//               ((v.guest1Id === guestId && v.guest2Id === adjGuestId) ||
//                 (v.guest1Id === adjGuestId && v.guest2Id === guestId))
//             );
            
//             if (!alreadyReported) {
//               violations.push({
//                 type: 'sit-away',
//                 guest1Id: guestId,
//                 guest2Id: adjGuestId,
//                 guest1Name: guest.name,
//                 guest2Name: adjGuest.name,
//                 tableId: table.id,
//                 tableLabel: table.label,
//                 seat1Id: seat.id,
//                 seat2Id: adjSeat.id,
//               });
//             }
//           }
//         }
//       }
//     }
//   }
  
//   return violations;
// }

// // ============================================================================
// // MAIN AUTOFILL FUNCTION
// // ============================================================================

// export async function autoFillSeats(options: AutoFillOptions = {}) {
//   const {
//     includeHost = true,
//     includeExternal = true,
//     sortRules = [{ field: "ranking", direction: "asc" }],
//     tableRules,
//     proximityRules = { sitTogether: [], sitAway: [] },
//   } = options;

//   const seatStore = useSeatStore.getState();
//   const guestStore = useGuestStore.getState();

//   if (!includeHost && !includeExternal) {
//     console.warn("autoFillSeats: no guest lists selected; aborting.");
//     return;
//   }

//   // Reset violations
//   proximityViolations = [];

//   // STEP 1: Collect and prepare guests
//   const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
//   const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];
//   const allGuests = [...hostPool, ...externalPool];

//   // Identify locked guests
//   const lockedGuestIds = new Set<string>();
//   seatStore.tables.forEach((t: any) =>
//     (t.seats ?? []).forEach((s: any) => {
//       if (s.locked && s.assignedGuestId) {
//         lockedGuestIds.add(s.assignedGuestId);
//       }
//     })
//   );

//   // Filter out locked guests
//   const hostCandidates = hostPool.filter((g: any) => !lockedGuestIds.has(g.id));
//   const externalCandidates = externalPool.filter((g: any) => !lockedGuestIds.has(g.id));

//   // STEP 2: Sort candidates
//   const comparator = makeComparator(sortRules);
//   const sortedHostCandidates = [...hostCandidates].sort(comparator);
//   const sortedExternalCandidates = [...externalCandidates].sort(comparator);

//   // Clear unlocked seats
//   for (const table of seatStore.tables) {
//     for (const seat of table.seats ?? []) {
//       if (!seat.locked && seat.assignedGuestId) {
//         seatStore.clearSeat(table.id, seat.id);
//       }
//     }
//   }

//   // STEP 3: Initial placement with table configuration
//   const tables = useSeatStore.getState().tables;
//   const seatToGuest = performInitialPlacement(
//     tables,
//     sortedHostCandidates,
//     sortedExternalCandidates,
//     lockedGuestIds,
//     tableRules,
//     comparator
//   );

//   // STEP 4: Apply sit-together optimization
//   applySitTogetherOptimization(
//     seatToGuest,
//     tables,
//     proximityRules,
//     allGuests,
//     comparator
//   );

//   // STEP 5: Apply sit-away optimization
//   applySitAwayOptimization(
//     seatToGuest,
//     tables,
//     proximityRules,
//     allGuests,
//     comparator
//   );

//   // STEP 6: Commit assignments to store
//   for (const [seatId, guestId] of seatToGuest.entries()) {
//     // Find which table this seat belongs to
//     for (const table of tables) {
//       const seat = table.seats.find((s: any) => s.id === seatId);
//       if (seat && !seat.locked) {
//         seatStore.assignGuestToSeat(table.id, seatId, guestId);
//         break;
//       }
//     }
//   }

//   // STEP 7: Detect violations
//   const finalTables = useSeatStore.getState().tables;
//   proximityViolations = detectViolations(
//     seatToGuest,
//     finalTables,
//     proximityRules,
//     allGuests,
//     tableRules
//   );

//   console.log(`Autofill completed. Violations: ${proximityViolations.length}`);
// }



// ============================================================================
// ENHANCED seatAutoFillHelper.tsx - Complete Implementation
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
  type: 'sit-together' | 'sit-away' | 'table-config';
  guest1Id: string;
  guest2Id?: string;
  guest1Name: string;
  guest2Name?: string;
  tableId: string;
  tableLabel: string;
  seat1Id?: string;
  seat2Id?: string;
  reason?: string;
}

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
    // First, apply the base comparator (sort rules)
    const sortResult = baseComparator(a, b);
    
    // If there's a clear winner from sorting, return it
    if (sortResult !== 0) {
      return sortResult;
    }
    
    // TIE-BREAKER: Only when sort scores are identical
    // Prefer host over external
    const aIsHost = a.fromHost === true;
    const bIsHost = b.fromHost === true;
    
    if (aIsHost && !bIsHost) return -1; // a (host) comes first
    if (!aIsHost && bIsHost) return 1;  // b (host) comes first
    
    // Both same type, maintain stability by ID
    return String(a.id || "").localeCompare(String(b.id || ""));
  };
}

/**
 * Get next guest from unified sorted list
 * Respects sort order with host priority as tie-breaker only
 */
function getNextGuestFromUnifiedList(
  allCandidates: any[],
  assignedGuests: Set<string>,
  comparator: (a: any, b: any) => number
): any | null {
  // Filter out already assigned guests
  const available = allCandidates.filter(g => !assignedGuests.has(g.id));
  
  if (available.length === 0) return null;
  
  // The list is already sorted with tie-breaking applied
  // Just return the first available guest
  return available[0];
}

/**
 * For spacing/ratio rules: get next guest of specific type
 * Still respects sort order within that type
 */
function getNextGuestOfType(
  allCandidates: any[],
  assignedGuests: Set<string>,
  isHost: boolean
): any | null {
  const available = allCandidates.filter(g => 
    !assignedGuests.has(g.id) && g.fromHost === isHost
  );
  
  if (available.length === 0) return null;
  
  // Return first available of this type (already sorted)
  return available[0];
}

function performInitialPlacement(
  tables: any[],
  hostCandidates: any[],
  externalCandidates: any[],
  lockedGuestIds: Set<string>,
  tableRules?: TableRules,
  comparator?: (a: any, b: any) => number
): Map<string, string> {
  const seatToGuest = new Map<string, string>();
  const assignedGuests = new Set<string>(lockedGuestIds);

  // Create unified sorted list with host priority as tie-breaker
  const comparatorWithTieBreak = makeComparatorWithHostTieBreak(comparator || ((a, b) => 0));
  const allCandidates = [...hostCandidates, ...externalCandidates].sort(comparatorWithTieBreak);

  // Sort tables by order
  const sortedTables = [...tables].sort((a, b) => {
    const aNum = typeof a.tableNumber === "number" ? a.tableNumber : parseInt(a.id, 10) || 0;
    const bNum = typeof b.tableNumber === "number" ? b.tableNumber : parseInt(b.id, 10) || 0;
    return aNum - bNum;
  });

  for (const table of sortedTables) {
    // Sort seats by seatNumber (respects custom ordering)
    const seats = [...(table.seats ?? [])].sort((a, b) => {
      const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
      const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
      return aSeatNum - bSeatNum;
    });

    const unlockedSeats = seats.filter((s: any) => !s.locked);

    // Calculate table configuration targets
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

    // Apply spacing rule if enabled (requires specific host/external interleaving)
    if (tableRules?.spacingRule.enabled) {
      const spacing = tableRules.spacingRule.spacing;
      let seatIdx = 0;

      while (seatIdx < unlockedSeats.length) {
        const seat = unlockedSeats[seatIdx];

        // Place next host (from sorted list)
        const nextHost = getNextGuestOfType(allCandidates, assignedGuests, true);
        if (nextHost) {
          seatToGuest.set(seat.id, nextHost.id);
          assignedGuests.add(nextHost.id);
          seatIdx++;
        } else {
          // No more hosts, break pattern
          break;
        }

        // Place external guests according to spacing
        for (let s = 0; s < spacing && seatIdx < unlockedSeats.length; s++) {
          const spacingSeat = unlockedSeats[seatIdx];
          const nextExternal = getNextGuestOfType(allCandidates, assignedGuests, false);
          if (nextExternal) {
            seatToGuest.set(spacingSeat.id, nextExternal.id);
            assignedGuests.add(nextExternal.id);
          }
          seatIdx++;
        }
      }
      
      // Fill any remaining seats with whoever's left (sorted order)
      while (seatIdx < unlockedSeats.length) {
        const seat = unlockedSeats[seatIdx];
        const nextGuest = getNextGuestFromUnifiedList(allCandidates, assignedGuests, comparatorWithTieBreak);
        if (nextGuest) {
          seatToGuest.set(seat.id, nextGuest.id);
          assignedGuests.add(nextGuest.id);
        }
        seatIdx++;
      }
      
    } else if (tableRules?.ratioRule.enabled) {
      // Apply ratio rule (requires specific host/external counts)
      let hostPlaced = 0;
      let externalPlaced = 0;

      for (const seat of unlockedSeats) {
        // Decide whether to place host or external based on ratio targets
        const shouldPlaceHost = hostPlaced < targetHostCount;
        const shouldPlaceExternal = externalPlaced < targetExternalCount;

        if (shouldPlaceHost) {
          const nextHost = getNextGuestOfType(allCandidates, assignedGuests, true);
          if (nextHost) {
            seatToGuest.set(seat.id, nextHost.id);
            assignedGuests.add(nextHost.id);
            hostPlaced++;
            continue;
          }
        }
        
        if (shouldPlaceExternal) {
          const nextExternal = getNextGuestOfType(allCandidates, assignedGuests, false);
          if (nextExternal) {
            seatToGuest.set(seat.id, nextExternal.id);
            assignedGuests.add(nextExternal.id);
            externalPlaced++;
            continue;
          }
        }
        
        // Targets met or exhausted - fill remaining with whoever's left (sorted order)
        const nextGuest = getNextGuestFromUnifiedList(allCandidates, assignedGuests, comparatorWithTieBreak);
        if (nextGuest) {
          seatToGuest.set(seat.id, nextGuest.id);
          assignedGuests.add(nextGuest.id);
        }
      }
      
    } else {
      // NO SPECIAL RULES - Pure sorted order with host tie-breaking
      // This is the core fix: just follow the sorted list
      for (const seat of unlockedSeats) {
        const nextGuest = getNextGuestFromUnifiedList(allCandidates, assignedGuests, comparatorWithTieBreak);
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
// STEP 3: PROXIMITY RULES - SIT TOGETHER
// ============================================================================

function applySitTogetherOptimization(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  allGuests: any[],
  comparator: (a: any, b: any) => number
): void {
  const guestLookup = new Map(allGuests.map(g => [g.id, g]));
  
  // Create sorted list of sit-together pairs
  const sortedPairs = [...proximityRules.sitTogether]
    .map(rule => {
      const g1 = guestLookup.get(rule.guest1Id);
      const g2 = guestLookup.get(rule.guest2Id);
      
      if (!g1 || !g2) return null;
      
      // Determine higher priority guest
      const cmp = comparator(g1, g2);
      const higherPriority = cmp <= 0 ? g1 : g2;
      const lowerPriority = cmp <= 0 ? g2 : g1;
      
      return { rule, higherPriority, lowerPriority };
    })
    .filter(Boolean)
    .sort((a, b) => comparator(a!.higherPriority, b!.higherPriority));

  // Process each pair
  for (const pairData of sortedPairs) {
    if (!pairData) continue;
    
    const { higherPriority, lowerPriority } = pairData;
    
    // Find where higher priority guest is seated
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
    
    // Find where lower priority guest is seated
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
    
    // Check if they're already adjacent
    const adjacentSeats = getAdjacentSeats(higherSeat, higherTable.seats);
    const isAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);
    
    if (isAdjacent) continue; // Already together
    
    // Try to find an adjacent seat to move lower priority guest
    const emptyAdjacentSeat = adjacentSeats.find(s => 
      !s.locked && !seatToGuest.get(s.id)
    );
    
    if (emptyAdjacentSeat) {
      // Move lower priority guest to adjacent seat
      seatToGuest.delete(lowerSeat.id);
      seatToGuest.set(emptyAdjacentSeat.id, lowerPriority.id);
      continue;
    }
    
    // Try to swap with adjacent guest if it doesn't break another sit-together
    for (const adjSeat of adjacentSeats) {
      if (adjSeat.locked) continue;
      
      const adjGuestId = seatToGuest.get(adjSeat.id);
      if (!adjGuestId) continue;
      
      // Check if this guest has a sit-together partner
      const adjPartner = getSitTogetherPartner(adjGuestId, proximityRules.sitTogether);
      if (adjPartner) {
        // Don't swap if it would break a sit-together
        const partnerAdjacentToAdj = getAdjacentSeats(adjSeat, higherTable.seats)
          .some(s => seatToGuest.get(s.id) === adjPartner);
        
        if (partnerAdjacentToAdj) continue; // Would break sit-together
      }
      
      // Perform swap
      seatToGuest.delete(lowerSeat.id);
      seatToGuest.delete(adjSeat.id);
      seatToGuest.set(adjSeat.id, lowerPriority.id);
      seatToGuest.set(lowerSeat.id, adjGuestId);
      break;
    }
  }
}

// ============================================================================
// STEP 4: PROXIMITY RULES - SIT AWAY
// ============================================================================

function applySitAwayOptimization(
  seatToGuest: Map<string, string>,
  tables: any[],
  proximityRules: ProximityRules,
  allGuests: any[],
  comparator: (a: any, b: any) => number
): void {
  const guestLookup = new Map(allGuests.map(g => [g.id, g]));
  
  // Sort sit-away pairs by priority
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

  // Check each pair for violations
  for (const pairData of sortedPairs) {
    if (!pairData) continue;
    
    const { higherPriority, lowerPriority } = pairData;
    
    // Find seats for both guests
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
    
    // Check if they're adjacent (violation)
    const adjacentSeats = getAdjacentSeats(higherSeat, higherTable.seats);
    const areAdjacent = adjacentSeats.some(s => seatToGuest.get(s.id) === lowerPriority.id);
    
    if (!areAdjacent) continue; // No violation
    
    // Try to move lower priority guest
    const allSeats = [...higherTable.seats].sort((a, b) => {
      const aSeatNum = typeof a.seatNumber === 'number' ? a.seatNumber : 999;
      const bSeatNum = typeof b.seatNumber === 'number' ? b.seatNumber : 999;
      return aSeatNum - bSeatNum;
    });
    
    // Find index of current seat
    const currentIdx = allSeats.findIndex(s => s.id === lowerSeat.id);
    
    // Try shift down (to next seats)
    for (let i = currentIdx + 1; i < allSeats.length; i++) {
      const targetSeat = allSeats[i];
      if (targetSeat.locked) continue;
      
      // Check if this position would still violate
      const targetAdjacentSeats = getAdjacentSeats(targetSeat, allSeats);
      const wouldViolate = targetAdjacentSeats.some(s => 
        seatToGuest.get(s.id) === higherPriority.id
      );
      
      if (!wouldViolate) {
        // Perform shift down
        const targetGuestId = seatToGuest.get(targetSeat.id);
        seatToGuest.delete(lowerSeat.id);
        seatToGuest.delete(targetSeat.id);
        seatToGuest.set(targetSeat.id, lowerPriority.id);
        if (targetGuestId) {
          seatToGuest.set(lowerSeat.id, targetGuestId);
        }
        break;
      }
    }
  }
}

// ============================================================================
// STEP 5: VIOLATION DETECTION
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
      const guestId = seatToGuest.get(seat.id);
      if (!guestId) continue;
      
      const guest = guestLookup.get(guestId);
      if (!guest) continue;
      
      const adjacentSeats = getAdjacentSeats(seat, seats);
      const adjacentGuestIds = adjacentSeats
        .map(s => seatToGuest.get(s.id))
        .filter(Boolean) as string[];
      
      // Check sit-together violations
      const togetherPartner = getSitTogetherPartner(guestId, proximityRules.sitTogether);
      if (togetherPartner) {
        const partner = guestLookup.get(togetherPartner);
        if (partner && !adjacentGuestIds.includes(togetherPartner)) {
          const partnerAssigned = Array.from(seatToGuest.values()).includes(togetherPartner);
          
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
          // const adjSeat = seats.find(s => seatToGuest.get(s.id) === adjGuestId);
          const adjSeat = seats.find((s: any) => seatToGuest.get(s.id) === adjGuestId);

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

  // STEP 1: Collect and prepare guests
  const hostPool = includeHost ? (guestStore.hostGuests ?? []).filter((g: any) => !g.deleted) : [];
  const externalPool = includeExternal ? (guestStore.externalGuests ?? []).filter((g: any) => !g.deleted) : [];
  const allGuests = [...hostPool, ...externalPool];

  // Identify locked guests
  const lockedGuestIds = new Set<string>();
  seatStore.tables.forEach((t: any) =>
    (t.seats ?? []).forEach((s: any) => {
      if (s.locked && s.assignedGuestId) {
        lockedGuestIds.add(s.assignedGuestId);
      }
    })
  );

  // Filter out locked guests
  const hostCandidates = hostPool.filter((g: any) => !lockedGuestIds.has(g.id));
  const externalCandidates = externalPool.filter((g: any) => !lockedGuestIds.has(g.id));

  // STEP 2: Sort candidates
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

  // STEP 3: Initial placement with table configuration
  const tables = useSeatStore.getState().tables;
  const seatToGuest = performInitialPlacement(
    tables,
    sortedHostCandidates,
    sortedExternalCandidates,
    lockedGuestIds,
    tableRules,
    comparator
  );

  // STEP 4: Apply sit-together optimization
  applySitTogetherOptimization(
    seatToGuest,
    tables,
    proximityRules,
    allGuests,
    comparator
  );

  // STEP 5: Apply sit-away optimization
  applySitAwayOptimization(
    seatToGuest,
    tables,
    proximityRules,
    allGuests,
    comparator
  );

  // STEP 6: Commit assignments to store
  for (const [seatId, guestId] of seatToGuest.entries()) {
    // Find which table this seat belongs to
    for (const table of tables) {
      const seat = table.seats.find((s: any) => s.id === seatId);
      if (seat && !seat.locked) {
        seatStore.assignGuestToSeat(table.id, seatId, guestId);
        break;
      }
    }
  }

  // STEP 7: Detect violations
  const finalTables = useSeatStore.getState().tables;
  proximityViolations = detectViolations(
    seatToGuest,
    finalTables,
    proximityRules,
    allGuests,
    tableRules
  );

  console.log(`Autofill completed. Violations: ${proximityViolations.length}`);
}