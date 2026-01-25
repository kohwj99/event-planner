// utils/drawingColorConfig.ts
// Color configuration for the drawing layer
// Uses colors that DON'T clash with existing seat planning colors:
// - Host colors: Blue family (avoid blue)
// - External colors: Red/Orange family (avoid red, orange)
// - Default/Table colors: Green/Teal/Gray (avoid green, teal)
//
// Drawing layer uses: Purple, Pink, Indigo, Brown, Deep Gray, Cyan, Amber

/**
 * Standard mode colors for drawing shapes
 * These are distinct from the seat planning palette
 */
export const DRAWING_COLORS_STANDARD = [
  { name: 'Purple', value: '#9C27B0', text: '#ffffff' },
  { name: 'Indigo', value: '#3F51B5', text: '#ffffff' },
  { name: 'Pink', value: '#E91E63', text: '#ffffff' },
  { name: 'Brown', value: '#795548', text: '#ffffff' },
  { name: 'Deep Gray', value: '#455A64', text: '#ffffff' },
  { name: 'Cyan', value: '#00BCD4', text: '#000000' },
  { name: 'Amber', value: '#FFC107', text: '#000000' },
  { name: 'Lime', value: '#CDDC39', text: '#000000' },
];

/**
 * Colorblind-safe colors for drawing shapes
 * Based on Okabe-Ito and IBM Design palettes
 * Avoids confusion with the seat planning colorblind palette
 */
export const DRAWING_COLORS_COLORBLIND = [
  { name: 'Purple', value: '#785EF0', text: '#ffffff' },       // IBM Purple
  { name: 'Magenta', value: '#DC267F', text: '#ffffff' },      // IBM Magenta
  { name: 'Reddish Purple', value: '#CC79A7', text: '#000000' }, // Okabe-Ito
  { name: 'Sky Blue', value: '#56B4E9', text: '#000000' },     // Okabe-Ito
  { name: 'Vermilion', value: '#D55E00', text: '#ffffff' },    // Okabe-Ito
  { name: 'Blue', value: '#648FFF', text: '#000000' },         // IBM Blue
];

/**
 * Get the appropriate color palette based on color mode
 */
export function getDrawingColors(isColorblindMode: boolean) {
  return isColorblindMode ? DRAWING_COLORS_COLORBLIND : DRAWING_COLORS_STANDARD;
}

/**
 * Get default drawing color for new shapes
 */
export function getDefaultDrawingColor(isColorblindMode: boolean) {
  const colors = getDrawingColors(isColorblindMode);
  return colors[0]; // Purple in both modes
}

/**
 * Shape preset styles
 */
export const SHAPE_PRESETS = {
  solid: {
    strokeWidth: 2,
    opacity: 0.8,
  },
  thick: {
    strokeWidth: 4,
    opacity: 0.9,
  },
  thin: {
    strokeWidth: 1,
    opacity: 0.7,
  },
  dashed: {
    strokeWidth: 2,
    opacity: 0.8,
    // Note: dashed is handled in SVG via stroke-dasharray
  },
  dotted: {
    strokeWidth: 2,
    opacity: 0.8,
  },
  transparent: {
    strokeWidth: 2,
    opacity: 0.3,
  },
};

/**
 * Font size options for shape text
 */
export const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24];

/**
 * Default font size
 */
export const DEFAULT_FONT_SIZE = 14;