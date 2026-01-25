// types/DrawingShape.ts
// Type definitions for the drawing layer feature
// Shapes that can be drawn on top of the seat planning canvas

/**
 * Available drawing shape types
 */
export type DrawingShapeType = 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'line';

/**
 * Text alignment options for shapes with text
 */
export type TextAlignment = 'left' | 'center' | 'right';

/**
 * A single drawing shape on the canvas
 * All properties are required to prevent undefined values causing render issues
 */
export interface DrawingShape {
  /** Unique identifier */
  id: string;
  
  /** Type of shape */
  type: DrawingShapeType;
  
  /** Position in world coordinates (same as table coordinates) */
  x: number;
  y: number;
  
  /** Dimensions for rectangle, ellipse, diamond */
  width: number;
  height: number;
  
  /** For arrows/lines: end point coordinates relative to (x,y) */
  endX: number;
  endY: number;
  
  /** Styling */
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  
  /** Text content */
  text: string;
  fontSize: number;
  fontBold: boolean;
  textAlign: TextAlignment;
  textColor: string;
  
  /** Z-index for layering (higher = on top) */
  zIndex: number;
  
  /** Rotation in degrees (for future use) */
  rotation: number;
}

/**
 * State for the drawing layer (stored per session)
 */
export interface DrawingLayerState {
  shapes: DrawingShape[];
  nextZIndex: number;
  version: number;
}

/**
 * Default empty drawing layer state
 */
export const DEFAULT_DRAWING_LAYER_STATE: DrawingLayerState = {
  shapes: [],
  nextZIndex: 1,
  version: 1,
};

/**
 * Generate a unique shape ID
 */
function generateShapeId(): string {
  return `shape_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a default shape with ALL properties properly initialized
 */
export function createDefaultShape(
  type: DrawingShapeType,
  x: number,
  y: number,
  zIndex: number,
  color: string = '#9C27B0'
): DrawingShape {
  // Base properties shared by all shapes
  const baseProps = {
    id: generateShapeId(),
    type,
    x: x || 200,
    y: y || 200,
    zIndex: zIndex || 1,
    text: '',
    fontSize: 14,
    fontBold: false,
    textAlign: 'center' as TextAlignment,
    textColor: '#ffffff',
    rotation: 0,
  };
  
  // Type-specific properties
  switch (type) {
    case 'line':
      return {
        ...baseProps,
        width: 0,
        height: 0,
        endX: 100,
        endY: 0,
        fillColor: 'transparent',
        strokeColor: color,
        strokeWidth: 2,
        opacity: 1,
      };
      
    case 'arrow':
      return {
        ...baseProps,
        width: 0,
        height: 0,
        endX: 100,
        endY: 0,
        fillColor: 'transparent',
        strokeColor: color,
        strokeWidth: 2,
        opacity: 1,
      };
      
    case 'ellipse':
      return {
        ...baseProps,
        width: 120,
        height: 80,
        endX: 0,
        endY: 0,
        fillColor: color,
        strokeColor: color,
        strokeWidth: 2,
        opacity: 0.85,
      };
      
    case 'diamond':
      return {
        ...baseProps,
        width: 100,
        height: 100,
        endX: 0,
        endY: 0,
        fillColor: color,
        strokeColor: color,
        strokeWidth: 2,
        opacity: 0.85,
      };
      
    case 'rectangle':
    default:
      return {
        ...baseProps,
        type: 'rectangle', // Ensure type is set
        width: 120,
        height: 80,
        endX: 0,
        endY: 0,
        fillColor: color,
        strokeColor: color,
        strokeWidth: 2,
        opacity: 0.85,
      };
  }
}

/**
 * Validate and fix a shape to ensure all properties have valid values
 * Used when loading shapes from storage
 */
export function validateShape(shape: Partial<DrawingShape>): DrawingShape {
  const defaults = createDefaultShape(
    shape.type || 'rectangle',
    shape.x ?? 200,
    shape.y ?? 200,
    shape.zIndex ?? 1,
    shape.fillColor || '#9C27B0'
  );
  
  return {
    ...defaults,
    ...shape,
    // Ensure critical properties are never undefined
    id: shape.id || defaults.id,
    type: shape.type || 'rectangle',
    x: typeof shape.x === 'number' ? shape.x : defaults.x,
    y: typeof shape.y === 'number' ? shape.y : defaults.y,
    width: typeof shape.width === 'number' && shape.width > 0 ? shape.width : defaults.width,
    height: typeof shape.height === 'number' && shape.height > 0 ? shape.height : defaults.height,
    endX: typeof shape.endX === 'number' ? shape.endX : defaults.endX,
    endY: typeof shape.endY === 'number' ? shape.endY : defaults.endY,
    fillColor: shape.fillColor || defaults.fillColor,
    strokeColor: shape.strokeColor || defaults.strokeColor,
    strokeWidth: typeof shape.strokeWidth === 'number' ? shape.strokeWidth : defaults.strokeWidth,
    opacity: typeof shape.opacity === 'number' ? shape.opacity : defaults.opacity,
    zIndex: typeof shape.zIndex === 'number' ? shape.zIndex : defaults.zIndex,
    text: shape.text ?? '',
    fontSize: typeof shape.fontSize === 'number' ? shape.fontSize : defaults.fontSize,
    fontBold: typeof shape.fontBold === 'boolean' ? shape.fontBold : defaults.fontBold,
    textAlign: shape.textAlign || defaults.textAlign,
    textColor: shape.textColor || defaults.textColor,
    rotation: typeof shape.rotation === 'number' ? shape.rotation : 0,
  };
}