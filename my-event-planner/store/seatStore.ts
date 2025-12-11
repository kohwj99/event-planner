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

/* -------------------- 🔧 Types for Proximity Rules -------------------- */
export interface ProximityRules {
  sitTogether: Array<{ id: string; guest1Id: string; guest2Id: string }>;
  sitAway: Array<{ id: string; guest1Id: string; guest2Id: string }>;
}

/* -------------------- 🧠 Store Interface -------------------- */
interface SeatStoreState {
  tables: Table[];
  chunks: Record<string, Chunk>;
  selectedTableId: string | null;
  selectedSeatId: string | null;

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
  assignGuestToSeat: (tableId: string, seatId: string, guestId: string | null) => void;
  lockSeat: (tableId: string, seatId: string, locked: boolean) => void;
  clearSeat: (tableId: string, seatId: string) => void;
  updateSeatOrder: (tableId: string, newOrder: number[]) => void;
  resetTables: () => void;
  swapSeats: (table1Id: string, seat1Id: string, table2Id: string, seat2Id: string) => boolean;
  findGuestSeat: (guestId: string) => { tableId: string; seatId: string } | null;

  // Violation detection actions
  setProximityRules: (rules: ProximityRules | null) => void;
  setGuestLookup: (lookup: Record<string, any>) => void;
  detectViolations: () => void;

  // 🆕 NEW: Table-level operations
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

/* -------------------- 🔧 Helper: Extract table number from label -------------------- */
function extractTableNumber(label: string): number | null {
  // Match patterns like "Table 1", "Table 10", "VIP Table 5", etc.
  const match = label.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

function updateTableLabel(label: string, newNumber: number): string {
  // Replace the trailing number with the new number
  return label.replace(/(\d+)\s*$/, `${newNumber}`);
}

/* -------------------- 🧩 Zustand Store -------------------- */
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

        // Violation detection state
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

        /* ---------- 🧍 Guest Seat Assignment ---------- */
        assignGuestToSeat: (tableId, seatId, guestId) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                    ...t,
                    seats: t.seats.map((s) =>
                      s.id === seatId
                        ? { ...s, assignedGuestId: guestId ?? null }
                        : s
                    ),
                  }
            ),
          })),

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

        clearSeat: (tableId, seatId) =>
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
          })),

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

        swapSeats: (table1Id, seat1Id, table2Id, seat2Id) => {
          const state = get();

          // Find tables
          const table1 = state.tables.find((t) => t.id === table1Id);
          const table2 = state.tables.find((t) => t.id === table2Id);

          if (!table1 || !table2) {
            console.error('Swap failed: Tables not found');
            return false;
          }

          // Find seats
          const seat1 = table1.seats.find((s) => s.id === seat1Id);
          const seat2 = table2.seats.find((s) => s.id === seat2Id);

          if (!seat1 || !seat2) {
            console.error('Swap failed: Seats not found');
            return false;
          }

          // Validate swap
          if (seat1.locked || seat2.locked) {
            console.error('Swap failed: One or both seats are locked');
            return false;
          }

          if (!seat1.assignedGuestId || !seat2.assignedGuestId) {
            console.error('Swap failed: One or both seats are empty');
            return false;
          }

          // Store the guest IDs BEFORE any state changes
          const guest1Id = seat1.assignedGuestId;
          const guest2Id = seat2.assignedGuestId;

          console.log('Swapping:', {
            guest1Id,
            seat1: `${table1.label} - Seat ${seat1.seatNumber}`,
            guest2Id,
            seat2: `${table2.label} - Seat ${seat2.seatNumber}`,
          });

          // Perform the swap with a single state update
          set((state) => {
            const newTables = state.tables.map((table) => {
              // SAME TABLE: update both seats in one pass
              if (table.id === table1Id && table1Id === table2Id) {
                return {
                  ...table,
                  seats: table.seats.map((seat) => {
                    if (seat.id === seat1Id) return { ...seat, assignedGuestId: guest2Id };
                    if (seat.id === seat2Id) return { ...seat, assignedGuestId: guest1Id };
                    return seat;
                  }),
                };
              }

              // Different tables: update each table's seat individually
              if (table.id === table1Id) {
                return {
                  ...table,
                  seats: table.seats.map((seat) =>
                    seat.id === seat1Id ? { ...seat, assignedGuestId: guest2Id } : seat
                  ),
                };
              }

              if (table.id === table2Id) {
                return {
                  ...table,
                  seats: table.seats.map((seat) =>
                    seat.id === seat2Id ? { ...seat, assignedGuestId: guest1Id } : seat
                  ),
                };
              }

              return table;
            });

            return { tables: newTables };
          });

          // Verify the swap
          const newState = get();
          const verifyTable1 = newState.tables.find((t) => t.id === table1Id);
          const verifyTable2 = newState.tables.find((t) => t.id === table2Id);
          const verifySeat1 = verifyTable1?.seats.find((s) => s.id === seat1Id);
          const verifySeat2 = verifyTable2?.seats.find((s) => s.id === seat2Id);

          const swapSuccessful =
            verifySeat1?.assignedGuestId === guest2Id &&
            verifySeat2?.assignedGuestId === guest1Id;

          if (swapSuccessful) {
            console.log('Swap successful:', {
              seat1Now: verifySeat1?.assignedGuestId,
              seat2Now: verifySeat2?.assignedGuestId,
            });
          } else {
            console.error('Swap verification failed!');
          }

          return swapSuccessful;
        },

        /* ---------- 🔍 VIOLATION DETECTION ---------- */
        setProximityRules: (rules) => set({ proximityRules: rules }),

        setGuestLookup: (lookup) => set({ guestLookup: lookup }),

        detectViolations: () => {
          const state = get();
          if (!state.proximityRules) {
            set({ violations: [] });
            return;
          }

          const violations = detectProximityViolations(
            state.tables,
            state.proximityRules,
            state.guestLookup
          );

          set({ violations });
        },

        /* ---------- 🆕 NEW: TABLE-LEVEL OPERATIONS ---------- */

        /**
         * Lock all seats in a table
         */
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

        /**
         * Unlock all seats in a table
         */
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
         * Clear all guests from all seats in a table (unseat all)
         */
        clearAllSeatsInTable: (tableId) =>
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
          })),

        /**
         * Delete a table and reorder subsequent tables
         * - Unseats all guests in the table first
         * - Removes the table from chunks
         * - Reorders tables that come after the deleted table
         */
        deleteTable: (tableId) => {
          set((state) => {
            const tableToDelete = state.tables.find((t) => t.id === tableId);
            if (!tableToDelete) return state;

            // Get the table number of the deleted table
            const deletedTableNumber = extractTableNumber(tableToDelete.label);

            // Remove table from chunks
            const chunks = { ...state.chunks };
            removeTableFromChunk(chunks, tableId);

            // Filter out the deleted table and reorder remaining tables
            const remainingTables = state.tables
              .filter((t) => t.id !== tableId)
              .map((t) => {
                // If this table has a number greater than the deleted table's number,
                // decrement its number
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
              // Clear selection if the deleted table was selected
              selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
              selectedSeatId: state.selectedTableId === tableId ? null : state.selectedSeatId,
            };
          });
        },

        /**
         * Replace a table with a new table configuration
         * - Preserves the table's position
         * - Preserves the table's label
         * - Clears all guests (modifying seats unseats all guests)
         */
        replaceTable: (tableId, newTable) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId ? t : newTable
            ),
          })),

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

        // ORIGINAL cleanupEmptyChunks implementation - preserved exactly
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
      { name: "seat-tables" }  // ORIGINAL persist name preserved
    )
  )
);