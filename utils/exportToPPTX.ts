import pptxgen from "pptxgenjs";
import { useSeatStore } from "@/store/seatStore";
import { CHUNK_WIDTH, CHUNK_HEIGHT } from "@/types/Chunk";

// --- HELPERS ---

// Helper to convert RGB string to Hex
const rgbToHex = (color: string) => {
  if (!color || color === "none" || color === "transparent") return null;
  const values = color.match(/\d+(\.\d+)?/g);
  if (!values || values.length < 3) return "000000";
  const r = parseInt(values[0]);
  const g = parseInt(values[1]);
  const b = parseInt(values[2]);
  return (
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  ).toUpperCase();
};

// Helper to parse transform attribute and extract cumulative translate values
const getAccumulatedTransform = (element: Element, stopAtClass: string): { tx: number; ty: number } => {
  let tx = 0;
  let ty = 0;
  let current: Element | null = element.parentElement;

  while (current) {
    // Stop when we reach the group (which is handled separately via relTx/relTy)
    if (current.classList?.contains(stopAtClass)) {
      break;
    }

    const transform = current.getAttribute("transform");
    if (transform) {
      // Parse translate(x, y) or translate(x y)
      const translateMatch = transform.match(/translate\(\s*([^,\s)]+)[\s,]*([^)\s]*)\s*\)/);
      if (translateMatch) {
        tx += parseFloat(translateMatch[1]) || 0;
        ty += parseFloat(translateMatch[2]) || 0;
      }
    }

    current = current.parentElement;
  }

  return { tx, ty };
};

/**
 * Process SVG child elements of a group and add them to a PPTX slide.
 * Shared logic for both table groups and draw object groups.
 */
