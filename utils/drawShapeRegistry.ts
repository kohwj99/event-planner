import { DrawObject, DrawObjectShape } from "@/types/DrawObject";

/**
 * Configuration for how a shape is rendered and created.
 * To add a new shape, call registerShape() with a ShapeRendererConfig.
 */
export interface ShapeRendererConfig {
  /** Label shown in tool picker UI */
  label: string;
  /** MUI icon name (component resolved in UI layer) */
  iconName: string;
  /** Minimum width when creating via click-drag */
  minWidth: number;
  /** Minimum height when creating via click-drag */
  minHeight: number;
  /** Whether this shape supports text content */
  supportsText: boolean;
  /**
   * Render SVG elements for this shape into a parent <g> element.
   * Called by the D3 data-join in the SVG helper.
   *
   * @param g - The parent SVG group element (already positioned via transform)
   * @param obj - The draw object data
   * @param isSelected - Whether the object is currently selected
   */
  render: (
    g: SVGGElement,
    obj: DrawObject,
    isSelected: boolean,
  ) => void;
}

/** Internal registry map */
const registry = new Map<DrawObjectShape, ShapeRendererConfig>();

/**
 * Register a new shape type. Call this to make a shape available in the
 * draw tool picker and rendering pipeline.
 */
export function registerShape(
  shape: DrawObjectShape,
  config: ShapeRendererConfig,
): void {
  registry.set(shape, config);
}

/**
 * Get the renderer config for a shape type.
 */
export function getShapeConfig(
  shape: DrawObjectShape,
): ShapeRendererConfig | undefined {
  return registry.get(shape);
}

/**
 * Get all registered shapes (for building the tool picker UI).
 */
export function getAllShapes(): Array<{
  shape: DrawObjectShape;
  config: ShapeRendererConfig;
}> {
  return Array.from(registry.entries()).map(([shape, config]) => ({
    shape,
    config,
  }));
}

/* ====================================================================
 * HELPER: resolve SVG fill/stroke from style values
 * ==================================================================== */

function resolveFill(color: string): string {
  if (color === "transparent") return "none";
  return color;
}

function resolveStroke(color: string): string {
  if (color === "transparent") return "none";
  return color;
}

/* ====================================================================
 * BUILT-IN SHAPES
 * ==================================================================== */

/** Rectangle */
registerShape("rectangle", {
  label: "Rectangle",
  iconName: "CropSquare",
  minWidth: 40,
  minHeight: 30,
  supportsText: true,
  render(g, obj, isSelected) {
    const ns = "http://www.w3.org/2000/svg";

    // Clear previous children
    while (g.firstChild) g.removeChild(g.firstChild);

    // Main rect
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("width", String(obj.width));
    rect.setAttribute("height", String(obj.height));
    rect.setAttribute("fill", resolveFill(obj.style.fillColor));
    rect.setAttribute("fill-opacity", String(obj.style.fillOpacity));
    rect.setAttribute("stroke", resolveStroke(obj.style.strokeColor));
    rect.setAttribute("stroke-width", String(obj.style.strokeWidth));
    rect.setAttribute("stroke-opacity", String(obj.style.strokeOpacity));
    rect.setAttribute("rx", "2");
    g.appendChild(rect);

    // Text
    if (obj.text?.content) {
      renderTextInShape(g, obj);
    }

    // Selection outline
    if (isSelected) {
      renderSelectionOutline(g, obj.width, obj.height);
    }
  },
});

/** Ellipse */
registerShape("ellipse", {
  label: "Ellipse",
  iconName: "CircleOutlined",
  minWidth: 40,
  minHeight: 30,
  supportsText: true,
  render(g, obj, isSelected) {
    const ns = "http://www.w3.org/2000/svg";
    while (g.firstChild) g.removeChild(g.firstChild);

    const rx = obj.width / 2;
    const ry = obj.height / 2;

    const ellipse = document.createElementNS(ns, "ellipse");
    ellipse.setAttribute("cx", String(rx));
    ellipse.setAttribute("cy", String(ry));
    ellipse.setAttribute("rx", String(rx));
    ellipse.setAttribute("ry", String(ry));
    ellipse.setAttribute("fill", resolveFill(obj.style.fillColor));
    ellipse.setAttribute("fill-opacity", String(obj.style.fillOpacity));
    ellipse.setAttribute("stroke", resolveStroke(obj.style.strokeColor));
    ellipse.setAttribute("stroke-width", String(obj.style.strokeWidth));
    ellipse.setAttribute("stroke-opacity", String(obj.style.strokeOpacity));
    g.appendChild(ellipse);

    if (obj.text?.content) {
      renderTextInShape(g, obj);
    }

    if (isSelected) {
      renderSelectionOutline(g, obj.width, obj.height);
    }
  },
});


/* ====================================================================
 * SHARED RENDER HELPERS
 * ==================================================================== */

/**
 * Render text content inside a draw object's bounding box.
 */
function renderTextInShape(g: SVGGElement, obj: DrawObject): void {
  const ns = "http://www.w3.org/2000/svg";
  if (!obj.text?.content) return;

  const text = document.createElementNS(ns, "text");
  text.setAttribute("fill", obj.text.color);
  text.setAttribute("font-size", String(obj.text.fontSize));
  text.setAttribute("font-weight", obj.text.fontWeight);
  text.setAttribute("font-family", "Roboto, sans-serif");
  text.setAttribute("pointer-events", "none");

  // Horizontal alignment
  let anchorX: number;
  let textAnchor: string;
  const padding = 6;
  switch (obj.text.textAlign) {
    case "left":
      anchorX = padding;
      textAnchor = "start";
      break;
    case "right":
      anchorX = obj.width - padding;
      textAnchor = "end";
      break;
    default:
      anchorX = obj.width / 2;
      textAnchor = "middle";
  }
  text.setAttribute("x", String(anchorX));
  text.setAttribute("text-anchor", textAnchor);

  // Split text into lines and create tspan elements
  const lines = obj.text.content.split("\n");
  const lineHeight = obj.text.fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = (obj.height - totalHeight) / 2 + obj.text.fontSize;

  lines.forEach((line, i) => {
    const tspan = document.createElementNS(ns, "tspan");
    tspan.setAttribute("x", String(anchorX));
    tspan.setAttribute("dy", i === 0 ? String(startY) : String(lineHeight));
    tspan.textContent = line;
    text.appendChild(tspan);
  });

  g.appendChild(text);
}

/**
 * Render a dashed selection outline around an object.
 */
function renderSelectionOutline(
  g: SVGGElement,
  width: number,
  height: number,
): void {
  const ns = "http://www.w3.org/2000/svg";
  const outline = document.createElementNS(ns, "rect");
  outline.setAttribute("x", "-2");
  outline.setAttribute("y", "-2");
  outline.setAttribute("width", String(width + 4));
  outline.setAttribute("height", String(height + 4));
  outline.setAttribute("fill", "none");
  outline.setAttribute("stroke", "#1976d2");
  outline.setAttribute("stroke-width", "1.5");
  outline.setAttribute("stroke-dasharray", "6 3");
  outline.setAttribute("pointer-events", "none");
  outline.classList.add("draw-selection-outline");
  g.appendChild(outline);
}
