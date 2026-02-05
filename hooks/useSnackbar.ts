import { useState, useCallback } from "react";

export type SnackbarSeverity = "success" | "error" | "info" | "warning";

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: SnackbarSeverity;
}

export interface UseSnackbarReturn {
  snackbar: SnackbarState;
  showSnackbar: (message: string, severity: SnackbarSeverity) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
  closeSnackbar: () => void;
}

const initialState: SnackbarState = {
  open: false,
  message: "",
  severity: "success"
};

/**
 * Custom hook for managing snackbar notifications
 */
export function useSnackbar(): UseSnackbarReturn {
  const [snackbar, setSnackbar] = useState<SnackbarState>(initialState);

  const showSnackbar = useCallback((message: string, severity: SnackbarSeverity) => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const showSuccess = useCallback((message: string) => {
    showSnackbar(message, "success");
  }, [showSnackbar]);

  const showError = useCallback((message: string) => {
    showSnackbar(message, "error");
  }, [showSnackbar]);

  const showInfo = useCallback((message: string) => {
    showSnackbar(message, "info");
  }, [showSnackbar]);

  const showWarning = useCallback((message: string) => {
    showSnackbar(message, "warning");
  }, [showSnackbar]);

  const closeSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  return {
    snackbar,
    showSnackbar,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    closeSnackbar
  };
}