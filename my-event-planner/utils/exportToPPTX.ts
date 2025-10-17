// src/utils/exportToPPTX.ts
import PptxGenJS from "pptxgenjs";
import { useSeatStore, CHUNK_WIDTH, CHUNK_HEIGHT, Table } from "@/store/seatStore";

/**
 * Exports each chunk as one editable PowerPoint slide.
 * Each chunk fits content into a single slide; final slide is an overview.
 */
export async function exportToPPTX(allTables: Table[], filename = "SeatPlan.pptx") {
  const store = useSeatStore.getState();
  const chunks = store.getAllChunksSorted();
  const pptx = new PptxGenJS();

  // slide dims & DPI
  const SLIDE_W_IN = 10;
  const SLIDE_H_IN = 5.625;
  const DPI = 96;
  const SLIDE_W_PX = SLIDE_W_IN * DPI;
  const SLIDE_H_PX = SLIDE_H_IN * DPI;
  const pxToIn = (px: number) => px / DPI;

  if (!chunks || chunks.length === 0) {
    // fallback: render everything onto one slide
    addSlideWithTables(pptx.addSlide(), allTables);
    await pptx.writeFile({ fileName: filename });
    return;
  }

  // for each chunk -> one slide
  for (const c of chunks) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(`Chunk R${c.row}C${c.col}`, { x: 0.2, y: 0.15, fontSize: 12, bold: true });

    // tables whose center lies inside this chunk rectangle
    const tablesInChunk = allTables.filter((t) => {
      return (
        t.x >= c.col * CHUNK_WIDTH &&
        t.x < (c.col + 1) * CHUNK_WIDTH &&
        t.y >= c.row * CHUNK_HEIGHT &&
        t.y < (c.row + 1) * CHUNK_HEIGHT
      );
    });

    addSlideWithTables(slide, tablesInChunk, c);
  }

  // overview slide with all tables
  const overview = pptx.addSlide();
  overview.background = { color: "FFFFFF" };
  overview.addText("Full Map Overview", { x: 0.2, y: 0.15, fontSize: 12, bold: true });
  addSlideWithTables(overview, allTables);

  await pptx.writeFile({ fileName: filename });

  function addSlideWithTables(slide: any, list: Table[], chunk?: { row: number; col: number }) {
    if (!list || list.length === 0) {
      slide.addText("No tables in this chunk", { x: 1, y: 2, fontSize: 12, color: "888888" });
      return;
    }

    // Determine bounds from list (or if chunk given, use chunk area)
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    if (chunk) {
      minX = chunk.col * CHUNK_WIDTH;
      minY = chunk.row * CHUNK_HEIGHT;
      maxX = minX + CHUNK_WIDTH;
      maxY = minY + CHUNK_HEIGHT;
    } else {
      list.forEach((t) => {
        minX = Math.min(minX, t.x - t.radius);
        minY = Math.min(minY, t.y - t.radius);
        maxX = Math.max(maxX, t.x + t.radius);
        maxY = Math.max(maxY, t.y + t.radius);
      });
      if (!isFinite(minX)) {
        minX = 0; minY = 0; maxX = 1000; maxY = 800;
      }
    }

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scale = Math.min((SLIDE_W_PX - 80) / contentW, (SLIDE_H_PX - 80) / contentH, 1);
    const offsetX = (SLIDE_W_PX - contentW * scale) / 2 - minX * scale;
    const offsetY = (SLIDE_H_PX - contentH * scale) / 2 - minY * scale;

    for (const t of list) {
      const cx = t.x * scale + offsetX;
      const cy = t.y * scale + offsetY;
      const diameter = t.radius * 2 * scale;

      const shapeType = t.shape === "round" ? "ellipse" : "rect";
      slide.addShape(shapeType, {
        x: pxToIn(cx - t.radius * scale),
        y: pxToIn(cy - t.radius * scale),
        w: pxToIn(diameter),
        h: pxToIn(diameter),
        fill: { color: "1976D2" },
        line: { color: "0D47A1", width: 1 },
      });

      slide.addText(t.label || "", {
        x: pxToIn(cx - t.radius * scale),
        y: pxToIn(cy - 0.15 * DPI * scale),
        w: pxToIn(diameter),
        h: 0.3,
        fontSize: 12,
        color: "FFFFFF",
        align: "center",
      });

      for (const s of t.seats) {
        const sx = s.x * scale + offsetX;
        const sy = s.y * scale + offsetY;
        const sr = s.radius * scale;
        const seatColor = s.locked ? "B0BEC5" : "90CAF9";

        slide.addShape("ellipse", {
          x: pxToIn(sx - sr),
          y: pxToIn(sy - sr),
          w: pxToIn(sr * 2),
          h: pxToIn(sr * 2),
          fill: { color: seatColor },
          line: { color: "1565C0", width: 0.5 },
        });

        slide.addText(String(s.label || s.seatNumber || ""), {
          x: pxToIn(sx - sr),
          y: pxToIn(sy - sr),
          w: pxToIn(sr * 2),
          h: pxToIn(sr * 2),
          fontSize: 8,
          color: "0D47A1",
          align: "center",
          valign: "middle",
        });
      }
    }
  }
}
