"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { HistoryActionLabel } from "@/store/historyStore";

type CaptureSnapshotFn = (
  label: HistoryActionLabel,
  includeRulesConfig?: boolean
) => void;

const UndoRedoContext = createContext<CaptureSnapshotFn | null>(null);

interface UndoRedoProviderProps {
  captureSnapshot: CaptureSnapshotFn;
  children: ReactNode;
}

export function UndoRedoProvider({
  captureSnapshot,
  children,
}: UndoRedoProviderProps) {
  return (
    <UndoRedoContext.Provider value={captureSnapshot}>
      {children}
    </UndoRedoContext.Provider>
  );
}

/**
 * Hook to access captureSnapshot from the UndoRedo context.
 * Returns a no-op function if used outside the provider (safety fallback).
 */
export function useCaptureSnapshot(): CaptureSnapshotFn {
  const ctx = useContext(UndoRedoContext);
  if (!ctx) {
    return () => {};
  }
  return ctx;
}
