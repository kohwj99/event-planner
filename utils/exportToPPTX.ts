import { useSeatStore } from "@/store/seatStore";
import { CHUNK_WIDTH, CHUNK_HEIGHT } from "@/types/Chunk";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLIDE_WIDTH = 10; // inches (16:9)
const SLIDE_HEIGHT = 5.625; // inches (16:9)
const SCALE =
  Math.min(SLIDE_WIDTH / CHUNK_WIDTH, SLIDE_HEIGHT / CHUNK_HEIGHT) * 0.95;
const MARGIN_X = (SLIDE_WIDTH - CHUNK_WIDTH * SCALE) / 2;
const MARGIN_Y = (SLIDE_HEIGHT - CHUNK_HEIGHT * SCALE) / 2;

/** Minimum shape dimension (inches) — skip shapes smaller than this */
const MIN_SIZE = 0.001;

/** CSS classes that are UI-only artifacts and must not be exported */
const SKIP_CLASSES = new Set([
  "draw-selection-outline",
  "draw-resize-handle",
  "draw-rotation-handle",
  "draw-rotation-line",
  "draw-hit-area",
  "draw-creation-preview",
  "chunk-group",
  "chunk-outline",
  "chunk-label",
  "outside-bg",
]);

/** SVG tags that are structural / non-visual */
const STRUCTURAL_TAGS = new Set([
  "defs",
  "clippath",
  "style",
  "script",
  "title",
  "desc",
  "pattern",
]);

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Convert an RGB/RGBA string (from getComputedStyle) to a 6-char hex code.
 * Returns null for "none", "transparent", or empty values.
 */
function rgbToHex(color: string): string | null {
  if (!color || color === "none" || color === "transparent") return null;
  const values = color.match(/\d+(\.\d+)?/g);
  if (!values || values.length < 3) return null;
  const r = Math.round(parseFloat(values[0]));
  const g = Math.round(parseFloat(values[1]));
  const b = Math.round(parseFloat(values[2]));
  return (
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  ).toUpperCase();
}

/**
 * Build a pptxgenjs-compatible fill object from an SVG element.
 */
function extractFill(
  el: Element
): { color: string; transparency?: number } | { type: "none" } {
  const style = window.getComputedStyle(el);
  const hex = rgbToHex(style.fill);
  if (!hex) return { type: "none" };

  const opacityAttr = el.getAttribute("fill-opacity");
  const opacity = opacityAttr !== null ? parseFloat(opacityAttr) : 1;
  if (opacity <= 0) return { type: "none" };

  const result: { color: string; transparency?: number } = { color: hex };
  if (opacity < 1) {
    result.transparency = Math.round((1 - opacity) * 100);
  }
  return result;
}

/**
 * Build a pptxgenjs-compatible line (stroke) object from an SVG element.
 */
function extractLine(
  el: Element
): { color: string; width: number; dashType?: string } | { type: "none" } {
  const style = window.getComputedStyle(el);
  const hex = rgbToHex(style.stroke);
  if (!hex || style.stroke === "none") return { type: "none" };

  const strokeWidthPx = parseFloat(style.strokeWidth) || 0;
  if (strokeWidthPx <= 0) return { type: "none" };
  const strokePt = Math.max(0.5, strokeWidthPx * SCALE * 72);

  const result: { color: string; width: number; dashType?: string } = {
    color: hex,
    width: strokePt,
  };

  const dashArray = style.strokeDasharray;
  if (dashArray && dashArray !== "none") {
    result.dashType = "dash";
  }
  return result;
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

interface TransformResult {
  tx: number;
  ty: number;
  rotation: number;
}

/**
 * Parse an SVG transform attribute string and extract translate + rotation.
 */
function parseTransform(attr: string | null): TransformResult {
  const result: TransformResult = { tx: 0, ty: 0, rotation: 0 };
  if (!attr) return result;

  const translateMatch = attr.match(
    /translate\(\s*([^,\s)]+)[\s,]+([^)\s]+)\s*\)/
  );
  if (translateMatch) {
    result.tx = parseFloat(translateMatch[1]) || 0;
    result.ty = parseFloat(translateMatch[2]) || 0;
  }

  const rotateMatch = attr.match(/rotate\(\s*([^,\s)]+)/);
  if (rotateMatch) {
    result.rotation = parseFloat(rotateMatch[1]) || 0;
  }

  return result;
}

