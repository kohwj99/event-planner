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

/* -------------------- 🧠 Store Interface -------------------- */
interface SeatStoreState {
  tables: Table[];
  chunks: Record<string, Chunk>;
  selectedTableId: string | null;
  selectedSeatId: string | null;

  // Table & Seat operations
  addTable: (table: Table) => void;
  updateTable: (id: string, data: Partial<Table>) => void;
  moveTable: (id: string, newX: number, newY: number) => void;
  setSelectedTable: (id: string | null) => void;
  selectSeat: (tableId: string, seatId: string | null) => void;
  assignGuestToSeat: (tableId: string, seatId: string, guestId: string | null) => void; // 🆕
  lockSeat: (tableId: string, seatId: string, locked: boolean) => void;
  clearSeat: (tableId: string, seatId: string) => void;
  updateSeatOrder: (tableId: string, newOrder: number[]) => void;
  resetTables: () => void;

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
          }),

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
