// utils/colorConfig.ts
// Centralized color configuration for table-related SVG components
// Includes standard and colorblind-friendly color schemes

// ============================================================================
// COLOR MODE TYPES
// ============================================================================

export type ColorMode = 'standard' | 'colorblind';

export interface SeatColors {
  // Seat mode colors (fill)
  defaultFill: string;
  hostOnlyFill: string;
  externalOnlyFill: string;
  lockedFill: string;
  selectedFill: string;
  assignedFill: string;
  
  // Seat mode strokes
  defaultStroke: string;
  hostOnlyStroke: string;
  externalOnlyStroke: string;
  lockedStroke: string;
  selectedStroke: string;
  assignedStroke: string;
}

export interface GuestBoxColors {
  // Host guest box
  hostFill: string;
  hostStroke: string;
  hostText: string;
  
  // External guest box
  externalFill: string;
  externalStroke: string;
  externalText: string;
}

export interface TableColors {
  // Table shape
  tableFill: string;
  tableSelectedFill: string;
  tableStroke: string;
  tableText: string;
}

export interface UIColors {
  // General UI colors
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // VIP stars
  starsColor: string;
  
  // Meal plan
  mealPlanText: string;
  mealPlanIcon: string;
  
  // Connector lines
  connectorLine: string;
  
  // Meta text (country | company)
  metaText: string;
}

export interface ColorScheme {
  mode: ColorMode;
  seats: SeatColors;
  guestBox: GuestBoxColors;
  table: TableColors;
  ui: UIColors;
}

// ============================================================================
// STANDARD COLOR SCHEME
// Professional, polished colors with good contrast
// ============================================================================

export const STANDARD_COLORS: ColorScheme = {
  mode: 'standard',
  
  seats: {
    // Default mode - Green (available for anyone)
    defaultFill: '#e8f5e9',      // Light green
    defaultStroke: '#4caf50',    // Green
    
    // Host-only mode - Blue
    hostOnlyFill: '#e3f2fd',     // Light blue
    hostOnlyStroke: '#1976d2',   // Blue
    
    // External-only mode - Red
    externalOnlyFill: '#ffebee', // Light red
    externalOnlyStroke: '#d32f2f', // Red
    
    // Locked - Grey
    lockedFill: '#eceff1',       // Light grey
    lockedStroke: '#78909c',     // Blue grey
    
    // Selected - Yellow
    selectedFill: '#fff8e1',     // Light amber
    selectedStroke: '#ffc107',   // Amber
    
    // Assigned (has guest) - Darker green
    assignedFill: '#c8e6c9',     // Medium green
    assignedStroke: '#388e3c',   // Dark green
  },
  
  guestBox: {
    // Host guests - Blue theme
    hostFill: '#e3f2fd',         // Light blue
    hostStroke: '#1976d2',       // Blue
    hostText: '#0d47a1',         // Dark blue
    
    // External guests - Red theme
    externalFill: '#ffebee',     // Light red
    externalStroke: '#d32f2f',   // Red
    externalText: '#b71c1c',     // Dark red
  },
  
  table: {
    tableFill: '#1976d2',        // Blue
    tableSelectedFill: '#1565c0', // Darker blue
    tableStroke: '#0d47a1',      // Dark blue
    tableText: '#ffffff',        // White
  },
  
  ui: {
    primary: '#1976d2',
    secondary: '#9c27b0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#d32f2f',
    info: '#0288d1',
    
    starsColor: '#f59e0b',       // Amber/gold for VIP stars
    mealPlanText: '#2e7d32',     // Green
    mealPlanIcon: '#4caf50',     // Green
    connectorLine: '#90a4ae',    // Blue grey
    metaText: '#546e7a',         // Blue grey
  },
};

// ============================================================================
// COLORBLIND-FRIENDLY COLOR SCHEME
// Uses patterns and shapes in addition to color differences
// Based on Wong's colorblind-safe palette
// ============================================================================

