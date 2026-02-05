// store/colorModeStore.ts
// Zustand store for managing color mode (standard vs colorblind)
// UPDATED: Added skipHydration and _hasHydrated for SSR compatibility

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ColorMode,
  ColorScheme,
  getColorScheme,
  STANDARD_COLORS,
  COLORBLIND_COLORS,
} from '@/utils/colorConfig';

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface ColorModeState {
  // Current color mode
  colorMode: ColorMode;
  
  // Computed color scheme based on mode
  colorScheme: ColorScheme;
  
  // Hydration tracking for SSR
  _hasHydrated: boolean;
  
  // Actions
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
  isColorblindMode: () => boolean;
  setHasHydrated: (state: boolean) => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useColorModeStore = create<ColorModeState>()(
  persist(
    (set, get) => ({
      // Initial state
      colorMode: 'standard',
      colorScheme: STANDARD_COLORS,
      _hasHydrated: false,
      
      // Set color mode
      setColorMode: (mode: ColorMode) => {
        set({
          colorMode: mode,
          colorScheme: getColorScheme(mode),
        });
      },
      
      // Toggle between modes
      toggleColorMode: () => {
        const currentMode = get().colorMode;
        const newMode: ColorMode = currentMode === 'standard' ? 'colorblind' : 'standard';
        set({
          colorMode: newMode,
          colorScheme: getColorScheme(newMode),
        });
      },
      
      // Check if colorblind mode is active
      isColorblindMode: () => get().colorMode === 'colorblind',
      
      // Set hydration state
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
    }),
    {
      name: 'color-mode-storage', // localStorage key
      // CRITICAL: Skip automatic hydration to prevent SSR mismatch
      skipHydration: true,
      partialize: (state) => ({ colorMode: state.colorMode }), // Only persist the mode
      onRehydrateStorage: () => (state) => {
        // Recompute colorScheme on rehydration
        if (state) {
          state.colorScheme = getColorScheme(state.colorMode);
          state.setHasHydrated(true);
        }
      },
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

// Get just the color scheme (most commonly used)
export const useColorScheme = () => useColorModeStore((state) => state.colorScheme);

// Get just the color mode
export const useColorMode = () => useColorModeStore((state) => state.colorMode);

// Get toggle function
export const useToggleColorMode = () => useColorModeStore((state) => state.toggleColorMode);

// Get hydration state
export const useColorModeHydration = () => useColorModeStore((state) => state._hasHydrated);

// ============================================================================
// NON-REACTIVE GETTERS (for use outside React components)
// ============================================================================

export const getColorModeState = () => useColorModeStore.getState();
export const getCurrentColorScheme = () => useColorModeStore.getState().colorScheme;
export const getCurrentColorMode = () => useColorModeStore.getState().colorMode;