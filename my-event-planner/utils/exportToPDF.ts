// /* src/utils/exportToPDF.ts */
// import jsPDF from "jspdf";
// import html2canvas from "html2canvas";

// /**
//  * Convert an SVG element (or an HTML container) to a PDF.
//  * Tries to serialize SVG(s) to a PNG via <image> draw on canvas (more reliable),
//  * and falls back to html2canvas if serialization doesn't work.
//  *
//  * @param elementId id of wrapper element that contains the playground (should include your svg)
//  * @param filename optional output filename
//  */
// export async function exportToPDF(elementId: string, filename = "SeatPlan.pdf") {
//   const el = document.getElementById(elementId);
//   if (!el) {
//     console.error("exportToPDF: element not found:", elementId);
//     return;
//   }

//   // Helper: serialize first SVG child into dataURL
//   async function svgToPngDataUrl(svgEl: SVGSVGElement, scale = 2) {
//     // Inline computed styles for the SVG (basic method)
//     const copy = svgEl.cloneNode(true) as SVGSVGElement;
//     const serializer = new XMLSerializer();
//     const svgStr = serializer.serializeToString(copy);
//     const svg64 = btoa(unescape(encodeURIComponent(svgStr)));
//     const dataUrl = `data:image/svg+xml;base64,${svg64}`;

//     // Load into Image, draw onto canvas
//     const img = await new Promise<HTMLImageElement>((resolve, reject) => {
//       const image = new Image();
//       image.onload = () => resolve(image);
//       image.onerror = (e) => reject(e);
//       // Use CORS friendly - same-origin or inline svg avoids CORS
//       image.crossOrigin = "anonymous";
//       image.src = dataUrl;
//     });

//     const w = img.width * scale;
//     const h = img.height * scale;
//     const canvas = document.createElement("canvas");
//     canvas.width = w;
//     canvas.height = h;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) throw new Error("Canvas 2D context not available");

//     // White background
//     ctx.fillStyle = "#ffffff";
//     ctx.fillRect(0, 0, w, h);
//     ctx.drawImage(img, 0, 0, w, h);

//     return canvas.toDataURL("image/png");
//   }

//   // Try: if the element contains at least one SVG, serialize the first and render that
//   try {
//     const svgEl = el.querySelector("svg") as SVGSVGElement | null;
//     if (svgEl) {
//       // sometimes svg width/height attributes are missing; ensure they exist
//       if (!svgEl.getAttribute("width") || !svgEl.getAttribute("height")) {
//         const bbox = svgEl.getBoundingClientRect();
//         svgEl.setAttribute("width", `${Math.round(bbox.width)}`);
//         svgEl.setAttribute("height", `${Math.round(bbox.height)}`);
//       }

//       // scale for higher-resolution output
//       const SCALE = 2;
//       const imgData = await svgToPngDataUrl(svgEl, SCALE);

//       // use jsPDF in landscape A4
//       const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
//       const pdfW = pdf.internal.pageSize.getWidth();
//       const pdfH = pdf.internal.pageSize.getHeight();

//       // create temporary image to get pixel dimensions
//       const tmpImg = new Image();
//       tmpImg.src = imgData;
//       await new Promise((res) => (tmpImg.onload = res));

//       const imgW = tmpImg.width;
//       const imgH = tmpImg.height;
//       const ratio = Math.min(pdfW / imgW, pdfH / imgH);
//       const x = (pdfW - imgW * ratio) / 2;
//       const y = (pdfH - imgH * ratio) / 2;

//       pdf.addImage(imgData, "PNG", x, y, imgW * ratio, imgH * ratio);
//       pdf.save(filename);
//       return;
//     }
//   } catch (err) {
//     console.warn("exportToPDF: svg serialization path failed, falling back to html2canvas", err);
//   }

//   // Fallback: render the full element to canvas using html2canvas
//   try {
//     const canvas = await html2canvas(el, {
//       backgroundColor: "#ffffff",
//       scale: 2,
//       useCORS: true,
//       logging: false,
//     });
//     const imgData = canvas.toDataURL("image/png");
//     const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
//     const pdfW = pdf.internal.pageSize.getWidth();
//     const pdfH = pdf.internal.pageSize.getHeight();
//     const imgW = canvas.width;
//     const imgH = canvas.height;
//     const ratio = Math.min(pdfW / imgW, pdfH / imgH);
//     const x = (pdfW - imgW * ratio) / 2;
//     const y = (pdfH - imgH * ratio) / 2;
//     pdf.addImage(imgData, "PNG", x, y, imgW * ratio, imgH * ratio);
//     pdf.save(filename);
//   } catch (err) {
//     console.error("exportToPDF failed:", err);
//   }
// }


import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Exports the playground area (SVG inside the given container) to a landscape A4 PDF.
 * Handles both SVG serialization and html2canvas fallback automatically.
 *
 * @param elementId - The DOM id of your playground container (e.g. "playground-canvas")
 * @param filename - Optional filename (default: "SeatPlan.pdf")
 */
export async function exportToPDF(elementId: string, filename = "SeatPlan.pdf") {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error("exportToPDF: element not found:", elementId);
    return;
  }

  /**
   * Convert an SVG to PNG dataURL
   */
  async function svgToPngDataUrl(svgEl: SVGSVGElement, scale = 2): Promise<string> {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const svg64 = btoa(unescape(encodeURIComponent(svgStr)));
    const dataUrl = `data:image/svg+xml;base64,${svg64}`;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.crossOrigin = "anonymous";
      image.src = dataUrl;
    });

    const w = img.width * scale;
    const h = img.height * scale;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");

    // white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL("image/png");
  }

  try {
    // Try SVG serialization first
    const svgEl = el.querySelector("svg") as SVGSVGElement | null;
    if (svgEl) {
      // Ensure width/height exist
      if (!svgEl.getAttribute("width") || !svgEl.getAttribute("height")) {
        const bbox = svgEl.getBoundingClientRect();
        svgEl.setAttribute("width", `${Math.round(bbox.width)}`);
        svgEl.setAttribute("height", `${Math.round(bbox.height)}`);
      }

      const imgData = await svgToPngDataUrl(svgEl, 2);
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      const tmpImg = new Image();
      tmpImg.src = imgData;
      await new Promise((res) => (tmpImg.onload = res));

      const imgW = tmpImg.width;
      const imgH = tmpImg.height;
      const ratio = Math.min(pdfW / imgW, pdfH / imgH);
      const x = (pdfW - imgW * ratio) / 2;
      const y = (pdfH - imgH * ratio) / 2;

      pdf.addImage(imgData, "PNG", x, y, imgW * ratio, imgH * ratio);
      pdf.save(filename);
      return;
    }
  } catch (err) {
    console.warn("exportToPDF: SVG path failed, fallback to html2canvas", err);
  }

  // Fallback: html2canvas snapshot
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = Math.min(pdfW / imgW, pdfH / imgH);
    const x = (pdfW - imgW * ratio) / 2;
    const y = (pdfH - imgH * ratio) / 2;

    pdf.addImage(imgData, "PNG", x, y, imgW * ratio, imgH * ratio);
    pdf.save(filename);
  } catch (err) {
    console.error("exportToPDF failed:", err);
  }
}
