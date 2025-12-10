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
} from "@/utils/chunkHelper";
import { detectProximityViolations, ProximityViolation, ProximityRules } from "@/utils/violationDetector";
import { SeatMode } from "@/types/Seat";

/* -------------------- ðŸ§  Store Interface -------------------- */
interface SeatStoreState {
  tables: Table[];
  chunks: Record<string, Chunk>;
  selectedTableId: string | null;
  selectedSeatId: string | null;

  // Violation detection state
  proximityRules: ProximityRules | null;
  violations: ProximityViolation[];
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

  // Violation detection operations
  setProximityRules: (rules: ProximityRules | null) => void;
  setGuestLookup: (lookup: Record<string, any>) => void;
  detectViolations: () => void;
  clearViolations: () => void;

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

  // Seat mode operations
  updateSeatMode: (tableId: string, seatId: string, mode: SeatMode) => void;
  updateMultipleSeatModes: (tableId: string, seatModes: Record<string, SeatMode>) => void;
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

        // Violation detection state
        proximityRules: null,
        violations: [],
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

        /* ---------- ðŸ§ Guest Seat Assignment ---------- */
        assignGuestToSeat: (tableId, seatId, guestId) => {
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
          }));
          // Trigger violation detection after seat assignment
          get().detectViolations();
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
          // Trigger violation detection after clearing seat
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
            violations: [],
            proximityRules: null,
            guestLookup: {},
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
            // Trigger violation detection after successful swap
            get().detectViolations();
          } else {
            console.error('Swap verification failed!');
          }

          return swapSuccessful;
        },

        /* ---------- VIOLATION DETECTION ---------- */
        setProximityRules: (rules) => set({ proximityRules: rules }),

        setGuestLookup: (lookup) => set({ guestLookup: lookup }),

        detectViolations: () => {
          const state = get();
          const { tables, proximityRules, guestLookup } = state;

          // Skip if no proximity rules are set
          if (!proximityRules || (proximityRules.sitTogether.length === 0 && proximityRules.sitAway.length === 0)) {
            // Clear violations if no rules
            if (state.violations.length > 0) {
              set({ violations: [] });
            }
            return;
          }

          // Skip if no guest lookup is available
          if (Object.keys(guestLookup).length === 0) {
            return;
          }

          // Detect violations using the centralized function
          const newViolations = detectProximityViolations(tables, proximityRules, guestLookup);

          // Only update state if violations changed (optimization)
          const currentViolationIds = state.violations.map(v => `${v.type}-${v.guest1Id}-${v.guest2Id}`).sort().join(',');
          const newViolationIds = newViolations.map(v => `${v.type}-${v.guest1Id}-${v.guest2Id}`).sort().join(',');

          if (currentViolationIds !== newViolationIds) {
            set({ violations: newViolations });
            console.log(`Violations updated: ${newViolations.length} found`);
          }
        },

        clearViolations: () => set({ violations: [], proximityRules: null }),

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

        // ---------- SEAT MODE MANAGEMENT ----------
        updateSeatMode: (tableId, seatId, mode) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                  ...t,
                  seats: t.seats.map((s) =>
                    s.id === seatId ? { ...s, mode } : s
                  ),
                }
            ),
          })),

        updateMultipleSeatModes: (tableId, seatModes) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id !== tableId
                ? t
                : {
                  ...t,
                  seats: t.seats.map((s) => ({
                    ...s,
                    mode: seatModes[s.id] ?? s.mode ?? 'default',
                  })),
                }
            ),
          })),
      }),
      {
        name: "seat-tables",
        // Exclude violations and guestLookup from persistence (computed state)
        partialize: (state) => ({
          tables: state.tables,
          chunks: state.chunks,
          selectedTableId: state.selectedTableId,
          selectedSeatId: state.selectedSeatId,
          proximityRules: state.proximityRules, // Keep rules for re-detection on load
          // Exclude: violations, guestLookup (will be recomputed)
        }),
      }
    )
  )
);