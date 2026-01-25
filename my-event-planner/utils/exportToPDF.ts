// utils/exportToPDF.ts
// Updated with Drawing Layer Support

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useSeatStore } from "@/store/seatStore";
import { useDrawingStore } from "@/store/drawingStore";
import { CHUNK_HEIGHT, CHUNK_WIDTH } from "@/types/Chunk";

/**
 * Inline all computed styles as attributes on SVG elements.
 * This ensures styles are preserved when the SVG is cloned.
 */
function inlineComputedStyles(svgElement: SVGSVGElement): void {
  // Include drawing layer elements in styling
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
 * Render drawing shapes into an SVG element
 * This ensures drawings are included in the export
 */
function renderDrawingShapesToSVG(svgElement: SVGSVGElement): void {
  const drawingState = useDrawingStore.getState();
  const shapes = drawingState.shapes;
  
  if (!shapes || shapes.length === 0) return;
  
  // Find or create the zoom layer
  let zoomLayer = svgElement.querySelector('g.zoom-layer');
  if (!zoomLayer) {
    zoomLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    zoomLayer.setAttribute('class', 'zoom-layer');
    svgElement.appendChild(zoomLayer);
  }
  
  // Create drawing layer group
  const drawingLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  drawingLayer.setAttribute('class', 'drawing-layer-export');
  
  // Sort shapes by z-index
  const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);
  
  sortedShapes.forEach((shape) => {
    const shapeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    shapeGroup.setAttribute('transform', `translate(${shape.x}, ${shape.y})`);
    shapeGroup.setAttribute('opacity', String(shape.opacity));
    
    // Create shape path based on type
    let pathD = '';
    const { type, width, height } = shape;
    
    switch (type) {
      case 'rectangle':
        pathD = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
        break;
      case 'ellipse':
        const rx = width / 2;
        const ry = height / 2;
        const kappa = 0.5522847498;
        const ox = rx * kappa;
        const oy = ry * kappa;
        pathD = `
          M ${rx} 0
          C ${rx + ox} 0, ${width} ${ry - oy}, ${width} ${ry}
          C ${width} ${ry + oy}, ${rx + ox} ${height}, ${rx} ${height}
          C ${rx - ox} ${height}, 0 ${ry + oy}, 0 ${ry}
          C 0 ${ry - oy}, ${rx - ox} 0, ${rx} 0
          Z
        `;
        break;
      case 'diamond':
        pathD = `
          M ${width / 2} 0
          L ${width} ${height / 2}
          L ${width / 2} ${height}
          L 0 ${height / 2}
          Z
        `;
        break;
      case 'arrow':
        const arrowHeadSize = 12;
        const arrowY = height / 2 || 0;
        pathD = `
          M 0 ${arrowY}
          L ${width - arrowHeadSize} ${arrowY}
          M ${width - arrowHeadSize} ${arrowY - arrowHeadSize / 2}
          L ${width} ${arrowY}
          L ${width - arrowHeadSize} ${arrowY + arrowHeadSize / 2}
        `;
        break;
      case 'line':
        const lineY = height / 2 || 0;
        pathD = `M 0 ${lineY} L ${width} ${lineY}`;
        break;
      default:
        pathD = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
    }
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', type === 'line' || type === 'arrow' ? 'none' : shape.fillColor);
    path.setAttribute('stroke', shape.strokeColor);
    path.setAttribute('stroke-width', String(shape.strokeWidth));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    shapeGroup.appendChild(path);
    
    // Add text if present
    if (shape.text && type !== 'line' && type !== 'arrow') {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(width / 2));
      text.setAttribute('y', String(height / 2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', shape.textColor || '#000');
      text.setAttribute('font-size', String(shape.fontSize || 14));
      text.setAttribute('font-weight', shape.fontWeight || 'normal');
      text.textContent = shape.text;
      shapeGroup.appendChild(text);
    }
    
    drawingLayer.appendChild(shapeGroup);
  });
  
  zoomLayer.appendChild(drawingLayer);
}

/**
 * Export each chunk as one PDF page maintaining exact aspect ratio.
 * The chunk aspect ratio (CHUNK_WIDTH:CHUNK_HEIGHT = 2000:1200 = 5:3) is preserved.
 * Uses high resolution rasterization for quality output.
 * Includes drawing layer shapes in the export.
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
  const CHUNK_ASPECT = CHUNK_WIDTH / CHUNK_HEIGHT;

  // Use custom page size that matches chunk aspect ratio
  const PAGE_WIDTH_IN = 10;
  const PAGE_HEIGHT_IN = PAGE_WIDTH_IN / CHUNK_ASPECT;

  // DPI settings
  const exportDPI = 150;
  const RASTER_SCALE = 3;
  
  // Calculate page dimensions in pixels at export DPI
  const pagePxW = Math.round(PAGE_WIDTH_IN * exportDPI);
  const pagePxH = Math.round(PAGE_HEIGHT_IN * exportDPI);

  // Create PDF with custom page size
  const pdfW_pt = PAGE_WIDTH_IN * 72;
  const pdfH_pt = PAGE_HEIGHT_IN * 72;
  
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [pdfW_pt, pdfH_pt],
    compress: true,
  });

  const pxToPt = (px: number) => (px * 72) / exportDPI;

  const chunks = useSeatStore.getState().getAllChunksSorted();
  
  if (!chunks || chunks.length === 0) {
    // Fallback: capture whole container
    const canvas = await html2canvas(container, { 
      backgroundColor: "#fff", 
      scale: RASTER_SCALE,
      useCORS: true 
    });
    const img = canvas.toDataURL("image/jpeg");
    const ratio = Math.min(pdfW_pt / (canvas.width / RASTER_SCALE), pdfH_pt / (canvas.height / RASTER_SCALE));
    const drawW = (canvas.width / RASTER_SCALE) * ratio;
    const drawH = (canvas.height / RASTER_SCALE) * ratio;
    const x = (pdfW_pt - drawW) / 2;
    const y = (pdfH_pt - drawH) / 2;
    pdf.addImage(img, "JPEG", x, y, drawW, drawH);
    pdf.save(filename);
    return;
  }

  // Helper: capture exactly one chunk area into a canvas
  async function captureChunkCanvas(row: number, col: number) {
    const clone = svg!.cloneNode(true) as SVGSVGElement;

    // Render drawing shapes into the clone
    renderDrawingShapesToSVG(clone);

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

    // Inline computed styles AFTER clone is in DOM
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
    const imgData = canvas.toDataURL("image/jpeg");

    // Calculate draw dimensions to fill the page
    const drawW_pt = pdfW_pt;
    const drawH_pt = pdfH_pt;

    if (i > 0) pdf.addPage([pdfW_pt, pdfH_pt], "landscape");
    
    // Draw image to fill the entire page
    pdf.addImage(imgData, "JPEG", 0, 0, drawW_pt, drawH_pt);
    
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

  // Calculate overview dimensions
  const worldAspect = worldW / worldH;
  let overviewPxW: number;
  let overviewPxH: number;
  
  if (worldAspect > CHUNK_ASPECT) {
    overviewPxW = pagePxW;
    overviewPxH = Math.round(overviewPxW / worldAspect);
  } else {
    overviewPxH = pagePxH;
    overviewPxW = Math.round(overviewPxH * worldAspect);
  }

  const overviewClone = svg.cloneNode(true) as SVGSVGElement;
  
  // Render drawing shapes into overview
  renderDrawingShapesToSVG(overviewClone);
  
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

  const overviewData = overviewCanvas.toDataURL("image/jpeg");
  pdf.addPage([pdfW_pt, pdfH_pt], "landscape");
  pdf.addImage(overviewData, "JPEG", ovOffsetX, ovOffsetY, ovW_pt, ovH_pt);
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  pdf.text("Full Map Overview", 10, 16);

  pdf.save(filename);
}