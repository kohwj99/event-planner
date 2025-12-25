// utils/colorConfig.ts
// Centralized color configuration for table-related SVG components
// Uses chroma-js library for colorblind-safe color generation
// Based on Okabe-Ito and IBM Design palettes - scientifically validated for colorblind accessibility

import chroma from 'chroma-js';

// ============================================================================
// COLOR MODE TYPES
// ============================================================================

export type ColorMode = 'standard' | 'colorblind';

export interface SeatColors {
  defaultFill: string;
  hostOnlyFill: string;
  externalOnlyFill: string;
  lockedFill: string;
  selectedFill: string;
  assignedFill: string;
  defaultStroke: string;
  hostOnlyStroke: string;
  externalOnlyStroke: string;
  lockedStroke: string;
  selectedStroke: string;
  assignedStroke: string;
}

export interface GuestBoxColors {
  hostFill: string;
  hostStroke: string;
  hostText: string;
  externalFill: string;
  externalStroke: string;
  externalText: string;
}

export interface TableColors {
  tableFill: string;
  tableSelectedFill: string;
  tableStroke: string;
  tableText: string;
}

export interface UIColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  starsColor: string;
  mealPlanText: string;
  mealPlanIcon: string;
  connectorLine: string;
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
// OKABE-ITO COLORBLIND-SAFE PALETTE
// Scientific palette designed to be distinguishable by people with all types
// of color vision deficiencies (protanopia, deuteranopia, tritanopia)
// ============================================================================

const OKABE_ITO = {
  black: '#000000',
  orange: '#E69F00',
  skyBlue: '#56B4E9',
  bluishGreen: '#009E73',
  yellow: '#F0E442',
  blue: '#0072B2',
  vermillion: '#D55E00',
  reddishPurple: '#CC79A7',
};

// ============================================================================
// IBM DESIGN COLORBLIND-SAFE PALETTE
// Another scientifically validated palette with good contrast
// ============================================================================

const IBM_PALETTE = {
  blue: '#648FFF',
  purple: '#785EF0',
  magenta: '#DC267F',
  orange: '#FE6100',
  yellow: '#FFB000',
};

// ============================================================================
// HELPER FUNCTIONS USING CHROMA-JS
// ============================================================================

/**
 * Generate a light fill color from a base color
 */
function generateLightFill(baseColor: string, lightness = 0.92): string {
  return chroma(baseColor).luminance(lightness).hex();
}

/**
 * Generate a dark text color that contrasts well with a fill
 */
function generateContrastText(fillColor: string): string {
  const bgLuminance = chroma(fillColor).luminance();
  // Use dark text on light backgrounds, light text on dark
  return bgLuminance > 0.5 
    ? chroma(fillColor).darken(3).saturate(0.5).hex()
    : '#ffffff';
}

/**
 * Ensure minimum contrast ratio for accessibility (WCAG AA = 4.5:1)
 */
function ensureContrast(foreground: string, background: string, minRatio = 4.5): string {
  const contrast = chroma.contrast(foreground, background);
  if (contrast >= minRatio) return foreground;
  
  // Darken or lighten to meet contrast
  const bgLuminance = chroma(background).luminance();
  let adjusted = chroma(foreground);
  
  for (let i = 0; i < 10; i++) {
    if (bgLuminance > 0.5) {
      adjusted = adjusted.darken(0.5);
    } else {
      adjusted = adjusted.brighten(0.5);
    }
    if (chroma.contrast(adjusted.hex(), background) >= minRatio) break;
  }
  
  return adjusted.hex();
}

// ============================================================================
// STANDARD COLOR SCHEME
// Uses traditional colors that most users are familiar with
// ============================================================================

function createStandardColors(): ColorScheme {
  // Standard palette - familiar colors
  const hostBlue = '#1976d2';
  const externalRed = '#d32f2f';
  const defaultGreen = '#4caf50';
  const lockedGrey = '#78909c';
  const selectedYellow = '#ffc107';
  const assignedGreen = '#388e3c';

  return {
    mode: 'standard',
    
    seats: {
      defaultFill: generateLightFill(defaultGreen),
      defaultStroke: defaultGreen,
      hostOnlyFill: generateLightFill(hostBlue),
      hostOnlyStroke: hostBlue,
      externalOnlyFill: generateLightFill(externalRed),
      externalOnlyStroke: externalRed,
      lockedFill: generateLightFill(lockedGrey, 0.88),
      lockedStroke: lockedGrey,
      selectedFill: generateLightFill(selectedYellow, 0.9),
      selectedStroke: selectedYellow,
      assignedFill: generateLightFill(assignedGreen, 0.85),
      assignedStroke: assignedGreen,
    },
    
    guestBox: {
      hostFill: generateLightFill(hostBlue),
      hostStroke: hostBlue,
      hostText: ensureContrast(chroma(hostBlue).darken(1.5).hex(), generateLightFill(hostBlue)),
      externalFill: generateLightFill(externalRed),
      externalStroke: externalRed,
      externalText: ensureContrast(chroma(externalRed).darken(1.5).hex(), generateLightFill(externalRed)),
    },
    
    table: {
      tableFill: hostBlue,
      tableSelectedFill: chroma(hostBlue).darken(0.5).hex(),
      tableStroke: chroma(hostBlue).darken(1).hex(),
      tableText: '#ffffff',
    },
    
    ui: {
      primary: hostBlue,
      secondary: '#9c27b0',
      success: defaultGreen,
      warning: '#ff9800',
      error: externalRed,
      info: '#0288d1',
      starsColor: '#f59e0b',
      mealPlanText: '#2e7d32',
      mealPlanIcon: defaultGreen,
      connectorLine: '#90a4ae',
      metaText: '#546e7a',
    },
  };
}

