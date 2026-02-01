import { Chunk, CHUNK_HEIGHT, CHUNK_WIDTH } from "@/types/Chunk";
import { Table } from "@/types/Table";
import { moveTableGeometry } from "@/utils/tableGeometryHelper";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
  getChunkCoords,
  getChunkKey,
  assignTableToChunk,
  moveTableBetweenChunks,
  ensureChunkExists as ensureChunkExistsHelper,
  removeTableFromChunk,
} from "@/utils/chunkHelper";
import { detectProximityViolations, ProximityViolation } from "@/utils/violationDetector";
import {
  validateGuestSeatAssignment,
  validateSeatSwap,
  GuestInfo,
} from "@/utils/seatValidation";

/* -------------------- ðŸ§© Types for Proximity Rules -------------------- */
export interface ProximityRules {
  sitTogether: Array<{ id: string; guest1Id: string; guest2Id: string }>;
  sitAway: Array<{ id: string; guest1Id: string; guest2Id: string }>;
}

/* -------------------- ðŸ§  Store Interface -------------------- */
interface SeatStoreState {
  tables: Table[];
  chunks: Record<string, Chunk>;
  selectedTableId: string | null;
  selectedSeatId: string | null;

  // Meal plan selection (per session)
  selectedMealPlanIndex: number | null;

  // Violation detection state
  violations: ProximityViolation[];
  proximityRules: ProximityRules | null;
  guestLookup: Record<string, any>;

  // Table & Seat operations
  addTable: (table: Table) => void;
  updateTable: (id: string, data: Partial<Table>) => void;
  moveTable: (id: string, newX: number, newY: number) => void;
  updateTableState: (tables: Table[]) => void;
  setSelectedTable: (id: string | null) => void;
  selectSeat: (tableId: string, seatId: string | null) => void;
  assignGuestToSeat: (tableId: string, seatId: string, guestId: string | null) => boolean;
  lockSeat: (tableId: string, seatId: string, locked: boolean) => void;
  clearSeat: (tableId: string, seatId: string) => void;
  updateSeatOrder: (tableId: string, newOrder: number[]) => void;
  resetTables: () => void;
  swapSeats: (table1Id: string, seat1Id: string, table2Id: string, seat2Id: string) => boolean;
  findGuestSeat: (guestId: string) => { tableId: string; seatId: string } | null;

  // Meal plan action
  setSelectedMealPlanIndex: (index: number | null) => void;

  // Violation detection actions
  setProximityRules: (rules: ProximityRules | null) => void;
  setGuestLookup: (lookup: Record<string, any>) => void;
  detectViolations: () => void;

  // ðŸ”µ Table-level operations
  lockAllSeatsInTable: (tableId: string) => void;
  unlockAllSeatsInTable: (tableId: string) => void;
  deleteTable: (tableId: string) => void;
  replaceTable: (tableId: string, newTable: Table) => void;
  clearAllSeatsInTable: (tableId: string) => void;

  // Chunk management
  ensureChunkExists: (row: number, col: number) => void;
  assignTableToChunk: (tableId: string, row: number, col: number) => void;
  expandWorldIfNeeded: () => void;
  cleanupEmptyChunks: () => void;
  getWorldSize: () => { width: number; height: number };
  getAllChunksSorted: () => Chunk[];
  getOccupiedBounds: () => {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  } | null;
}

