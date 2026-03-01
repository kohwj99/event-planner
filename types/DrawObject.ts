/**
 * Supported draw object shapes.
 * Extensible: add new shape types to this union and register them in drawShapeRegistry.ts.
 */
export type DrawObjectShape = "rectangle" | "ellipse" | "line" | "textbox";

/**
 * Visual style for a draw object.
 * Use 'transparent' for fillColor/strokeColor to render as SVG fill="none"/stroke="none".
 */
export interface DrawObjectStyle {
  /** Fill color (hex string or 'transparent') */
  fillColor: string;
  /** Fill opacity 0-1 (0 = fully transparent) */
  fillOpacity: number;
  /** Stroke/outline color (hex string or 'transparent') */
  strokeColor: string;
  /** Stroke width in pixels */
  strokeWidth: number;
  /** Stroke opacity 0-1 (0 = fully transparent) */
  strokeOpacity: number;
}

/**
 * Text content and formatting for a draw object.
 */
export interface DrawObjectText {
  content: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
  color: string;
}

/**
 * A drawable object on the canvas draw layer.
 * All coordinates are in world space (same coordinate system as tables).
 */
export interface DrawObject {
  id: string;
  shape: DrawObjectShape;

  /** Top-left X coordinate (or start X for lines) */
  x: number;
  /** Top-left Y coordinate (or start Y for lines) */
  y: number;

  /** Width of the bounding box */
  width: number;
  /** Height of the bounding box */
  height: number;

  /** Rotation in degrees (reserved for future use) */
  rotation: number;

  /** Visual style (fill, stroke) */
  style: DrawObjectStyle;

  /** Optional text content rendered inside the shape */
  text?: DrawObjectText;

  /** Z-index ordering within draw layer (lower = further back) */
  zIndex: number;
}

/**
 * Default style applied to newly created draw objects.
 */
export const DEFAULT_DRAW_STYLE: DrawObjectStyle = {
  fillColor: "#e3f2fd",
  fillOpacity: 0.5,
  strokeColor: "#1565c0",
  strokeWidth: 2,
  strokeOpacity: 1,
};

/**
 * Default text configuration for draw objects that support text.
 */
export const DEFAULT_DRAW_TEXT: DrawObjectText = {
  content: "",
  fontSize: 14,
  fontWeight: "normal",
  textAlign: "center",
  color: "#212121",
};
