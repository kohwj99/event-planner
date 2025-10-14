import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface Seat {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  seatNumber: number;
  assignedGuestId?: string | null;
  locked?: boolean;
  selected?: boolean;
}

export interface Table {
  id: string;
  x: number;
  y: number;
  radius: number;
  seats: Seat[];
  label: string;
  shape: "round" | "square" | "rectangle";
}

interface SeatStoreState {
  tables: Table[];
  selectedTableId: string | null;
  selectedSeatId: string | null;
  addTable: (table: Table) => void;
  updateTable: (id: string, data: Partial<Table>) => void;
  moveTable: (id: string, newX: number, newY: number) => void;
  setSelectedTable: (id: string | null) => void;
  selectSeat: (tableId: string, seatId: string | null) => void;
  lockSeat: (tableId: string, seatId: string, locked: boolean) => void;
  clearSeat: (tableId: string, seatId: string) => void;
  updateSeatOrder: (tableId: string, newOrder: number[]) => void;
  resetTables: () => void;
}

export const useSeatStore = create<SeatStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        tables: [],
        selectedTableId: null,
        selectedSeatId: null,

        addTable: (table) =>
          set((state) => ({ tables: [...state.tables, table] })),

        updateTable: (id, data) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id === id ? { ...t, ...data } : t
            ),
          })),

        moveTable: (id, newX, newY) =>
          set((state) => ({
            tables: state.tables.map((t) => {
              if (t.id !== id) return t;
              const dx = newX - t.x;
              const dy = newY - t.y;
              return {
                ...t,
                x: newX,
                y: newY,
                seats: t.seats.map((s) => ({
                  ...s,
                  x: s.x + dx,
                  y: s.y + dy,
                })),
              };
            }),
          })),

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

        resetTables: () => set({ tables: [], selectedTableId: null }),
      }),
      { name: "seat-tables" }
    )
  )
);
