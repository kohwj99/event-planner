// src/utils/exportToPDF.ts
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useSeatStore } from "@/store/seatStore";
import { CHUNK_HEIGHT, CHUNK_WIDTH } from "@/types/Chunk";

/**
 * Inline all computed styles as attributes on SVG elements.
 * This ensures styles are preserved when the SVG is cloned.
 */
function inlineComputedStyles(svgElement: SVGSVGElement): void {
  const elementsToStyle = svgElement.querySelectorAll('circle, rect, ellipse, line, path, text, polygon, polyline');
  
  elementsToStyle.forEach((el) => {
    const computed = window.getComputedStyle(el);
    
    // Inline fill
    const fill = computed.fill;
    if (fill && fill !== 'none') {
      el.setAttribute('fill', fill);
    }
    
    // Inline stroke
    const stroke = computed.stroke;
    if (stroke && stroke !== 'none') {
      el.setAttribute('stroke', stroke);
    }
    
    // Inline stroke-width
    const strokeWidth = computed.strokeWidth;
    if (strokeWidth) {
      el.setAttribute('stroke-width', strokeWidth);
    }
    
    // Inline stroke-dasharray
    const strokeDasharray = computed.strokeDasharray;
    if (strokeDasharray && strokeDasharray !== 'none') {
      el.setAttribute('stroke-dasharray', strokeDasharray);
    }
    
    // Inline opacity
    const opacity = computed.opacity;
    if (opacity && opacity !== '1') {
      el.setAttribute('opacity', opacity);
    }
    
    // For text elements, inline font properties
    if (el.tagName.toLowerCase() === 'text') {
      const fontSize = computed.fontSize;
      const fontFamily = computed.fontFamily;
      const fontWeight = computed.fontWeight;
      
      if (fontSize) el.setAttribute('font-size', fontSize);
      if (fontFamily) el.setAttribute('font-family', fontFamily);
      if (fontWeight && fontWeight !== 'normal' && fontWeight !== '400') {
        el.setAttribute('font-weight', fontWeight);
      }
    }
  });
}