/* -------------------- ðŸ§© Helper: Extract table number from label -------------------- */
function extractTableNumber(label: string): number | null {
  const match = label.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

function updateTableLabel(label: string, newNumber: number): string {
  return label.replace(/(\d+)\s*$/, `${newNumber}`);
}

/* -------------------- ðŸ§© Zustand Store -------------------- */
export const useSeatStore = create<SeatStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        tables: [],
        chunks: {
          [getChunkKey(0, 0)]: {
            id: getChunkKey(0, 0),
            row: 0,
            col: 0,
            tables: [],
          },
        },
        selectedTableId: null,
        selectedSeatId: null,
        selectedMealPlanIndex: null,
        violations: [],
        proximityRules: null,
        guestLookup: {},

        /* ---------- TABLE MANAGEMENT ---------- */
        addTable: (table) => {
          set((state) => {
            const chunks = { ...state.chunks };
            const { row, col } = getChunkCoords(table.x, table.y);
            assignTableToChunk(chunks, table.id, row, col);
            return { tables: [...state.tables, table], chunks };
          });
        },

        updateTable: (id, data) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id === id ? { ...t, ...data } : t
            ),
          })),

        updateTableState: (tables) => set(() => ({ tables })),

        moveTable: (id, newX, newY) => {
          set((state) => {
            const tables = state.tables.map((t) => {
              if (t.id !== id) return t;
              const dx = newX - t.x;
              const dy = newY - t.y;
              return moveTableGeometry(t, dx, dy);
            });

            const chunks = { ...state.chunks };
            const { row, col } = getChunkCoords(newX, newY);
            moveTableBetweenChunks(chunks, id, row, col);

            return { tables, chunks };
          });
        },

        setSelectedTable: (id) =>
          set(() => ({ selectedTableId: id, selectedSeatId: null })),

        selectSeat: (tableId, seatId) =>
          set((state) => ({
            selectedTableId: tableId,
            selectedSeatId: seatId,
            tables: state.tables.map((t) => ({
              ...t,
              seats: t.seats.map((s) => ({
                ...s,
                selected: t.id === tableId && s.id === seatId,
              })),
            })),
          })),

        /* ---------- ðŸ§‘ Guest Seat Assignment with Validation ---------- */
        /**
         * Assign a guest to a seat with seat mode validation
         * Uses centralized validateGuestSeatAssignment function
         * 
         * UPDATED: Now triggers violation detection after assignment
         * 
         * @returns true if assignment was successful, false if validation failed
         */
        assignGuestToSeat: (tableId, seatId, guestId) => {
          let assignResult = { success: false, error: '' };

          set((state) => {
            // Find the table and seat
            const table = state.tables.find((t) => t.id === tableId);
            if (!table) {
              console.error('Assignment failed: Table not found');
              assignResult = { success: false, error: 'Table not found' };
              return state;
            }

            const seat = table.seats.find((s) => s.id === seatId);
            if (!seat) {
              console.error('Assignment failed: Seat not found');
              assignResult = { success: false, error: 'Seat not found' };
              return state;
            }

            // If clearing the seat (guestId is null), skip validation
            if (guestId === null) {
              console.log(`Clearing seat ${seat.seatNumber} in ${table.label}`);
              assignResult = { success: true, error: '' };
              
              return {
                tables: state.tables.map((t) =>
                  t.id !== tableId
                    ? t
                    : {
                        ...t,
                        seats: t.seats.map((s) =>
                          s.id === seatId
                            ? { ...s, assignedGuestId: null }
                            : s
                        ),
                      }
                ),
              };
            }

            // Get guest information for validation
            const guest = state.guestLookup[guestId];
            if (!guest) {
              console.error('Assignment failed: Guest not found in lookup');
              assignResult = { success: false, error: 'Guest not found' };
              return state;
            }

            // Create guest info for validation
            const guestInfo: GuestInfo = {
              id: guestId,
              name: guest.name,
              fromHost: guest.fromHost ?? false,
            };

            // Validate the assignment using centralized validation
            const validation = validateGuestSeatAssignment(guestInfo, seat);

            if (!validation.canAssign) {
              console.error(`Assignment failed: ${validation.reason}`);
              assignResult = { success: false, error: validation.reason || 'Validation failed' };
              return state;
            }

            // Validation passed, perform the assignment
            console.log(`Assigning ${guest.name} (${guestInfo.fromHost ? 'Host' : 'External'}) to ${table.label} - Seat ${seat.seatNumber} (mode: ${validation.seatMode})`);
            assignResult = { success: true, error: '' };

            return {
              tables: state.tables.map((t) =>
                t.id !== tableId
                  ? t
                  : {
                      ...t,
                      seats: t.seats.map((s) =>
                        s.id === seatId
                          ? { ...s, assignedGuestId: guestId }
                          : s
                      ),
                    }
              ),
            };
          });

          if (!assignResult.success && assignResult.error) {
            console.error('Assignment failed:', assignResult.error);
          }

          // âœ… TRIGGER VIOLATION DETECTION after assignment
          if (assignResult.success) {
            get().detectViolations();
          }

          return assignResult.success;
        },

        lockSeat: (tableId, seatId, locked) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                    ...t,
                    seats: t.seats.map((s) =>
                      s.id === seatId ? { ...s, locked } : s
                    ),
                  }
            ),
          })),

        /**
         * Clear a seat (remove guest assignment)
         * UPDATED: Now triggers violation detection after clearing
         */
        clearSeat: (tableId, seatId) => {
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                    ...t,
                    seats: t.seats.map((s) =>
                      s.id === seatId
                        ? { ...s, assignedGuestId: null, locked: false }
                        : s
                    ),
                  }
            ),
          }));

          // âœ… TRIGGER VIOLATION DETECTION after clearing seat
          get().detectViolations();
        },

        updateSeatOrder: (tableId, newOrder) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                    ...t,
                    seats: t.seats.map((s, i) => ({
                      ...s,
                      seatNumber: newOrder[i] ?? s.seatNumber,
                    })),
                  }
            ),
          })),

        resetTables: () =>
          set({
            tables: [],
            chunks: {
              [getChunkKey(0, 0)]: {
                id: getChunkKey(0, 0),
                row: 0,
                col: 0,
                tables: [],
              },
            },
            selectedTableId: null,
            selectedSeatId: null,
            selectedMealPlanIndex: null,
            violations: [],
          }),

        findGuestSeat: (guestId) => {
          const state = get();
          for (const table of state.tables) {
            for (const seat of table.seats) {
              if (seat.assignedGuestId === guestId) {
                return { tableId: table.id, seatId: seat.id };
              }
            }
          }
          return null;
        },

        setSelectedMealPlanIndex: (index) => set({ selectedMealPlanIndex: index }),

        /* ---------- ðŸ”„ Swap Seats with Validation ---------- */
        /**
         * Swap two guests between seats with seat mode validation
         * Uses centralized validateSeatSwap function
         * 
         * UPDATED: Now triggers violation detection after swap
         * 
         * All state reading happens inside set() callback to prevent race conditions
         * 
         * @returns true if swap was successful, false if validation failed
         */
        swapSeats: (table1Id, seat1Id, table2Id, seat2Id) => {
          let swapResult = { success: false, error: '' };

          set((state) => {
            // Find tables from current state
            const table1 = state.tables.find((t) => t.id === table1Id);
            const table2 = state.tables.find((t) => t.id === table2Id);

            if (!table1 || !table2) {
              console.error('Swap failed: Tables not found');
              swapResult = { success: false, error: 'Tables not found' };
              return state;
            }

            // Find seats from current state
            const seat1 = table1.seats.find((s) => s.id === seat1Id);
            const seat2 = table2.seats.find((s) => s.id === seat2Id);

            if (!seat1 || !seat2) {
              console.error('Swap failed: Seats not found');
              swapResult = { success: false, error: 'Seats not found' };
              return state;
            }

            // Get guest information from current state
            const guest1Id = seat1.assignedGuestId;
            const guest2Id = seat2.assignedGuestId;

            const guest1Data = guest1Id ? state.guestLookup[guest1Id] : null;
            const guest2Data = guest2Id ? state.guestLookup[guest2Id] : null;

            // Create guest info objects for validation
            const guest1Info: GuestInfo | null = guest1Data ? {
              id: guest1Id!,
              name: guest1Data.name,
              fromHost: guest1Data.fromHost ?? false,
            } : null;

            const guest2Info: GuestInfo | null = guest2Data ? {
              id: guest2Id!,
              name: guest2Data.name,
              fromHost: guest2Data.fromHost ?? false,
            } : null;

            // Use centralized validation function
            const validation = validateSeatSwap(seat1, seat2, guest1Info, guest2Info);

            if (!validation.canSwap) {
              console.error('Swap failed:', validation.reasons.join(', '));
              swapResult = { success: false, error: validation.reasons.join(', ') };
              return state;
            }

            // Validation passed, perform the swap
            console.log('Swapping (atomic):', {
              guest1: guest1Info?.name,
              guest1Type: guest1Info?.fromHost ? 'Host' : 'External',
              seat1: `${table1.label} - Seat ${seat1.seatNumber}`,
              seat1Mode: seat1.mode || 'default',
              guest2: guest2Info?.name,
              guest2Type: guest2Info?.fromHost ? 'Host' : 'External',
              seat2: `${table2.label} - Seat ${seat2.seatNumber}`,
              seat2Mode: seat2.mode || 'default',
            });

            const newTables = state.tables.map((table) => {
              // SAME TABLE: update both seats in one pass
              if (table.id === table1Id && table1Id === table2Id) {
                return {
                  ...table,
                  seats: table.seats.map((seat) => {
                    if (seat.id === seat1Id) {
                      return { ...seat, assignedGuestId: guest2Id };
                    }
                    if (seat.id === seat2Id) {
                      return { ...seat, assignedGuestId: guest1Id };
                    }
                    return seat;
                  }),
                };
              }

              // Different tables: update table1's seat
              if (table.id === table1Id) {
                return {
                  ...table,
                  seats: table.seats.map((seat) =>
                    seat.id === seat1Id 
                      ? { ...seat, assignedGuestId: guest2Id } 
                      : seat
                  ),
                };
              }

              // Different tables: update table2's seat
              if (table.id === table2Id) {
                return {
                  ...table,
                  seats: table.seats.map((seat) =>
                    seat.id === seat2Id 
                      ? { ...seat, assignedGuestId: guest1Id } 
                      : seat
                  ),
                };
              }

              return table;
            });

            swapResult = { success: true, error: '' };
            console.log('Swap completed atomically');

            return { tables: newTables };
          });

          if (!swapResult.success && swapResult.error) {
            console.error('Swap failed:', swapResult.error);
          }

          // âœ… TRIGGER VIOLATION DETECTION after swap
          if (swapResult.success) {
            get().detectViolations();
          }

          return swapResult.success;
        },

        /* ---------- ðŸ” VIOLATION DETECTION ---------- */
        setProximityRules: (rules) => set({ proximityRules: rules }),

        setGuestLookup: (lookup) => set({ guestLookup: lookup }),

        /**
         * Detect all proximity violations based on current seating arrangement
         * Called automatically after seat modifications when proximityRules are set
         */
        detectViolations: () => {
          const state = get();
          if (!state.proximityRules) {
            set({ violations: [] });
            return;
          }

          console.log('ðŸ” Running violation detection...');
          const violations = detectProximityViolations(
            state.tables,
            state.proximityRules,
            state.guestLookup
          );

          console.log(`ðŸ” Detected ${violations.length} violations`);
          set({ violations });
        },

        /* ---------- ðŸ”µ TABLE-LEVEL OPERATIONS ---------- */

        lockAllSeatsInTable: (tableId) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                    ...t,
                    seats: t.seats.map((s) => ({ ...s, locked: true })),
                  }
            ),
          })),

        unlockAllSeatsInTable: (tableId) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                    ...t,
                    seats: t.seats.map((s) => ({ ...s, locked: false })),
                  }
            ),
          })),

        /**
         * Clear all seats in a table
         * UPDATED: Now triggers violation detection after clearing
         */
        clearAllSeatsInTable: (tableId) => {
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                    ...t,
                    seats: t.seats.map((s) => ({
                      ...s,
                      assignedGuestId: null,
                      locked: false,
                    })),
                  }
            ),
          }));

          // âœ… TRIGGER VIOLATION DETECTION after clearing all seats
          get().detectViolations();
        },

        /**
         * Delete a table (removes all seated guests)
         * UPDATED: Now triggers violation detection after deletion
         */
        deleteTable: (tableId) => {
          set((state) => {
            const tableToDelete = state.tables.find((t) => t.id === tableId);
            if (!tableToDelete) return state;

            const deletedTableNumber = extractTableNumber(tableToDelete.label);
            const chunks = { ...state.chunks };
            removeTableFromChunk(chunks, tableId);

            const remainingTables = state.tables
              .filter((t) => t.id !== tableId)
              .map((t) => {
                if (deletedTableNumber !== null) {
                  const currentNumber = extractTableNumber(t.label);
                  if (currentNumber !== null && currentNumber > deletedTableNumber) {
                    return {
                      ...t,
                      label: updateTableLabel(t.label, currentNumber - 1),
                    };
                  }
                }
                return t;
              });

            return {
              tables: remainingTables,
              chunks,
              selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
              selectedSeatId: state.selectedTableId === tableId ? null : state.selectedSeatId,
            };
          });

          // âœ… TRIGGER VIOLATION DETECTION after deleting table
          get().detectViolations();
        },

        replaceTable: (tableId, newTable) => {
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId ? t : newTable
            ),
          }));

          // âœ… TRIGGER VIOLATION DETECTION after replacing table (seats may have changed)
          get().detectViolations();
        },

        /* ---------- CHUNK MANAGEMENT ---------- */
        ensureChunkExists: (row, col) =>
          set((state) => {
            const chunks = { ...state.chunks };
            ensureChunkExistsHelper(chunks, row, col);
            return { chunks };
          }),

        assignTableToChunk: (tableId, row, col) =>
          set((state) => {
            const chunks = { ...state.chunks };
            assignTableToChunk(chunks, tableId, row, col);
            return { chunks };
          }),

        expandWorldIfNeeded: () => {
          const { tables, chunks } = get();
          if (tables.length === 0) return;

          const maxX = Math.max(...tables.map((t) => t.x + t.radius));
          const maxY = Math.max(...tables.map((t) => t.y + t.radius));

          const maxChunkRow = Math.max(...Object.values(chunks).map((c) => c.row));
          const maxChunkCol = Math.max(...Object.values(chunks).map((c) => c.col));

          const needNewRight = maxX > (maxChunkCol + 1) * CHUNK_WIDTH - 200;
          const needNewDown = maxY > (maxChunkRow + 1) * CHUNK_HEIGHT - 200;

          const newChunks = { ...chunks };
          if (needNewRight) {
            for (let r = 0; r <= maxChunkRow; r++) {
              const c = maxChunkCol + 1;
              const key = getChunkKey(r, c);
              if (!newChunks[key])
                newChunks[key] = { id: key, row: r, col: c, tables: [] };
            }
          }

          if (needNewDown) {
            const newRow = maxChunkRow + 1;
            const maxColAfter = Math.max(
              ...Object.values(newChunks).map((c) => c.col)
            );
            for (let c = 0; c <= maxColAfter; c++) {
              const key = getChunkKey(newRow, c);
              if (!newChunks[key])
                newChunks[key] = { id: key, row: newRow, col: c, tables: [] };
            }
          }

          set({ chunks: newChunks });
        },

        cleanupEmptyChunks: () => {
          set((state) => {
            const chunks = { ...state.chunks };
            const occupied = Object.values(chunks).filter(
              (c) => c.tables.length > 0
            );

            if (occupied.length === 0) {
              const key0 = getChunkKey(0, 0);
              return {
                chunks: {
                  [key0]: { id: key0, row: 0, col: 0, tables: [] },
                },
              };
            }

            const minRow = Math.min(...occupied.map((c) => c.row));
            const maxRow = Math.max(...occupied.map((c) => c.row));
            const minCol = Math.min(...occupied.map((c) => c.col));
            const maxCol = Math.max(...occupied.map((c) => c.col));

            const newChunks: Record<string, Chunk> = {};
            for (let r = minRow; r <= maxRow; r++) {
              for (let c = minCol; c <= maxCol; c++) {
                const key = getChunkKey(r, c);
                newChunks[key] =
                  chunks[key] ?? { id: key, row: r, col: c, tables: [] };
              }
            }

            Object.values(chunks)
              .filter((ch) => ch.tables.length > 0)
              .forEach(
                (ch) => (newChunks[getChunkKey(ch.row, ch.col)] = ch)
              );

            return { chunks: newChunks };
          });
        },

        getWorldSize: () => {
          const chunks = get().chunks;
          const maxRow = Math.max(...Object.values(chunks).map((c) => c.row));
          const maxCol = Math.max(...Object.values(chunks).map((c) => c.col));
          return {
            width: (maxCol + 1) * CHUNK_WIDTH,
            height: (maxRow + 1) * CHUNK_HEIGHT,
          };
        },

        getOccupiedBounds: () => {
          const { chunks } = get();
          const occupied = Object.values(chunks).filter(
            (c) => c.tables.length > 0
          );
          if (occupied.length === 0) return null;
          return {
            minRow: Math.min(...occupied.map((c) => c.row)),
            maxRow: Math.max(...occupied.map((c) => c.row)),
            minCol: Math.min(...occupied.map((c) => c.col)),
            maxCol: Math.max(...occupied.map((c) => c.col)),
          };
        },

        getAllChunksSorted: () => {
          const { chunks } = get();
          return Object.values(chunks).sort((a, b) =>
            a.row === b.row ? a.col - b.col : a.row - b.row
          );
        },
      }),
      { name: "seat-tables" }
    )
  )
);