// ============================================================================
// COLORBLIND-SAFE COLOR SCHEME
// Uses Okabe-Ito palette - designed for all types of color vision deficiency
// ============================================================================

function createColorblindColors(): ColorScheme {
  // Okabe-Ito palette assignments for maximum distinguishability
  const hostBlue = OKABE_ITO.blue;           // #0072B2 - Safe blue
  const externalOrange = OKABE_ITO.vermillion; // #D55E00 - Orange (not red!)
  const defaultTeal = OKABE_ITO.bluishGreen;  // #009E73 - Teal green
  const lockedGrey = chroma('#757575').hex(); // Neutral grey
  const selectedYellow = OKABE_ITO.yellow;    // #F0E442 - Bright yellow
  const assignedGreen = chroma(OKABE_ITO.bluishGreen).darken(0.3).hex();

  return {
    mode: 'colorblind',
    
    seats: {
      defaultFill: generateLightFill(defaultTeal),
      defaultStroke: defaultTeal,
      hostOnlyFill: generateLightFill(hostBlue),
      hostOnlyStroke: hostBlue,
      externalOnlyFill: generateLightFill(externalOrange),
      externalOnlyStroke: externalOrange,
      lockedFill: generateLightFill(lockedGrey, 0.85),
      lockedStroke: lockedGrey,
      selectedFill: generateLightFill(selectedYellow, 0.85),
      selectedStroke: chroma(selectedYellow).darken(1).hex(),
      assignedFill: generateLightFill(assignedGreen, 0.8),
      assignedStroke: assignedGreen,
    },
    
    guestBox: {
      hostFill: generateLightFill(hostBlue),
      hostStroke: hostBlue,
      hostText: ensureContrast(chroma(hostBlue).darken(1.5).hex(), generateLightFill(hostBlue)),
      externalFill: generateLightFill(externalOrange),
      externalStroke: externalOrange,
      externalText: ensureContrast(chroma(externalOrange).darken(1.5).hex(), generateLightFill(externalOrange)),
    },
    
    table: {
      tableFill: hostBlue,
      tableSelectedFill: chroma(hostBlue).darken(0.5).hex(),
      tableStroke: chroma(hostBlue).darken(1).hex(),
      tableText: '#ffffff',
    },
    
    ui: {
      primary: hostBlue,
      secondary: OKABE_ITO.reddishPurple,
      success: defaultTeal,
      warning: OKABE_ITO.orange,
      error: externalOrange,
      info: OKABE_ITO.skyBlue,
      starsColor: OKABE_ITO.orange,
      mealPlanText: chroma(defaultTeal).darken(0.5).hex(),
      mealPlanIcon: defaultTeal,
      connectorLine: '#888888',
      metaText: '#555555',
    },
  };
}

// ============================================================================
// CACHED COLOR SCHEMES (computed once)
// ============================================================================

const STANDARD_COLORS = createStandardColors();
const COLORBLIND_COLORS = createColorblindColors();

// Export for direct access if needed
export { STANDARD_COLORS, COLORBLIND_COLORS };

// ============================================================================
// COLOR SCHEME GETTER
// ============================================================================

export function getColorScheme(mode: ColorMode): ColorScheme {
  return mode === 'colorblind' ? COLORBLIND_COLORS : STANDARD_COLORS;
}

// ============================================================================
// SEAT COLOR HELPERS
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
// ============================================================================

export function getSeatStrokeDashArray(
  mode: 'default' | 'host-only' | 'external-only',
  colorMode: ColorMode
): string {
  // External-only always dashed for extra differentiation
  return mode === 'external-only' ? '4,2' : 'none';
}

export function getSeatStrokeWidth(colorMode: ColorMode): number {
  // Slightly thicker in colorblind mode for better visibility
  return colorMode === 'colorblind' ? 2.5 : 2;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Get contrasting text color for any background
 */
export function getContrastTextColor(backgroundColor: string): string {
  return chroma(backgroundColor).luminance() > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color: string, amount: number): string {
  return chroma(color).brighten(amount).hex();
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color: string, amount: number): string {
  return chroma(color).darken(amount).hex();
}

/**
 * Check if two colors have sufficient contrast (WCAG AA)
 */
export function hasGoodContrast(color1: string, color2: string): boolean {
  return chroma.contrast(color1, color2) >= 4.5;
}

// ============================================================================
// PALETTE INFO (for legend/documentation)
// ============================================================================

export const PALETTE_INFO = {
  standard: {
    name: 'Standard',
    description: 'Traditional color scheme',
    colors: {
      host: 'Blue',
      external: 'Red',
      default: 'Green',
    },
  },
  colorblind: {
    name: 'Colorblind Safe',
    description: 'Okabe-Ito palette - accessible for all color vision types',
    colors: {
      host: 'Blue',
      external: 'Orange',
      default: 'Teal',
    },
  },
};

export default {
  STANDARD_COLORS,
  COLORBLIND_COLORS,
  getColorScheme,
  getSeatFillColor,
  getSeatStrokeColor,
  getGuestBoxColors,
  getSeatStrokeDashArray,
  getSeatStrokeWidth,
  getContrastTextColor,
  lightenColor,
  darkenColor,
  hasGoodContrast,
  PALETTE_INFO,
};