/**
 * Export each chunk as one PDF page maintaining exact aspect ratio.
 * The chunk aspect ratio (CHUNK_WIDTH:CHUNK_HEIGHT = 2000:1200 = 5:3) is preserved.
 * Uses high resolution rasterization for quality output.
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

  // Chunk aspect ratio
  const CHUNK_ASPECT = CHUNK_WIDTH / CHUNK_HEIGHT; // 2000/1200 = 1.6667

  // Use custom page size that matches chunk aspect ratio
  // We'll use a page that's 10 inches wide to maintain good resolution
  const PAGE_WIDTH_IN = 10;
  const PAGE_HEIGHT_IN = PAGE_WIDTH_IN / CHUNK_ASPECT; // ~6 inches

  // DPI settings
  const exportDPI = 150;
  const RASTER_SCALE = 3; // 3x for good quality without being too heavy
  
  // Calculate page dimensions in pixels at export DPI
  const pagePxW = Math.round(PAGE_WIDTH_IN * exportDPI);
  const pagePxH = Math.round(PAGE_HEIGHT_IN * exportDPI);

  // Create PDF with custom page size (dimensions in inches converted to points: 1 inch = 72 points)
  const pdfW_pt = PAGE_WIDTH_IN * 72;
  const pdfH_pt = PAGE_HEIGHT_IN * 72;
  
  const pdf = new jsPDF({ 
    orientation: "landscape", 
    unit: "pt", 
    format: [pdfW_pt, pdfH_pt] // Custom format matching chunk aspect ratio
  });

  // px -> points conversion for given DPI
  const pxToPt = (px: number) => (px * 72) / exportDPI;

  const chunks = useSeatStore.getState().getAllChunksSorted();
  if (!chunks || chunks.length === 0) {
    // fallback: capture whole container
    const canvas = await html2canvas(container, { 
      backgroundColor: "#fff", 
      scale: RASTER_SCALE,
      useCORS: true 
    });
    const img = canvas.toDataURL("image/png");
    const ratio = Math.min(pdfW_pt / (canvas.width / RASTER_SCALE), pdfH_pt / (canvas.height / RASTER_SCALE));
    const drawW = (canvas.width / RASTER_SCALE) * ratio;
    const drawH = (canvas.height / RASTER_SCALE) * ratio;
    const x = (pdfW_pt - drawW) / 2;
    const y = (pdfH_pt - drawH) / 2;
    pdf.addImage(img, "PNG", x, y, drawW, drawH);
    pdf.save(filename);
    return;
  }

  // Helper: capture exactly one chunk area into a canvas
  async function captureChunkCanvas(row: number, col: number) {
    const clone = svg!.cloneNode(true) as SVGSVGElement;

    // Reset transform on zoom-layer to get world coordinates
    const zoomLayer = clone.querySelector("g.zoom-layer") as SVGGElement | null;
    if (zoomLayer) {
      zoomLayer.setAttribute("transform", "");
    }

    // Set viewBox exactly to chunk world rect
    const viewBoxX = col * CHUNK_WIDTH;
    const viewBoxY = row * CHUNK_HEIGHT;
    clone.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${CHUNK_WIDTH} ${CHUNK_HEIGHT}`);

    // Use xMidYMid meet to maintain aspect ratio
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // Size the clone to page pixel dimensions
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
    wrapper.style.overflow = "hidden";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // IMPORTANT: Inline computed styles AFTER clone is in DOM so getComputedStyle works
    inlineComputedStyles(clone);

    // Rasterize at high scale for quality
    const canvas = await html2canvas(wrapper, {
      backgroundColor: "#ffffff",
      scale: RASTER_SCALE,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    document.body.removeChild(wrapper);
    return canvas;
  }

  // Iterate chunks (sorted top-left -> right -> down)
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const canvas = await captureChunkCanvas(c.row, c.col);
    const imgData = canvas.toDataURL("image/png");

    // Calculate draw dimensions to fill the page
    const drawW_pt = pdfW_pt;
    const drawH_pt = pdfH_pt;

    if (i > 0) pdf.addPage([pdfW_pt, pdfH_pt], "landscape");
    
    // Draw image to fill the entire page
    pdf.addImage(imgData, "PNG", 0, 0, drawW_pt, drawH_pt);
    
    // Add chunk label
    pdf.setFontSize(10);
    pdf.setTextColor(128, 128, 128);
  }

  // Overview page: render bounding box for all chunks
  const minCol = Math.min(...chunks.map((ch) => ch.col));
  const maxCol = Math.max(...chunks.map((ch) => ch.col));
  const minRow = Math.min(...chunks.map((ch) => ch.row));
  const maxRow = Math.max(...chunks.map((ch) => ch.row));
  const worldX = minCol * CHUNK_WIDTH;
  const worldY = minRow * CHUNK_HEIGHT;
  const worldW = (maxCol - minCol + 1) * CHUNK_WIDTH;
  const worldH = (maxRow - minRow + 1) * CHUNK_HEIGHT;

  // Calculate overview dimensions that fit within page while maintaining aspect ratio
  const worldAspect = worldW / worldH;
  let overviewPxW: number;
  let overviewPxH: number;
  
  if (worldAspect > CHUNK_ASPECT) {
    // World is wider, fit by width
    overviewPxW = pagePxW;
    overviewPxH = Math.round(overviewPxW / worldAspect);
  } else {
    // World is taller, fit by height
    overviewPxH = pagePxH;
    overviewPxW = Math.round(overviewPxH * worldAspect);
  }

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

  // IMPORTANT: Inline computed styles AFTER clone is in DOM so getComputedStyle works
  inlineComputedStyles(overviewClone);

  const overviewCanvas = await html2canvas(wrapperOv, {
    backgroundColor: "#ffffff",
    scale: RASTER_SCALE,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });
  document.body.removeChild(wrapperOv);

  // Calculate overview position to center on page
  const ovW_pt = pxToPt(overviewPxW);
  const ovH_pt = pxToPt(overviewPxH);
  const ovOffsetX = (pdfW_pt - ovW_pt) / 2;
  const ovOffsetY = (pdfH_pt - ovH_pt) / 2;

  const overviewData = overviewCanvas.toDataURL("image/png");
  pdf.addPage([pdfW_pt, pdfH_pt], "landscape");
  pdf.addImage(overviewData, "PNG", ovOffsetX, ovOffsetY, ovW_pt, ovH_pt);
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  pdf.text("Full Map Overview", 10, 16);

  pdf.save(filename);
}