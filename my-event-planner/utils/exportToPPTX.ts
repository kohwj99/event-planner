import pptxgen from "pptxgenjs";
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

// Updated signature to match the call in page.tsx
export const exportToPPTX = async (tables: any[]) => {
  const pptx = new pptxgen();
  
  // Configure Slide Layout (16:9 is default, approx 10 x 5.625 inches)
  pptx.layout = "LAYOUT_16x9";
  const SLIDE_WIDTH_IN = 10;
  const SLIDE_HEIGHT_IN = 5.625;

  // Calculate global scale to fit one Chunk (2000x1200) into the slide
  // We use the smaller scale factor to ensure it fits completely
  const scaleX = SLIDE_WIDTH_IN / CHUNK_WIDTH;
  const scaleY = SLIDE_HEIGHT_IN / CHUNK_HEIGHT;
  const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave a small margin

  // Center content on slide
  const contentW = CHUNK_WIDTH * scale;
  const contentH = CHUNK_HEIGHT * scale;
  const marginX = (SLIDE_WIDTH_IN - contentW) / 2;
  const marginY = (SLIDE_HEIGHT_IN - contentH) / 2;

  // Access the DOM SVG directly to read computed styles and transforms
  // We target the svg inside the #playground-canvas container
  const svg = document.querySelector("#playground-canvas svg") as SVGSVGElement;
  if (!svg) {
    console.error("SVG element not found in #playground-canvas");
    alert("Could not find the seating plan SVG. Please ensure the plan is visible.");
    return;
  }

  // We get the chunks from the store because the requirement is "Each chunk should be a slide"
  const store = useSeatStore.getState();
  const allChunks = store.chunks;
  const allTables = store.tables; // We use the store's full table list for data lookup

  // Identify which chunks actually have tables
  const chunkIdsToExport = Object.values(allChunks)
    .filter(c => c.tables && c.tables.length > 0)
    .map(c => c.id);

  if (chunkIdsToExport.length === 0) {
    alert("No chunks with tables found to export.");
    return;
  }

  // Map Table IDs to their DOM elements for style extraction
  // The PlaygroundCanvas renders tables with class .table-group
  const tableGroups = Array.from(svg.querySelectorAll(".table-group"));
  const tableDomMap = new Map<string, Element>();
  tableGroups.forEach((group) => {
    // D3 stores data on the DOM element in __data__
    const data = (group as any).__data__;
    if (data && data.id) {
      tableDomMap.set(data.id, group);
    }
  });

  for (const cid of chunkIdsToExport) {
    const chunk = Object.values(allChunks).find((c) => c.id === cid);
    if (!chunk) continue;

    const slide = pptx.addSlide();
    
    // Add a discreet label for the chunk
    slide.addText(`Chunk R${chunk.row}C${chunk.col}`, {
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

    // Iterate tables assigned to this chunk
    const tableIds = chunk.tables || [];

    for (const tid of tableIds) {
      const tableGroup = tableDomMap.get(tid);
      const tableData = allTables.find((t) => t.id === tid);

      if (!tableGroup || !tableData) continue;

      // Table position relative to the Chunk
      const groupTx = tableData.x;
      const groupTy = tableData.y;

      const relTx = groupTx - chunkX;
      const relTy = groupTy - chunkY;

      // Traverse all visual elements within the table group
      const children = tableGroup.querySelectorAll("*");

      children.forEach((child) => {
        const tag = child.tagName.toLowerCase();
        const style = window.getComputedStyle(child);
        if (style.display === "none") return;

        const fillHex = rgbToHex(style.fill);
        const strokeHex = rgbToHex(style.stroke);
        const strokeWidthPx = parseFloat(style.strokeWidth) || 0;
        
        // Convert styles for PPT
        // We scale the stroke width by our global scale to keep it proportional
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
        if (["g", "defs", "clippath", "style", "script"].includes(tag)) return;

        // Get Bounding Box
        let bbox: DOMRect;
        try {
          bbox = (child as SVGGraphicsElement).getBBox();
        } catch (e) {
          return;
        }

        // Map Coordinates: Local -> Relative to Chunk -> Scaled to Slide
        const finalX = (relTx + bbox.x) * scale + marginX;
        const finalY = (relTy + bbox.y) * scale + marginY;
        const finalW = bbox.width * scale;
        const finalH = bbox.height * scale;

        // --- SHAPE GENERATION ---

        if (tag === "circle" || tag === "ellipse") {
          slide.addShape(pptx.ShapeType.ellipse, {
            x: finalX,
            y: finalY,
            w: finalW,
            h: finalH,
            fill: pptFill,
            line: pptLine,
          });
        } 
        
        else if (tag === "rect") {
          const rx = parseFloat(child.getAttribute("rx") || "0");
          slide.addShape(rx > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
            x: finalX,
            y: finalY,
            w: finalW,
            h: finalH,
            fill: pptFill,
            line: pptLine,
            rectRadius: rx > 0 ? 0.15 : 0, 
          });
        } 
        
        else if (tag === "line") {
            // Line needs special handling for direction
            const x1 = parseFloat(child.getAttribute("x1") || "0");
            const y1 = parseFloat(child.getAttribute("y1") || "0");
            const x2 = parseFloat(child.getAttribute("x2") || "0");
            const y2 = parseFloat(child.getAttribute("y2") || "0");

            let sx = (relTx + x1) * scale + marginX;
            let sy = (relTy + y1) * scale + marginY;
            let ex = (relTx + x2) * scale + marginX;
            let ey = (relTy + y2) * scale + marginY;

            // Normalize
            if (sx > ex) {
                [sx, ex] = [ex, sx];
                [sy, ey] = [ey, sy];
            }

            const lx = sx;
            const ly = Math.min(sy, ey); 
            const lw = Math.abs(ex - sx);
            const lh = Math.abs(ey - sy);
            const flipV = sy > ey;

            slide.addShape(pptx.ShapeType.line, {
                x: lx,
                y: ly,
                w: lw,
                h: lh,
                line: pptLine,
                flipV: flipV
            });
        } 
        
        else if (tag === "text") {
          const textContent = child.textContent || "";
          if (!textContent.trim()) return;

          const fontSizePx = parseFloat(style.fontSize) || 12;
          const pptFontSize = Math.max(1, fontSizePx * scale * 72);
          
          const anchor = child.getAttribute("text-anchor") || "start";
          let align: pptxgen.HAlign = "left";
          if (anchor === "middle") align = "center";
          if (anchor === "end") align = "right";

          // Use style.fill for text color
          const textColor = fillHex || "000000";

          // --- FIX FOR SQUISHED TEXT ---
          // 1. Add a width buffer because PPT text rendering differs from SVG.
          // 2. Adjust X position based on alignment so the text visually stays in place.
          // 3. Remove default margins (margin: 0) which destroy layout on small text boxes.
          // 4. Disable wrapping (wrap: false) to match SVG single-line behavior.

          const widthBuffer = finalW * 0.35; // 35% wider to be safe
          let adjX = finalX;
          let adjW = finalW + widthBuffer;

          // Shift x to preserve visual center/start point
          if (align === "center") {
            adjX = finalX - (widthBuffer / 2);
          } else if (align === "right") {
            adjX = finalX - widthBuffer;
          }
          // if left align, expanding width to the right is correct, no x adjustment needed.

          slide.addText(textContent, {
            x: adjX,
            y: finalY,
            w: adjW,
            h: finalH,
            fontSize: pptFontSize,
            color: textColor,
            align: align,
            valign: "middle", 
            fill: { type: "none" },
            line: { type: "none" },
            margin: 0,   // KEY FIX: No internal padding
            wrap: false, // KEY FIX: No auto-wrapping
          });
        }
      });
    }
  }

  await pptx.writeFile({ fileName: "SeatPlanner.pptx" });
};