function processSvgChildren(
  parentGroup: Element,
  stopClass: string,
  relTx: number,
  relTy: number,
  scale: number,
  marginX: number,
  marginY: number,
  slide: pptxgen.Slide,
  pptx: pptxgen,
): void {
  const children = parentGroup.querySelectorAll("*");

  children.forEach((child) => {
    const tag = child.tagName.toLowerCase();
    const style = window.getComputedStyle(child);
    if (style.display === "none" || style.visibility === "hidden") return;

    // Skip selection outlines and resize handles (draw-layer artifacts)
    if (
      child.classList.contains("draw-selection-outline") ||
      child.classList.contains("draw-resize-handle") ||
      child.classList.contains("draw-hit-area")
    ) return;

    const fillHex = rgbToHex(style.fill);
    const strokeHex = rgbToHex(style.stroke);
    const strokeWidthPx = parseFloat(style.strokeWidth) || 0;

    const strokePt = Math.max(0.5, strokeWidthPx * scale * 72);

    // Prepare Fill object
    let pptFill: pptxgen.ShapeFillProps | undefined = undefined;
    if (fillHex) {
      pptFill = { color: fillHex };
    } else {
      pptFill = { type: "none" };
    }

    // Prepare Line object
    let pptLine: pptxgen.ShapeLineProps | undefined = undefined;
    if (strokeHex && style.stroke !== "none") {
        pptLine = { color: strokeHex, width: strokePt };
    } else {
        pptLine = { type: "none" };
    }

    // Skip non-visual or structural elements
    if (["g", "defs", "clippath", "style", "script", "title", "desc"].includes(tag)) return;

    // Get accumulated transform
    const accumulated = getAccumulatedTransform(child, stopClass);

    // Get Bounding Box
    let bbox: DOMRect;
    try {
      bbox = (child as SVGGraphicsElement).getBBox();
    } catch {
      return;
    }

    // Map Coordinates
    const finalX = (relTx + accumulated.tx + bbox.x) * scale + marginX;
    const finalY = (relTy + accumulated.ty + bbox.y) * scale + marginY;
    const finalW = bbox.width * scale;
    const finalH = bbox.height * scale;

    // --- SHAPE GENERATION (Add directly to slide) ---

    if (tag === "circle" || tag === "ellipse") {
      if (finalW < 0.001 || finalH < 0.001) return;

      slide.addShape(pptx.ShapeType.ellipse, {
        x: finalX, y: finalY, w: finalW, h: finalH,
        fill: pptFill,
        line: pptLine,
      });
    }

    else if (tag === "rect") {
      if (finalW < 0.001 || finalH < 0.001) return;

      const rx = parseFloat(child.getAttribute("rx") || "0");
      const rectWidth = parseFloat(child.getAttribute("width") || "0");
      const rectHeight = parseFloat(child.getAttribute("height") || "0");

      let rectRadius = 0;
      if (rx > 0 && rectWidth > 0 && rectHeight > 0) {
        const shorterSide = Math.min(rectWidth, rectHeight);
        rectRadius = Math.min((rx / shorterSide) * 0.5, 0.1);
      }

      slide.addShape(rx > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        x: finalX, y: finalY, w: finalW, h: finalH,
        fill: pptFill,
        line: pptLine,
        rectRadius: rectRadius,
      });
    }

    else if (tag === "line") {
        const x1 = parseFloat(child.getAttribute("x1") || "0");
        const y1 = parseFloat(child.getAttribute("y1") || "0");
        const x2 = parseFloat(child.getAttribute("x2") || "0");
        const y2 = parseFloat(child.getAttribute("y2") || "0");

        let sx = (relTx + accumulated.tx + x1) * scale + marginX;
        let sy = (relTy + accumulated.ty + y1) * scale + marginY;
        let ex = (relTx + accumulated.tx + x2) * scale + marginX;
        let ey = (relTy + accumulated.ty + y2) * scale + marginY;

        // Ensure sx < ex for correct width/height calc (Line direction handled by flip)
        if (sx > ex) { [sx, ex] = [ex, sx]; [sy, ey] = [ey, sy]; }

        const lx = sx;
        const ly = Math.min(sy, ey);
        const lw = Math.max(0.01, Math.abs(ex - sx));
        const lh = Math.max(0.01, Math.abs(ey - sy));
        const flipV = sy > ey;

        slide.addShape(pptx.ShapeType.line, {
            x: lx, y: ly, w: lw, h: lh,
            line: pptLine,
            flipV: flipV
        });
    }

    else if (tag === "text") {
      const textContent = child.textContent || "";
      if (!textContent.trim()) return;

      const fontSizePx = parseFloat(style.fontSize) || 12;
      const fontWeight = style.fontWeight;
      const isBold = fontWeight === "bold" || parseInt(fontWeight) >= 700;
      const pptFontSize = Math.max(1, fontSizePx * scale * 72);

      const anchor = child.getAttribute("text-anchor") || "start";
      let align: pptxgen.HAlign = "left";
      if (anchor === "middle") align = "center";
      if (anchor === "end") align = "right";

      const textColor = fillHex || "000000";

      const widthBuffer = finalW * 0.35;
      let adjX = finalX;
      const adjW = finalW + widthBuffer;

      if (align === "center") {
        adjX = finalX - (widthBuffer / 2);
      } else if (align === "right") {
        adjX = finalX - widthBuffer;
      }

      slide.addText(textContent, {
          x: adjX, y: finalY, w: adjW, h: finalH,
          fontSize: pptFontSize,
          color: textColor,
          bold: isBold,
          align: align,
          valign: "middle",
          margin: 0,
          fill: { type: "none" },
          line: { type: "none" }
      });
    }
  });
}

// --- MAIN EXPORT FUNCTION ---

