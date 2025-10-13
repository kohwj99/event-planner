import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface Seat {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  assignedGuestId?: string | null;
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
  addTable: (table: Table) => void;
  updateTable: (id: string, data: Partial<Table>) => void;
  removeTable: (id: string) => void;
  resetTables: () => void;
}

export const useSeatStore = create<SeatStoreState>()(
  devtools(
    persist(
      (set) => ({
        tables: [],

        addTable: (table) =>
          set((state) => ({
            tables: [...state.tables, table],
          })),

        updateTable: (id, data) =>
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id === id ? { ...t, ...data } : t
            ),
          })),

        removeTable: (id) =>
          set((state) => ({
            tables: state.tables.filter((t) => t.id !== id),
          })),

        resetTables: () => set({ tables: [] }),
      }),
      { name: "seat-tables" }
    ),
    { name: "SeatStore" }
  )
);
