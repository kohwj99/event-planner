// src/utils/exportToPDF.ts
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useSeatStore } from "@/store/seatStore";
import { CHUNK_HEIGHT, CHUNK_WIDTH } from "@/types/Chunk";

/**
 * Export each chunk as one A4 landscape page (no visual scaling of Playground).
 * Fixes: resets any zoom transform on the cloned svg before setting viewBox.
 */
export async function exportToPDF(elementId: string, filename = "SeatPlan.pdf") {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error("exportToPDF: container not found:", elementId);
    return;
  }

  const svg = container.querySelector("svg") as SVGSVGElement | null;
  if (!svg) {
    console.error("exportToPDF: svg not found in container");
    return;
  }

  // A4 landscape physical inches
  const A4_IN_W = 11.6929133858;
  const A4_IN_H = 8.2677165354;

  // Choose export DPI (150 recommended for balanced quality/size; use 300 for print)
  const exportDPI = 150;
  const pagePxW = Math.round(A4_IN_W * exportDPI);
  const pagePxH = Math.round(A4_IN_H * exportDPI);

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pdfW_pt = pdf.internal.pageSize.getWidth();
  const pdfH_pt = pdf.internal.pageSize.getHeight();

  // px -> points conversion for given DPI
  const pxToPt = (px: number) => (px * 72) / exportDPI;

  const chunks = useSeatStore.getState().getAllChunksSorted();
  if (!chunks || chunks.length === 0) {
    // fallback: capture whole container
    const canvas = await html2canvas(container, { backgroundColor: "#fff", scale: 1.5, useCORS: true });
    const img = canvas.toDataURL("image/png");
    const ratio = Math.min(pdfW_pt / canvas.width, pdfH_pt / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pdfW_pt - drawW) / 2;
    const y = (pdfH_pt - drawH) / 2;
    pdf.addImage(img, "PNG", x, y, drawW, drawH);
    pdf.save(filename);
    return;
  }

  // Helper: capture exactly one chunk area into a canvas sized pagePxW x pagePxH
  async function captureChunkCanvas(row: number, col: number) {
    const clone = svg!.cloneNode(true) as SVGSVGElement;

    // Important: reset transform on zoom-layer (if present) so viewBox maps to world coords
    const zoomLayer = clone.querySelector("g.zoom-layer") as SVGGElement | null;
    if (zoomLayer) {
      zoomLayer.setAttribute("transform", ""); // clear transform
    }

    // set the viewBox exactly to chunk world rect
    clone.setAttribute("viewBox", `${col * CHUNK_WIDTH} ${row * CHUNK_HEIGHT} ${CHUNK_WIDTH} ${CHUNK_HEIGHT}`);

    // force no aspect-preserve letterboxing
    clone.setAttribute("preserveAspectRatio", "none");

    // size the clone to page pixel dimensions
    clone.setAttribute("width", `${pagePxW}px`);
    clone.setAttribute("height", `${pagePxH}px`);
    clone.style.width = `${pagePxW}px`;
    clone.style.height = `${pagePxH}px`;
    clone.style.display = "block";
    clone.style.background = "#ffffff";

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-99999px";
    wrapper.style.top = "-99999px";
    wrapper.style.width = `${pagePxW}px`;
    wrapper.style.height = `${pagePxH}px`;
    wrapper.style.background = "#ffffff";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // rasterize (scale 1 because we've sized clone to the exact px dimensions we want)
    const canvas = await html2canvas(wrapper, {
      backgroundColor: "#ffffff",
      scale: 1,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    document.body.removeChild(wrapper);
    return canvas;
  }

  // Iterate chunks (top-left -> right -> down)
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const canvas = await captureChunkCanvas(c.row, c.col);
    const imgData = canvas.toDataURL("image/png");

    const drawW_pt = pxToPt(canvas.width);
    const drawH_pt = pxToPt(canvas.height);
    const offX_pt = (pdfW_pt - drawW_pt) / 2;
    const offY_pt = (pdfH_pt - drawH_pt) / 2;

    if (i > 0) pdf.addPage("a4", "landscape");
    pdf.addImage(imgData, "PNG", offX_pt, offY_pt, drawW_pt, drawH_pt);
    pdf.setFontSize(10);
    pdf.text(`Chunk R${c.row}C${c.col}`, 10, 14);
  }

  // Overview: render bounding box for all chunks
  const minCol = Math.min(...chunks.map((ch) => ch.col));
  const maxCol = Math.max(...chunks.map((ch) => ch.col));
  const minRow = Math.min(...chunks.map((ch) => ch.row));
  const maxRow = Math.max(...chunks.map((ch) => ch.row));
  const worldX = minCol * CHUNK_WIDTH;
  const worldY = minRow * CHUNK_HEIGHT;
  const worldW = (maxCol - minCol + 1) * CHUNK_WIDTH;
  const worldH = (maxRow - minRow + 1) * CHUNK_HEIGHT;

  // compute px size for overview that fits within pagePxW/H
  const scaleOverview = Math.min(pagePxW / worldW, pagePxH / worldH, 1);
  const overviewPxW = Math.max(1, Math.round(worldW * scaleOverview));
  const overviewPxH = Math.max(1, Math.round(worldH * scaleOverview));

  const overviewClone = svg.cloneNode(true) as SVGSVGElement;
  const zoomLayer2 = overviewClone.querySelector("g.zoom-layer") as SVGGElement | null;
  if (zoomLayer2) zoomLayer2.setAttribute("transform", "");
  overviewClone.setAttribute("viewBox", `${worldX} ${worldY} ${worldW} ${worldH}`);
  overviewClone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  overviewClone.setAttribute("width", `${overviewPxW}px`);
  overviewClone.setAttribute("height", `${overviewPxH}px`);
  overviewClone.style.width = `${overviewPxW}px`;
  overviewClone.style.height = `${overviewPxH}px`;
  overviewClone.style.display = "block";
  overviewClone.style.background = "#ffffff";

  const wrapperOv = document.createElement("div");
  wrapperOv.style.position = "fixed";
  wrapperOv.style.left = "-99999px";
  wrapperOv.style.top = "-99999px";
  wrapperOv.style.width = `${overviewPxW}px`;
  wrapperOv.style.height = `${overviewPxH}px`;
  wrapperOv.style.background = "#ffffff";
  wrapperOv.appendChild(overviewClone);
  document.body.appendChild(wrapperOv);

  const overviewCanvas = await html2canvas(wrapperOv, {
    backgroundColor: "#ffffff",
    scale: 1,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });
  document.body.removeChild(wrapperOv);

  const overviewData = overviewCanvas.toDataURL("image/png");
  const ovW_pt = pxToPt(overviewCanvas.width);
  const ovH_pt = pxToPt(overviewCanvas.height);
  const ovOffsetX = (pdfW_pt - ovW_pt) / 2;
  const ovOffsetY = (pdfH_pt - ovH_pt) / 2;

  pdf.addPage("a4", "landscape");
  pdf.addImage(overviewData, "PNG", ovOffsetX, ovOffsetY, ovW_pt, ovH_pt);
  pdf.setFontSize(12);
  pdf.text("Full Map Overview", 10, 16);

  pdf.save(filename);
}