/**
 * Convert SVG world coordinates to PowerPoint slide position (inches).
 */
function toSlidePos(
  svgX: number,
  svgY: number,
  svgW: number,
  svgH: number,
  chunkX: number,
  chunkY: number,
  accumTx: number,
  accumTy: number
): { x: number; y: number; w: number; h: number } {
  return {
    x: (accumTx + svgX - chunkX) * SCALE + MARGIN_X,
    y: (accumTy + svgY - chunkY) * SCALE + MARGIN_Y,
    w: svgW * SCALE,
    h: svgH * SCALE,
  };
}

// ---------------------------------------------------------------------------
// Element skip logic
// ---------------------------------------------------------------------------

function shouldSkipElement(el: Element): boolean {
  for (const cls of el.classList) {
    if (SKIP_CLASSES.has(cls)) return true;
  }
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return true;
  if (el.getAttribute("pointer-events") === "none" && el.tagName.toLowerCase() === "rect") {
    // Only skip invisible hit-area rects, not guest-box contents
    if (!el.classList.contains("guest-rect") && !el.classList.contains("tag-pill") &&
        !el.classList.contains("table-shape") && !el.classList.contains("seat") &&
        style.fill === "none" && style.stroke === "none") {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Shape processors
// ---------------------------------------------------------------------------

// pptx instance type — inferred at runtime from dynamic import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PptxInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SlideInstance = any;

function processCircle(
  el: SVGCircleElement,
  slide: SlideInstance,
  pptx: PptxInstance,
  chunkX: number,
  chunkY: number,
  accumTx: number,
  accumTy: number
): void {
  const cx = parseFloat(el.getAttribute("cx") || "0");
  const cy = parseFloat(el.getAttribute("cy") || "0");
  const r = parseFloat(el.getAttribute("r") || "0");
  if (r <= 0) return;

  const pos = toSlidePos(cx - r, cy - r, r * 2, r * 2, chunkX, chunkY, accumTx, accumTy);
  if (pos.w < MIN_SIZE || pos.h < MIN_SIZE) return;

  slide.addShape(pptx.ShapeType.ellipse, {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    fill: extractFill(el),
    line: extractLine(el),
  });
}

function processEllipse(
  el: SVGEllipseElement,
  slide: SlideInstance,
  pptx: PptxInstance,
  chunkX: number,
  chunkY: number,
  accumTx: number,
  accumTy: number,
  rotation: number
): void {
  const cx = parseFloat(el.getAttribute("cx") || "0");
  const cy = parseFloat(el.getAttribute("cy") || "0");
  const rx = parseFloat(el.getAttribute("rx") || "0");
  const ry = parseFloat(el.getAttribute("ry") || "0");
  if (rx <= 0 || ry <= 0) return;

  const pos = toSlidePos(cx - rx, cy - ry, rx * 2, ry * 2, chunkX, chunkY, accumTx, accumTy);
  if (pos.w < MIN_SIZE || pos.h < MIN_SIZE) return;

  const opts: Record<string, unknown> = {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    fill: extractFill(el),
    line: extractLine(el),
  };
  if (rotation !== 0) opts.rotate = rotation;

  slide.addShape(pptx.ShapeType.ellipse, opts);
}

function processRect(
  el: SVGRectElement,
  slide: SlideInstance,
  pptx: PptxInstance,
  chunkX: number,
  chunkY: number,
  accumTx: number,
  accumTy: number,
  rotation: number
): void {
  const x = parseFloat(el.getAttribute("x") || "0");
  const y = parseFloat(el.getAttribute("y") || "0");
  const w = parseFloat(el.getAttribute("width") || "0");
  const h = parseFloat(el.getAttribute("height") || "0");
  if (w <= 0 || h <= 0) return;

  const rx = parseFloat(el.getAttribute("rx") || "0");

  const pos = toSlidePos(x, y, w, h, chunkX, chunkY, accumTx, accumTy);
  if (pos.w < MIN_SIZE || pos.h < MIN_SIZE) return;

  const shapeType = rx > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;

  const opts: Record<string, unknown> = {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    fill: extractFill(el),
    line: extractLine(el),
  };

  if (rx > 0) {
    // rectRadius is a ratio (0-1) of the shorter side
    const shorterSide = Math.min(w, h);
    opts.rectRadius = Math.min((rx / shorterSide) * 0.5, 0.5);
  }
  if (rotation !== 0) opts.rotate = rotation;

  slide.addShape(shapeType, opts);
}

function processLine(
  el: SVGLineElement,
  slide: SlideInstance,
  pptx: PptxInstance,
  chunkX: number,
  chunkY: number,
  accumTx: number,
  accumTy: number
): void {
  const x1 = parseFloat(el.getAttribute("x1") || "0");
  const y1 = parseFloat(el.getAttribute("y1") || "0");
  const x2 = parseFloat(el.getAttribute("x2") || "0");
  const y2 = parseFloat(el.getAttribute("y2") || "0");

  // Convert both endpoints to slide coordinates
  const p1 = toSlidePos(x1, y1, 0, 0, chunkX, chunkY, accumTx, accumTy);
  const p2 = toSlidePos(x2, y2, 0, 0, chunkX, chunkY, accumTx, accumTy);

  let sx = p1.x;
  let sy = p1.y;
  let ex = p2.x;
  let ey = p2.y;

  // pptxgenjs line requires positive width — flip if needed
  let flipV = false;
  if (sx > ex) {
    [sx, ex] = [ex, sx];
    [sy, ey] = [ey, sy];
  }
  flipV = sy > ey;

  const lx = sx;
  const ly = Math.min(sy, ey);
  const lw = Math.max(0.01, Math.abs(ex - sx));
  const lh = Math.max(0.01, Math.abs(ey - sy));

  slide.addShape(pptx.ShapeType.line, {
    x: lx,
    y: ly,
    w: lw,
    h: lh,
    line: extractLine(el),
    flipV,
  });
}

function processText(
  el: SVGTextElement,
  slide: SlideInstance,
  chunkX: number,
  chunkY: number,
  accumTx: number,
  accumTy: number
): void {
  const textContent = el.textContent || "";
  if (!textContent.trim()) return;

  // Get bounding box for positioning
  let bbox: DOMRect;
  try {
    bbox = el.getBBox();
  } catch {
    return;
  }
  if (bbox.width < 0.1 || bbox.height < 0.1) return;

  const style = window.getComputedStyle(el);
  const fontSizePx = parseFloat(style.fontSize) || 12;
  const fontWeight = style.fontWeight;
  const isBold = fontWeight === "bold" || parseInt(fontWeight) >= 700;
  const pptFontSize = Math.max(1, fontSizePx * SCALE * 72);

  const fillHex = rgbToHex(style.fill) || "000000";

  // Map SVG text-anchor to pptxgenjs horizontal alignment
  const anchor = el.getAttribute("text-anchor") || "start";
  let align: "left" | "center" | "right" = "left";
  if (anchor === "middle") align = "center";
  if (anchor === "end") align = "right";

  const pos = toSlidePos(bbox.x, bbox.y, bbox.width, bbox.height, chunkX, chunkY, accumTx, accumTy);

  // Add some width buffer for alignment
  const widthBuffer = pos.w * 0.35;
  let adjX = pos.x;
  const adjW = pos.w + widthBuffer;

  if (align === "center") {
    adjX = pos.x - widthBuffer / 2;
  } else if (align === "right") {
    adjX = pos.x - widthBuffer;
  }

  slide.addText(textContent, {
    x: adjX,
    y: pos.y,
    w: adjW,
    h: pos.h,
    fontSize: pptFontSize,
    fontFace: "Arial",
    color: fillHex,
    bold: isBold,
    align,
    valign: "middle",
    margin: 0,
    wrap: false,
    shrinkText: true,
  });
}

// ---------------------------------------------------------------------------
// Recursive DOM walker
// ---------------------------------------------------------------------------

function processGroupChildren(
  parent: Element,
  slide: SlideInstance,
  pptx: PptxInstance,
  chunkX: number,
  chunkY: number,
  accumTx: number,
  accumTy: number,
  accumRotation: number
): void {
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (shouldSkipElement(el)) continue;

    const tag = el.tagName.toLowerCase();

    if (STRUCTURAL_TAGS.has(tag)) continue;

    if (tag === "g") {
      const t = parseTransform(el.getAttribute("transform"));
      processGroupChildren(
        el,
        slide,
        pptx,
        chunkX,
        chunkY,
        accumTx + t.tx,
        accumTy + t.ty,
        accumRotation + t.rotation
      );
    } else if (tag === "circle") {
      processCircle(
        el as SVGCircleElement,
        slide,
        pptx,
        chunkX,
        chunkY,
        accumTx,
        accumTy
      );
    } else if (tag === "ellipse") {
      processEllipse(
        el as SVGEllipseElement,
        slide,
        pptx,
        chunkX,
        chunkY,
        accumTx,
        accumTy,
        accumRotation
      );
    } else if (tag === "rect") {
      processRect(
        el as SVGRectElement,
        slide,
        pptx,
        chunkX,
        chunkY,
        accumTx,
        accumTy,
        accumRotation
      );
    } else if (tag === "line") {
      processLine(
        el as SVGLineElement,
        slide,
        pptx,
        chunkX,
        chunkY,
        accumTx,
        accumTy
      );
    } else if (tag === "text") {
      processText(
        el as SVGTextElement,
        slide,
        chunkX,
        chunkY,
        accumTx,
        accumTy
      );
    }
    // Other tags (path, polygon, polyline, image, etc.) are not used in this SVG
  }
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function exportToPPTX(): Promise<void> {
  // Dynamic import — keeps pptxgenjs out of the main bundle
  const PptxGenJS = (await import("pptxgenjs")).default;

  // Access the live SVG from the canvas
  const svg = document.querySelector(
    "#playground-canvas svg"
  ) as SVGSVGElement | null;
  if (!svg) {
    console.error("SVG element not found in #playground-canvas");
    alert(
      "Could not find the seating plan SVG. Please ensure the plan is visible."
    );
    return;
  }

  // Get store data for chunk identification
  const store = useSeatStore.getState();
  const allChunks = store.chunks;
  const allDrawObjects = store.drawObjects;

  // -----------------------------------------------------------------------
  // Identify chunks with content (tables or overlapping draw objects)
  // -----------------------------------------------------------------------
  const chunksWithContent = new Set<string>();

  Object.values(allChunks).forEach((c) => {
    if (c.tables && c.tables.length > 0) {
      chunksWithContent.add(c.id);
    }
  });

  allDrawObjects.forEach((d) => {
    const minCol = Math.floor(d.x / CHUNK_WIDTH);
    const maxCol = Math.floor((d.x + d.width) / CHUNK_WIDTH);
    const minRow = Math.floor(d.y / CHUNK_HEIGHT);
    const maxRow = Math.floor((d.y + d.height) / CHUNK_HEIGHT);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const chunk = Object.values(allChunks).find(
          (ch) => ch.row === r && ch.col === c
        );
        if (chunk) chunksWithContent.add(chunk.id);
      }
    }
  });

  if (chunksWithContent.size === 0) {
    alert("No content found to export.");
    return;
  }

  // -----------------------------------------------------------------------
  // Locate SVG layers
  // -----------------------------------------------------------------------
  const zoomLayer = svg.querySelector("g.zoom-layer");
  if (!zoomLayer) {
    console.error("zoom-layer not found in SVG");
    return;
  }

  const drawLayer = zoomLayer.querySelector("g.draw-layer");
  const tablesLayer = zoomLayer.querySelector("g.tables-layer");

  // -----------------------------------------------------------------------
  // Create PowerPoint presentation
  // -----------------------------------------------------------------------
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  // -----------------------------------------------------------------------
  // Process each chunk as a separate slide
  // -----------------------------------------------------------------------
  for (const cid of chunksWithContent) {
    const chunk = Object.values(allChunks).find((c) => c.id === cid);
    if (!chunk) continue;

    const chunkX = chunk.col * CHUNK_WIDTH;
    const chunkY = chunk.row * CHUNK_HEIGHT;

    const slide = pptx.addSlide();

    // Add a discreet chunk label
    slide.addText(`Row:${chunk.row + 1} Col:${chunk.col + 1}`, {
      x: 0.2,
      y: 0.1,
      w: 3,
      h: 0.3,
      fontSize: 10,
      color: "808080",
    });

    // --- Draw objects FIRST (behind tables) ---
    if (drawLayer) {
      const drawGroups = drawLayer.querySelectorAll(
        ":scope > g.draw-object-group"
      );
      // Sort by zIndex from store data for correct layering
      const sortedDrawGroups = Array.from(drawGroups).sort((a, b) => {
        const aId = (
          (a as unknown as Record<string, unknown>).__data__ as
            | { id?: string; zIndex?: number }
            | undefined
        )?.zIndex ?? 0;
        const bId = (
          (b as unknown as Record<string, unknown>).__data__ as
            | { id?: string; zIndex?: number }
            | undefined
        )?.zIndex ?? 0;
        return (aId as number) - (bId as number);
      });

      for (const drawGroup of sortedDrawGroups) {
        const t = parseTransform(drawGroup.getAttribute("transform"));

        // Check if draw object overlaps this chunk
        // Use the store data for accurate bounds if available, else use transform
        const drawData = (
          drawGroup as unknown as Record<string, unknown>
        ).__data__ as
          | { id?: string; x?: number; y?: number; width?: number; height?: number }
          | undefined;

        let overlaps = false;
        if (drawData && drawData.width !== undefined && drawData.height !== undefined) {
          const dx = drawData.x ?? t.tx;
          const dy = drawData.y ?? t.ty;
          const dw = drawData.width;
          const dh = drawData.height;
          overlaps =
            dx < chunkX + CHUNK_WIDTH &&
            dx + dw > chunkX &&
            dy < chunkY + CHUNK_HEIGHT &&
            dy + dh > chunkY;
        } else {
          // Fallback: check if transform position is within chunk
          overlaps =
            t.tx >= chunkX &&
            t.tx < chunkX + CHUNK_WIDTH &&
            t.ty >= chunkY &&
            t.ty < chunkY + CHUNK_HEIGHT;
        }

        if (!overlaps) continue;

        processGroupChildren(
          drawGroup,
          slide,
          pptx,
          chunkX,
          chunkY,
          t.tx,
          t.ty,
          t.rotation
        );
      }
    }

    // --- Tables SECOND (on top of draw objects) ---
    if (tablesLayer) {
      const tableGroups = tablesLayer.querySelectorAll(
        ":scope > g.table-group"
      );

      for (const tableGroup of tableGroups) {
        const t = parseTransform(tableGroup.getAttribute("transform"));

        // Check if this table belongs to the current chunk
        // by seeing if its center position falls within chunk bounds
        const tableCol = Math.floor(t.tx / CHUNK_WIDTH);
        const tableRow = Math.floor(t.ty / CHUNK_HEIGHT);
        if (tableCol !== chunk.col || tableRow !== chunk.row) continue;

        processGroupChildren(
          tableGroup,
          slide,
          pptx,
          chunkX,
          chunkY,
          t.tx,
          t.ty,
          0
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // Write the file
  // -----------------------------------------------------------------------
  await pptx.writeFile({ fileName: "SeatPlanner.pptx" });
}
