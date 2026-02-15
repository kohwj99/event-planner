import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";
import { SessionRulesConfig } from "@/types/Event";

/**
 * Describes the user action that was performed.
 * Used to label history entries for debugging and potential future UI display.
 */
export type HistoryActionLabel =
  | "Add Table"
  | "Delete Table"
  | "Move Table"
  | "Modify Table"
  | "Assign Guest"
  | "Clear Seat"
  | "Swap Seats"
  | "Lock Seat"
  | "Unlock Seat"
  | "Lock All Seats"
  | "Unlock All Seats"
  | "Clear All Seats"
  | "Update Seat Order"
  | "AutoFill"
  | "Reset Tables";

/**
 * A snapshot of the mutable session state at a point in time.
 * Captures only data that changes from user actions and needs to be restorable.
 * Violations are NOT stored -- they are recomputed via detectViolations() after restore.
 * Selection state is NOT stored -- it is not meaningful to restore.
 */
export interface HistorySnapshot {
  /** Deep clone of seatStore.tables */
  tables: Table[];
  /** Deep clone of seatStore.chunks */
  chunks: Record<string, Chunk>;
  /** Only populated for AutoFill actions -- the rulesConfig from before the autofill */
  rulesConfig: SessionRulesConfig | null;
  /** Human-readable label for this action */
  label: HistoryActionLabel;
}

interface HistoryStoreState {
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  maxStackSize: number;

  /** Push the CURRENT state (before mutation) onto the undo stack. Clears redo stack. */
  pushSnapshot: (snapshot: HistorySnapshot) => void;

  /**
   * Pop the most recent snapshot from the undo stack.
   * The caller passes the CURRENT state which gets pushed onto the redo stack.
   * Returns the snapshot to restore, or null if nothing to undo.
   */
  undo: (currentSnapshot: HistorySnapshot) => HistorySnapshot | null;

  /**
   * Pop the most recent snapshot from the redo stack.
   * The caller passes the CURRENT state which gets pushed onto the undo stack.
   * Returns the snapshot to restore, or null if nothing to redo.
   */
  redo: (currentSnapshot: HistorySnapshot) => HistorySnapshot | null;

  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Clear all history (called when leaving session page or switching sessions) */
  clear: () => void;
}

export const useHistoryStore = create<HistoryStoreState>()(
  devtools(
    (set, get) => ({
      undoStack: [],
      redoStack: [],
      maxStackSize: 50,

      pushSnapshot: (snapshot) =>
        set((state) => {
          const newStack = [...state.undoStack, snapshot];
          // Trim oldest entries if exceeding max size
          if (newStack.length > state.maxStackSize) {
            newStack.splice(0, newStack.length - state.maxStackSize);
          }
          return {
            undoStack: newStack,
            redoStack: [], // Any new action invalidates the redo stack
          };
        }),

      undo: (currentSnapshot) => {
        const state = get();
        if (state.undoStack.length === 0) return null;

        const snapshotToRestore = state.undoStack[state.undoStack.length - 1];
        set({
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, currentSnapshot],
        });
        return snapshotToRestore;
      },

      redo: (currentSnapshot) => {
        const state = get();
        if (state.redoStack.length === 0) return null;

        const snapshotToRestore = state.redoStack[state.redoStack.length - 1];
        set({
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, currentSnapshot],
        });
        return snapshotToRestore;
      },

      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,

      clear: () => set({ undoStack: [], redoStack: [] }),
    }),
    { name: "history-store" }
  )
);
