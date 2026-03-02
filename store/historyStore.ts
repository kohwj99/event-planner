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
  | "Reset Tables"
  | "Chunk Layout";

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

/**
 * Estimate the byte size of a snapshot by serializing to JSON.
 * This is an approximation -- actual in-memory size may differ due to
 * object overhead, but JSON length closely tracks relative cost.
 */
function estimateSnapshotBytes(snapshot: HistorySnapshot): number {
  try {
    return new Blob([JSON.stringify(snapshot)]).size;
  } catch {
    return 0;
  }
}

/**
 * Format byte count into a human-readable string (B, KB, MB).
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Log memory usage of the history stacks after a push.
 * Groups: action label, snapshot size, stack depths, and total memory.
 */
function logHistoryMemoryUsage(
  undoStack: HistorySnapshot[],
  redoStack: HistorySnapshot[],
  latestSnapshot: HistorySnapshot
): void {
  const latestBytes = estimateSnapshotBytes(latestSnapshot);
  const undoBytes = undoStack.reduce((sum, s) => sum + estimateSnapshotBytes(s), 0);
  const redoBytes = redoStack.reduce((sum, s) => sum + estimateSnapshotBytes(s), 0);
  const totalBytes = undoBytes + redoBytes;

  const tableCount = latestSnapshot.tables.length;
  const seatCount = latestSnapshot.tables.reduce((sum, t) => sum + t.seats.length, 0);

  console.groupCollapsed(
    `[HistoryStore] Pushed "${latestSnapshot.label}" | ` +
    `Snapshot: ${formatBytes(latestBytes)} | ` +
    `Total: ${formatBytes(totalBytes)}`
  );
  console.table({
    "Latest Snapshot": {
      action: latestSnapshot.label,
      size: formatBytes(latestBytes),
      tables: tableCount,
      seats: seatCount,
      includesRulesConfig: latestSnapshot.rulesConfig !== null,
    },
    "Undo Stack": {
      depth: undoStack.length,
      size: formatBytes(undoBytes),
    },
    "Redo Stack": {
      depth: redoStack.length,
      size: formatBytes(redoBytes),
    },
    "Total": {
      snapshots: undoStack.length + redoStack.length,
      size: formatBytes(totalBytes),
    },
  });
  console.groupEnd();
}

export const useHistoryStore = create<HistoryStoreState>()(
  devtools(
    (set, get) => ({
      undoStack: [],
      redoStack: [],
      maxStackSize: 50,

      pushSnapshot: (snapshot) => {
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
        });

        // Log memory usage after the push has been applied
        const { undoStack, redoStack } = get();
        logHistoryMemoryUsage(undoStack, redoStack, snapshot);
      },

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