export const COLORBLIND_COLORS: ColorScheme = {
  mode: 'colorblind',
  
  seats: {
    // Default mode - Teal (distinct from blue/orange)
    defaultFill: '#e0f2f1',      // Light teal
    defaultStroke: '#009688',    // Teal
    
    // Host-only mode - Blue (safe for most colorblind types)
    hostOnlyFill: '#e3f2fd',     // Light blue
    hostOnlyStroke: '#0077bb',   // Strong blue
    
    // External-only mode - Orange (instead of red, better for colorblind)
    externalOnlyFill: '#fff3e0', // Light orange
    externalOnlyStroke: '#ee7733', // Orange
    
    // Locked - Grey with pattern
    lockedFill: '#e0e0e0',       // Light grey
    lockedStroke: '#616161',     // Dark grey
    
    // Selected - Yellow (safe for all)
    selectedFill: '#fff9c4',     // Light yellow
    selectedStroke: '#f9a825',   // Amber
    
    // Assigned - Dark teal
    assignedFill: '#b2dfdb',     // Medium teal
    assignedStroke: '#00796b',   // Dark teal
  },
  
  guestBox: {
    // Host guests - Blue theme (safe)
    hostFill: '#e3f2fd',         // Light blue
    hostStroke: '#0077bb',       // Strong blue
    hostText: '#004488',         // Dark blue
    
    // External guests - Orange theme (instead of red)
    externalFill: '#fff3e0',     // Light orange
    externalStroke: '#ee7733',   // Orange
    externalText: '#cc5500',     // Dark orange
  },
  
  table: {
    tableFill: '#0077bb',        // Strong blue
    tableSelectedFill: '#005588', // Darker blue
    tableStroke: '#004488',      // Dark blue
    tableText: '#ffffff',        // White
  },
  
  ui: {
    primary: '#0077bb',          // Blue
    secondary: '#882288',        // Purple
    success: '#009988',          // Teal
    warning: '#ee7733',          // Orange
    error: '#cc3311',            // Red-orange
    info: '#33bbee',             // Cyan
    
    starsColor: '#ddaa33',       // Yellow-gold for VIP stars
    mealPlanText: '#009988',     // Teal
    mealPlanIcon: '#009988',     // Teal
    connectorLine: '#888888',    // Grey
    metaText: '#555555',         // Dark grey
  },
};

// ============================================================================
// COLOR SCHEME GETTER
// ============================================================================

export function getColorScheme(mode: ColorMode): ColorScheme {
  return mode === 'colorblind' ? COLORBLIND_COLORS : STANDARD_COLORS;
}

// ============================================================================
// SEAT COLOR HELPERS
// These functions return the appropriate color based on seat state
// ============================================================================

export interface SeatColorParams {
  mode: 'default' | 'host-only' | 'external-only';
  isLocked: boolean;
  isSelected: boolean;
  isAssigned: boolean;
}

export function getSeatFillColor(
  params: SeatColorParams,
  colorScheme: ColorScheme
): string {
  const { mode, isLocked, isSelected, isAssigned } = params;
  const { seats } = colorScheme;
  
  // Priority order: locked > selected > assigned > mode
  if (isLocked) return seats.lockedFill;
  if (isSelected) return seats.selectedFill;
  if (isAssigned) return seats.assignedFill;
  
  switch (mode) {
    case 'host-only':
      return seats.hostOnlyFill;
    case 'external-only':
      return seats.externalOnlyFill;
    default:
      return seats.defaultFill;
  }
}

export function getSeatStrokeColor(
  params: SeatColorParams,
  colorScheme: ColorScheme
): string {
  const { mode, isLocked, isSelected, isAssigned } = params;
  const { seats } = colorScheme;
  
  // Priority order: locked > selected > assigned > mode
  if (isLocked) return seats.lockedStroke;
  if (isSelected) return seats.selectedStroke;
  if (isAssigned) return seats.assignedStroke;
  
  switch (mode) {
    case 'host-only':
      return seats.hostOnlyStroke;
    case 'external-only':
      return seats.externalOnlyStroke;
    default:
      return seats.defaultStroke;
  }
}

// ============================================================================
// GUEST BOX COLOR HELPERS
// ============================================================================

