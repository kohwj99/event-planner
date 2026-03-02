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
  // Mode colors (stroke always shows mode)
  defaultStroke: string;
  hostOnlyStroke: string;
  externalOnlyStroke: string;
  
  // Mode fill colors (when empty/unassigned)
  defaultFill: string;
  hostOnlyFill: string;
  externalOnlyFill: string;
  
  // State overlays (applied on top of mode colors)
  assignedOverlay: string;      // Darkens/saturates the mode fill
  selectedFill: string;         // Yellow - overrides mode fill
  selectedStroke: string;       // Yellow stroke
  lockedFill: string;           // Grey - overrides mode fill
  lockedStroke: string;         // Grey stroke
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

  return {
    mode: 'standard',
    
    seats: {
      // Mode strokes (ALWAYS visible - indicates what type of guest can sit here)
      defaultStroke: defaultGreen,
      hostOnlyStroke: hostBlue,
      externalOnlyStroke: externalRed,
      
      // Mode fills (when empty/unassigned - light version of mode color)
      defaultFill: generateLightFill(defaultGreen),
      hostOnlyFill: generateLightFill(hostBlue),
      externalOnlyFill: generateLightFill(externalRed),
      
      // State colors
      assignedOverlay: '0.35',   // Opacity multiplier - darkens the mode fill
      selectedFill: generateLightFill(selectedYellow, 0.88),
      selectedStroke: selectedYellow,
      lockedFill: generateLightFill(lockedGrey, 0.85),
      lockedStroke: lockedGrey,
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

  return {
    mode: 'colorblind',
    
    seats: {
      // Mode strokes (ALWAYS visible - indicates what type of guest can sit here)
      defaultStroke: defaultTeal,
      hostOnlyStroke: hostBlue,
      externalOnlyStroke: externalOrange,
      
      // Mode fills (when empty/unassigned - light version of mode color)
      defaultFill: generateLightFill(defaultTeal),
      hostOnlyFill: generateLightFill(hostBlue),
      externalOnlyFill: generateLightFill(externalOrange),
      
      // State colors
      assignedOverlay: '0.35',   // Opacity multiplier - darkens the mode fill
      selectedFill: generateLightFill(selectedYellow, 0.85),
      selectedStroke: chroma(selectedYellow).darken(1).hex(),
      lockedFill: generateLightFill(lockedGrey, 0.85),
      lockedStroke: lockedGrey,
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
// 
// DESIGN PRINCIPLE:
// - STROKE = Always shows seat MODE (what type of guest can sit here)
//   - Default: green solid 2px
//   - Host-only: blue solid 3.5px (thicker = restricted)
//   - External-only: red/orange dashed 2.5px
//
// - FILL = Shows seat STATE (empty, assigned, selected, locked)
//   - Empty: white (neutral - mode shown by stroke)
//   - Assigned: light mode color (blue/green/red tint)
//   - Selected: yellow (override)
//   - Locked: grey (override)
// ============================================================================

export interface SeatColorParams {
  mode: 'default' | 'host-only' | 'external-only';
  isLocked: boolean;
  isSelected: boolean;
  isAssigned: boolean;
}

/**
 * Get the mode stroke color - ALWAYS based on mode, never state
 */
function getModeStrokeColor(mode: 'default' | 'host-only' | 'external-only', seats: SeatColors): string {
  switch (mode) {
    case 'host-only':
      return seats.hostOnlyStroke;
    case 'external-only':
      return seats.externalOnlyStroke;
    default:
      return seats.defaultStroke;
  }
}

/**
 * Get the mode fill color (for assigned state)
 */
function getModeFillColor(mode: 'default' | 'host-only' | 'external-only', seats: SeatColors): string {
  switch (mode) {
    case 'host-only':
      return seats.hostOnlyFill;
    case 'external-only':
      return seats.externalOnlyFill;
    default:
      return seats.defaultFill;
  }
}

/**
 * Get seat FILL color based on state
 * 
 * Priority: locked > selected > assigned > empty
 * - Locked: Grey (overrides everything)
 * - Selected: Yellow (overrides assigned/empty)
 * - Assigned: Light mode color (shows both mode AND assigned state)
 * - Empty: White (mode shown by stroke only)
 */
export function getSeatFillColor(
  params: SeatColorParams,
  colorScheme: ColorScheme
): string {
  const { mode, isLocked, isSelected, isAssigned } = params;
  const { seats } = colorScheme;
  
  // Locked: grey fill (overrides everything)
  if (isLocked) return seats.lockedFill;
  
  // Selected: yellow fill
  if (isSelected) return seats.selectedFill;
  
  // Assigned: light mode color fill (shows mode info!)
  if (isAssigned) return getModeFillColor(mode, seats);
  
  // Empty: white/neutral fill (mode shown by stroke only)
  return '#ffffff';
}

/**
 * Get seat STROKE color based on mode
 * 
 * STROKE ALWAYS SHOWS THE MODE - this is the key principle!
 * Only locked/selected override the stroke color.
 */
export function getSeatStrokeColor(
  params: SeatColorParams,
  colorScheme: ColorScheme
): string {
  const { mode, isLocked, isSelected } = params;
  const { seats } = colorScheme;
  
  // Locked: grey stroke
  if (isLocked) return seats.lockedStroke;
  
  // Selected: keep mode stroke but can optionally highlight
  // Actually, let's keep mode stroke even when selected for clarity
  if (isSelected) return getModeStrokeColor(mode, seats);
  
  // All other cases: mode stroke color
  return getModeStrokeColor(mode, seats);
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
// STROKE PATTERNS & WIDTHS
// Different modes have different visual treatments for accessibility
// ============================================================================

export function getSeatStrokeDashArray(
  mode: 'default' | 'host-only' | 'external-only',
  colorMode: ColorMode
): string {
  // External-only always dashed for extra differentiation
  return mode === 'external-only' ? '5,3' : 'none';
}

/**
 * Get stroke width based on seat mode
 * Host-only is thicker to indicate restriction
 */
export function getSeatStrokeWidth(
  mode: 'default' | 'host-only' | 'external-only',
  colorMode: ColorMode
): number {
  const baseWidth = colorMode === 'colorblind' ? 0.5 : 0; // Extra width in colorblind mode
  
  switch (mode) {
    case 'host-only':
      return 3.5 + baseWidth;  // Thickest - most restricted
    case 'external-only':
      return 2.5 + baseWidth;  // Medium + dashed
    default:
      return 2 + baseWidth;    // Standard
  }
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
// TAG PILL COLORS
// ============================================================================

const TAG_PILL_PALETTE = [
  '#5C6BC0', // indigo
  '#26A69A', // teal
  '#7E57C2', // deep purple
  '#42A5F5', // blue
  '#66BB6A', // green
  '#EF5350', // red
  '#FFA726', // orange
  '#EC407A', // pink
  '#78909C', // blue-grey
  '#8D6E63', // brown
  '#AB47BC', // purple
  '#29B6F6', // light blue
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic pill background color for a tag string.
 * Same tag always gets the same color.
 */
export function getTagPillColor(tag: string): string {
  const index = hashString(tag) % TAG_PILL_PALETTE.length;
  return TAG_PILL_PALETTE[index];
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