export const exportToPPTX = async () => {
  const pptx = new pptxgen();

  // Configure Slide Layout (16:9 is default, approx 10 x 5.625 inches)
  pptx.layout = "LAYOUT_16x9";
  const SLIDE_WIDTH_IN = 10;
  const SLIDE_HEIGHT_IN = 5.625;

  // Calculate global scale to fit one Chunk (2000x1200) into the slide
  const scaleX = SLIDE_WIDTH_IN / CHUNK_WIDTH;
  const scaleY = SLIDE_HEIGHT_IN / CHUNK_HEIGHT;
  const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave a small margin

  // Center content on slide
  const contentW = CHUNK_WIDTH * scale;
  const contentH = CHUNK_HEIGHT * scale;
  const marginX = (SLIDE_WIDTH_IN - contentW) / 2;
  const marginY = (SLIDE_HEIGHT_IN - contentH) / 2;

  // Access the DOM SVG directly
  const svg = document.querySelector("#playground-canvas svg") as SVGSVGElement;
  if (!svg) {
    console.error("SVG element not found in #playground-canvas");
    alert("Could not find the seating plan SVG. Please ensure the plan is visible.");
    return;
  }

  // Get store data
  const store = useSeatStore.getState();
  const allChunks = store.chunks;
  const allTables = store.tables;
  const allDrawObjects = store.drawObjects;

  // Identify which chunks have content (tables OR draw objects overlapping)
  const chunksWithContent = new Set<string>();

  // Mark chunks with tables
  Object.values(allChunks).forEach(c => {
    if (c.tables && c.tables.length > 0) {
      chunksWithContent.add(c.id);
    }
  });

  // Mark chunks that overlap with draw objects
  allDrawObjects.forEach(d => {
    const minCol = Math.floor(d.x / CHUNK_WIDTH);
    const maxCol = Math.floor((d.x + d.width) / CHUNK_WIDTH);
    const minRow = Math.floor(d.y / CHUNK_HEIGHT);
    const maxRow = Math.floor((d.y + d.height) / CHUNK_HEIGHT);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const chunk = Object.values(allChunks).find(ch => ch.row === r && ch.col === c);
        if (chunk) chunksWithContent.add(chunk.id);
      }
    }
  });

  if (chunksWithContent.size === 0) {
    alert("No content found to export.");
    return;
  }

  // Map Table IDs to their DOM elements for style extraction
  const tableGroups = Array.from(svg.querySelectorAll(".table-group"));
  const tableDomMap = new Map<string, Element>();
  tableGroups.forEach((group) => {
    const data = (group as unknown as Record<string, unknown>).__data__ as { id?: string } | undefined;
    if (data && data.id) {
      tableDomMap.set(data.id, group);
    }
  });

  // Map Draw Object IDs to their DOM elements
  const drawObjectGroups = Array.from(svg.querySelectorAll(".draw-object-group"));
  const drawDomMap = new Map<string, Element>();
  drawObjectGroups.forEach((group) => {
    const data = (group as unknown as Record<string, unknown>).__data__ as { id?: string } | undefined;
    if (data && data.id) {
      drawDomMap.set(data.id, group);
    }
  });

  const chunkIdsToExport = Array.from(chunksWithContent);

  for (const cid of chunkIdsToExport) {
    const chunk = Object.values(allChunks).find((c) => c.id === cid);
    if (!chunk) continue;

    const slide = pptx.addSlide();

    // Add a discreet label for the chunk
    slide.addText(`Row:${chunk.row + 1} Col:${chunk.col + 1}`, {
      x: 0.2,
      y: 0.1,
      w: 3,
      h: 0.3,
      fontSize: 10,
      color: "808080",
    });

    // Chunk World Origin
    const chunkX = chunk.col * CHUNK_WIDTH;
    const chunkY = chunk.row * CHUNK_HEIGHT;

    // --- DRAW OBJECTS (rendered first = behind tables) ---
    // Find draw objects that overlap this chunk's area
    allDrawObjects
      .filter(d => {
        const objRight = d.x + d.width;
        const objBottom = d.y + d.height;
        const chunkRight = chunkX + CHUNK_WIDTH;
        const chunkBottom = chunkY + CHUNK_HEIGHT;
        // Check overlap
        return d.x < chunkRight && objRight > chunkX && d.y < chunkBottom && objBottom > chunkY;
      })
      .sort((a, b) => a.zIndex - b.zIndex) // Lower zIndex first (behind)
      .forEach(drawObj => {
        const drawGroup = drawDomMap.get(drawObj.id);
        if (!drawGroup) return;

        // Draw object position relative to chunk
        const relTx = drawObj.x - chunkX;
        const relTy = drawObj.y - chunkY;

        processSvgChildren(
          drawGroup, "draw-object-group",
          relTx, relTy,
          scale, marginX, marginY,
          slide, pptx,
        );
      });

    // --- TABLES (rendered second = on top of draw objects) ---
    const tableIds = chunk.tables || [];

    for (const tid of tableIds) {
      const tableGroup = tableDomMap.get(tid);
      const tableData = allTables.find((t) => t.id === tid);

      if (!tableGroup || !tableData) continue;

      // Table position relative to the Chunk
      const relTx = tableData.x - chunkX;
      const relTy = tableData.y - chunkY;

      processSvgChildren(
        tableGroup, "table-group",
        relTx, relTy,
        scale, marginX, marginY,
        slide, pptx,
      );
    }
  }

  await pptx.writeFile({ fileName: "SeatPlanner.pptx" });
};