export function getGuestBoxColors(
  isHost: boolean,
  colorScheme: ColorScheme
): { fill: string; stroke: string; text: string } {
  const { guestBox } = colorScheme;
  
  return isHost
    ? {
        fill: guestBox.hostFill,
        stroke: guestBox.hostStroke,
        text: guestBox.hostText,
      }
    : {
        fill: guestBox.externalFill,
        stroke: guestBox.externalStroke,
        text: guestBox.externalText,
      };
}

// ============================================================================
// STROKE PATTERNS
// Used to differentiate seat modes for colorblind accessibility
// ============================================================================

export function getSeatStrokeDashArray(
  mode: 'default' | 'host-only' | 'external-only',
  colorMode: ColorMode
): string {
  // In colorblind mode, use patterns to help differentiate
  if (colorMode === 'colorblind') {
    switch (mode) {
      case 'external-only':
        return '4,2';  // Dashed for external
      case 'host-only':
        return '1,0';  // Solid for host
      default:
        return '1,0';  // Solid for default
    }
  }
  
  // In standard mode, only external-only is dashed
  return mode === 'external-only' ? '4,2' : 'none';
}

// ============================================================================
// STROKE WIDTH
// Slightly thicker strokes in colorblind mode for better visibility
// ============================================================================

export function getSeatStrokeWidth(colorMode: ColorMode): number {
  return colorMode === 'colorblind' ? 2.5 : 2;
}

// ============================================================================
// CSS CUSTOM PROPERTIES GENERATOR
// Generate CSS variables for use throughout the app
// ============================================================================

export function generateCSSVariables(colorScheme: ColorScheme): Record<string, string> {
  return {
    // Seat colors
    '--seat-default-fill': colorScheme.seats.defaultFill,
    '--seat-default-stroke': colorScheme.seats.defaultStroke,
    '--seat-host-fill': colorScheme.seats.hostOnlyFill,
    '--seat-host-stroke': colorScheme.seats.hostOnlyStroke,
    '--seat-external-fill': colorScheme.seats.externalOnlyFill,
    '--seat-external-stroke': colorScheme.seats.externalOnlyStroke,
    '--seat-locked-fill': colorScheme.seats.lockedFill,
    '--seat-locked-stroke': colorScheme.seats.lockedStroke,
    '--seat-selected-fill': colorScheme.seats.selectedFill,
    '--seat-selected-stroke': colorScheme.seats.selectedStroke,
    '--seat-assigned-fill': colorScheme.seats.assignedFill,
    '--seat-assigned-stroke': colorScheme.seats.assignedStroke,
    
    // Guest box colors
    '--guest-host-fill': colorScheme.guestBox.hostFill,
    '--guest-host-stroke': colorScheme.guestBox.hostStroke,
    '--guest-host-text': colorScheme.guestBox.hostText,
    '--guest-external-fill': colorScheme.guestBox.externalFill,
    '--guest-external-stroke': colorScheme.guestBox.externalStroke,
    '--guest-external-text': colorScheme.guestBox.externalText,
    
    // Table colors
    '--table-fill': colorScheme.table.tableFill,
    '--table-selected-fill': colorScheme.table.tableSelectedFill,
    '--table-stroke': colorScheme.table.tableStroke,
    '--table-text': colorScheme.table.tableText,
    
    // UI colors
    '--color-primary': colorScheme.ui.primary,
    '--color-secondary': colorScheme.ui.secondary,
    '--color-success': colorScheme.ui.success,
    '--color-warning': colorScheme.ui.warning,
    '--color-error': colorScheme.ui.error,
    '--color-info': colorScheme.ui.info,
    '--color-stars': colorScheme.ui.starsColor,
    '--color-meal-plan': colorScheme.ui.mealPlanText,
    '--color-connector': colorScheme.ui.connectorLine,
    '--color-meta-text': colorScheme.ui.metaText,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  STANDARD_COLORS,
  COLORBLIND_COLORS,
  getColorScheme,
  getSeatFillColor,
  getSeatStrokeColor,
  getGuestBoxColors,
  getSeatStrokeDashArray,
  getSeatStrokeWidth,
  generateCSSVariables,
};