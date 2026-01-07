// utils/exportToPPTX.ts
import { useSeatStore } from "@/store/seatStore";
import { CHUNK_WIDTH, CHUNK_HEIGHT } from "@/types/Chunk";

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
    if (current.classList?.contains(stopAtClass)) break;

    const transform = current.getAttribute("transform");
    if (transform) {
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

// ----------------------------
// Export Function
// ----------------------------
export const exportToPPTX = async (tables: any[]) => {
  if (typeof window === "undefined") {
    console.error("PPTX generation can only run in the browser");
    return;
  }

  // Dynamic import in the browser only
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_16x9";
  const SLIDE_WIDTH_IN = 10;
  const SLIDE_HEIGHT_IN = 5.625;

  // Global scale for one chunk
  const scaleX = SLIDE_WIDTH_IN / CHUNK_WIDTH;
  const scaleY = SLIDE_HEIGHT_IN / CHUNK_HEIGHT;
  const scale = Math.min(scaleX, scaleY) * 0.95;

  const contentW = CHUNK_WIDTH * scale;
  const contentH = CHUNK_HEIGHT * scale;
  const marginX = (SLIDE_WIDTH_IN - contentW) / 2;
  const marginY = (SLIDE_HEIGHT_IN - contentH) / 2;

  const svg = document.querySelector("#playground-canvas svg") as SVGSVGElement;
  if (!svg) {
    console.error("SVG element not found in #playground-canvas");
    alert("Could not find the seating plan SVG. Please ensure the plan is visible.");
    return;
  }

  const store = useSeatStore.getState();
  const allChunks = store.chunks;
  const allTables = store.tables;

  const chunkIdsToExport = Object.values(allChunks)
    .filter(c => c.tables && c.tables.length > 0)
    .map(c => c.id);

  if (chunkIdsToExport.length === 0) {
    alert("No chunks with tables found to export.");
    return;
  }

  // Map Table IDs to DOM elements
  const tableGroups = Array.from(svg.querySelectorAll(".table-group"));
  const tableDomMap = new Map<string, Element>();
  tableGroups.forEach(group => {
    const data = (group as any).__data__;
    if (data && data.id) tableDomMap.set(data.id, group);
  });

  for (const cid of chunkIdsToExport) {
    const chunk = Object.values(allChunks).find(c => c.id === cid);
    if (!chunk) continue;

    const slide = pptx.addSlide();

    slide.addText(`Chunk R${chunk.row}C${chunk.col}`, {
      x: 0.2,
      y: 0.1,
      w: 3,
      h: 0.3,
      fontSize: 10,
      color: "808080",
    });

    const chunkX = chunk.col * CHUNK_WIDTH;
    const chunkY = chunk.row * CHUNK_HEIGHT;

    const tableIds = chunk.tables || [];

    for (const tid of tableIds) {
      const tableGroup = tableDomMap.get(tid);
      const tableData = allTables.find(t => t.id === tid);

      if (!tableGroup || !tableData) continue;

      const groupTx = tableData.x;
      const groupTy = tableData.y;

      const relTx = groupTx - chunkX;
      const relTy = groupTy - chunkY;

      const children = tableGroup.querySelectorAll("*");

      children.forEach(child => {
        const tag = child.tagName.toLowerCase();
        const style = window.getComputedStyle(child);
        if (style.display === "none" || style.visibility === "hidden") return;

        const fillHex = rgbToHex(style.fill);
        const strokeHex = rgbToHex(style.stroke);
        const strokeWidthPx = parseFloat(style.strokeWidth) || 0;
        const strokePt = Math.max(0.5, strokeWidthPx * scale * 72);

        let pptFill: any = fillHex ? { color: fillHex } : { type: "none" };
        let pptLine: any = strokeHex && style.stroke !== "none" ? { color: strokeHex, width: strokePt } : { type: "none" };

        if (["g", "defs", "clippath", "style", "script", "title", "desc"].includes(tag)) return;

        const accumulated = getAccumulatedTransform(child, "table-group");

        let bbox: DOMRect;
        try { bbox = (child as SVGGraphicsElement).getBBox(); } catch { return; }

        const finalX = (relTx + accumulated.tx + bbox.x) * scale + marginX;
        const finalY = (relTy + accumulated.ty + bbox.y) * scale + marginY;
        const finalW = bbox.width * scale;
        const finalH = bbox.height * scale;

        // --- SHAPE GENERATION ---
        if (tag === "circle" || tag === "ellipse") {
          if (finalW < 0.001 || finalH < 0.001) return;
          slide.addShape(pptx.ShapeType.ellipse, { x: finalX, y: finalY, w: finalW, h: finalH, fill: pptFill, line: pptLine });
        } else if (tag === "rect") {
          if (finalW < 0.001 || finalH < 0.001) return;
          const rx = parseFloat(child.getAttribute("rx") || "0");
          const ry = parseFloat(child.getAttribute("ry") || "0");
          const rectWidth = parseFloat(child.getAttribute("width") || "0");
          const rectHeight = parseFloat(child.getAttribute("height") || "0");
          let rectRadius = 0;
          if (rx > 0 && rectWidth > 0 && rectHeight > 0) rectRadius = Math.min((rx / Math.min(rectWidth, rectHeight)) * 0.5, 0.1);
          slide.addShape(rx > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
            x: finalX, y: finalY, w: finalW, h: finalH, fill: pptFill, line: pptLine, rectRadius
          });
        } else if (tag === "line") {
          const x1 = parseFloat(child.getAttribute("x1") || "0");
          const y1 = parseFloat(child.getAttribute("y1") || "0");
          const x2 = parseFloat(child.getAttribute("x2") || "0");
          const y2 = parseFloat(child.getAttribute("y2") || "0");
          let sx = (relTx + accumulated.tx + x1) * scale + marginX;
          let sy = (relTy + accumulated.ty + y1) * scale + marginY;
          let ex = (relTx + accumulated.tx + x2) * scale + marginX;
          let ey = (relTy + accumulated.ty + y2) * scale + marginY;
          if (sx > ex) [sx, ex] = [ex, sx]; if (sy > ey) [sy, ey] = [ey, sy];
          slide.addShape(pptx.ShapeType.line, { x: sx, y: sy, w: Math.max(0.01, ex - sx), h: Math.max(0.01, ey - sy), line: pptLine });
        } else if (tag === "text") {
          const textContent = child.textContent || "";
          if (!textContent.trim()) return;
          const fontSizePx = parseFloat(style.fontSize) || 12;
          const fontWeight = style.fontWeight;
          const isBold = fontWeight === "bold" || parseInt(fontWeight) >= 700;
          const pptFontSize = Math.max(1, fontSizePx * scale * 72);

          let align: "left" | "center" | "right" = "left";
          const anchor = child.getAttribute("text-anchor") || "start";
          if (anchor === "middle") align = "center";
          if (anchor === "end") align = "right";

          const textColor = fillHex || "000000";
          const widthBuffer = finalW * 0.35;
          let adjX = finalX, adjW = finalW + widthBuffer;
          if (align === "center") adjX = finalX - widthBuffer / 2;
          else if (align === "right") adjX = finalX - widthBuffer;

          slide.addText(textContent, {
            x: adjX, y: finalY, w: adjW, h: finalH,
            fontSize: pptFontSize, color: textColor, bold: isBold,
            align, valign: "middle", fill: { type: "none" }, line: { type: "none" },
            margin: 0, wrap: false
          });
        }
      });
    }
  }

  await pptx.writeFile({ fileName: "SeatPlanner.pptx" });
};
