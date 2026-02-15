import { useEffect, useCallback, useRef } from "react";
import { useSeatStore } from "@/store/seatStore";
import { useEventStore } from "@/store/eventStore";
import {
  useHistoryStore,
  HistoryActionLabel,
  HistorySnapshot,
} from "@/store/historyStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";
import { SessionRulesConfig } from "@/types/Event";

interface UseUndoRedoOptions {
  /** The current session ID -- needed for restoring rulesConfig on autofill undo */
  sessionId: string;
  /** Whether the session is locked (disables undo/redo when true) */
  isLocked: boolean;
}

/**
 * Deep clone tables and chunks to create an immutable snapshot.
 * Uses structuredClone for proper handling of nested objects/arrays.
 */
function deepCloneState(
  tables: Table[],
  chunks: Record<string, Chunk>
): { tables: Table[]; chunks: Record<string, Chunk> } {
  return structuredClone({ tables, chunks });
}

/**
 * Build a snapshot of the current seatStore state (and optionally rulesConfig).
 */
function buildCurrentSnapshot(
  label: HistoryActionLabel,
  rulesConfig: SessionRulesConfig | null = null
): HistorySnapshot {
  const { tables, chunks } = useSeatStore.getState();
  const cloned = deepCloneState(tables, chunks);
  return {
    tables: cloned.tables,
    chunks: cloned.chunks,
    rulesConfig: rulesConfig ? structuredClone(rulesConfig) : null,
    label,
  };
}

/**
 * Hook for undo/redo functionality on the session page.
 *
 * Provides:
 * - captureSnapshot(label, includeRulesConfig?) -- call BEFORE mutations
 * - Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo)
 * - Auto-clears history on unmount and session switch
 * - Blocks undo/redo when session is locked
 *
 * Does NOT restore selection state or violations (violations are recomputed).
 */
export function useUndoRedo({ sessionId, isLocked }: UseUndoRedoOptions) {
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot);
  const undoFromStore = useHistoryStore((s) => s.undo);
  const redoFromStore = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const clearHistory = useHistoryStore((s) => s.clear);

  // Refs for stable access in event handlers without re-registering listeners
  const sessionIdRef = useRef(sessionId);
  const isLockedRef = useRef(isLocked);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  /**
   * Capture a snapshot of the current state BEFORE a mutation.
   * Components call this right before calling a seatStore action.
   *
   * @param label - Description of the action about to be performed
   * @param includeRulesConfig - If true, also captures the current session rulesConfig
   *                             (used for AutoFill so rules can be restored on undo)
   */
  const captureSnapshot = useCallback(
    (label: HistoryActionLabel, includeRulesConfig = false) => {
      let rulesConfig: SessionRulesConfig | null = null;

      if (includeRulesConfig && sessionIdRef.current) {
        rulesConfig =
          useEventStore.getState().loadSessionRules(sessionIdRef.current) ??
          null;
      }

      const snapshot = buildCurrentSnapshot(label, rulesConfig);
      pushSnapshot(snapshot);
    },
    [pushSnapshot]
  );

  /**
   * Restore a snapshot to seatStore (and optionally to eventStore rulesConfig).
   * Recomputes violations after restoration.
   */
  const restoreSnapshot = useCallback((snapshot: HistorySnapshot) => {
    // Restore tables and chunks to seatStore atomically
    useSeatStore.setState({
      tables: snapshot.tables,
      chunks: snapshot.chunks,
    });

    // Recompute violations from the restored state
    useSeatStore.getState().detectViolations();

    // If this snapshot includes a rulesConfig (from undoing an autofill),
    // also restore the rulesConfig in eventStore
    if (snapshot.rulesConfig && sessionIdRef.current) {
      const sessionData = useEventStore
        .getState()
        .getSessionById(sessionIdRef.current);
      if (sessionData) {
        useEventStore
          .getState()
          .saveSessionRules(
            sessionData.eventId,
            sessionData.dayId,
            sessionIdRef.current,
            snapshot.rulesConfig
          );

        // Update seatStore proximityRules to match restored config
        if (snapshot.rulesConfig.proximityRules) {
          useSeatStore
            .getState()
            .setProximityRules(snapshot.rulesConfig.proximityRules);
        }

        // Re-detect violations with the restored rules
        useSeatStore.getState().detectViolations();
      }
    }
  }, []);

  /**
   * Perform undo: pop from undoStack, push current state to redoStack, restore.
   */
  const handleUndo = useCallback(() => {
    if (isLockedRef.current) return;
    if (!canUndo()) return;

    // Build a snapshot of the current state to push onto the redo stack.
    // Use a generic label since this snapshot represents "where we are now"
    // and will only be used if the user redoes.
    const currentSnapshot = buildCurrentSnapshot("Add Table");
    const snapshotToRestore = undoFromStore(currentSnapshot);

    if (snapshotToRestore) {
      restoreSnapshot(snapshotToRestore);
    }
  }, [canUndo, undoFromStore, restoreSnapshot]);

  /**
   * Perform redo: pop from redoStack, push current state to undoStack, restore.
   */
  const handleRedo = useCallback(() => {
    if (isLockedRef.current) return;
    if (!canRedo()) return;

    const currentSnapshot = buildCurrentSnapshot("Add Table");
    const snapshotToRestore = redoFromStore(currentSnapshot);

    if (snapshotToRestore) {
      restoreSnapshot(snapshotToRestore);
    }
  }, [canRedo, redoFromStore, restoreSnapshot]);

  /**
   * Register keyboard shortcuts: Ctrl+Z for undo, Ctrl+Y / Ctrl+Shift+Z for redo.
   * Uses Cmd key on macOS for standard platform behavior.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (!isCtrlOrCmd) return;

      if (event.key === "z" || event.key === "Z") {
        if (event.shiftKey) {
          // Ctrl+Shift+Z = Redo
          event.preventDefault();
          handleRedo();
        } else {
          // Ctrl+Z = Undo
          event.preventDefault();
          handleUndo();
        }
      } else if (event.key === "y" || event.key === "Y") {
        // Ctrl+Y = Redo
        if (!event.shiftKey) {
          event.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  /**
   * Clear history when the session page unmounts.
   */
  useEffect(() => {
    return () => {
      clearHistory();
    };
  }, [clearHistory]);

  /**
   * Clear history when sessionId changes (switching sessions).
   */
  useEffect(() => {
    clearHistory();
  }, [sessionId, clearHistory]);

  return {
    captureSnapshot,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  };
}
