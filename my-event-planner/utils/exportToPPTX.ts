// /* src/utils/exportToPPTX.ts */
// import PptxGenJS from "pptxgenjs";
// import { Table } from "@/store/seatStore";

// /**
//  * Exports tables to an editable PowerPoint slide.
//  * Properly converts px -> inches (96 DPI) and scales content to fit slide.
//  *
//  * @param tables array from seatStore
//  * @param filename optional
//  */
// export async function exportToPPTX(tables: Table[], filename = "SeatPlan.pptx") {
//   if (!tables || tables.length === 0) {
//     console.warn("exportToPPTX: no tables provided");
//     return;
//   }

//   const pptx = new PptxGenJS();

//   // PPTX slide dimensions in inches (default)
//   const SLIDE_W_IN = 10; // inches
//   const SLIDE_H_IN = 5.625; // inches
//   const DPI = 96; // px per inch

//   // Convert tables px positions into a bounding box
//   let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
//   tables.forEach(t => {
//     const left = t.x - t.radius - 20; // seat offset margin
//     const right = t.x + t.radius + 20;
//     const top = t.y - t.radius - 20;
//     const bottom = t.y + t.radius + 20;
//     minX = Math.min(minX, left);
//     minY = Math.min(minY, top);
//     maxX = Math.max(maxX, right);
//     maxY = Math.max(maxY, bottom);
//   });
//   // fallback if NaN
//   if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

//   const contentW_px = Math.max(1, maxX - minX);
//   const contentH_px = Math.max(1, maxY - minY);

//   // slide dims in px
//   const slideW_px = SLIDE_W_IN * DPI;
//   const slideH_px = SLIDE_H_IN * DPI;

//   const margin_px = 24; // small margin in px
//   const scale = Math.min(
//     (slideW_px - margin_px * 2) / contentW_px,
//     (slideH_px - margin_px * 2) / contentH_px,
//     1
//   );

//   // compute offset to center
//   const offsetX_px = (slideW_px - contentW_px * scale) / 2 - minX * scale;
//   const offsetY_px = (slideH_px - contentH_px * scale) / 2 - minY * scale;

//   const slide = pptx.addSlide();
//   slide.background = { color: "FFFFFF" };

//   // helper px -> inches
//   const pxToIn = (px: number) => px / DPI;

//   for (const t of tables) {
//     const cx_px = t.x * scale + offsetX_px;
//     const cy_px = t.y * scale + offsetY_px;

//     // draw table
//     if (t.shape === "round") {
//       const w_px = t.radius * 2 * scale;
//       const h_px = w_px;
//       slide.addShape(pptx.ShapeType.ellipse, {
//         x: pxToIn(cx_px - w_px / 2),
//         y: pxToIn(cy_px - h_px / 2),
//         w: pxToIn(w_px),
//         h: pxToIn(h_px),
//         fill: { color: "1976D2" },
//         line: { color: "0D47A1", width: 1 },
//       });
//     } else {
//       const w_px = (t.radius * 2 + 20) * scale;
//       const h_px = (t.radius * 2 + 20) * scale;
//       slide.addShape(pptx.ShapeType.rect, {
//         x: pxToIn(cx_px - w_px / 2),
//         y: pxToIn(cy_px - h_px / 2),
//         w: pxToIn(w_px),
//         h: pxToIn(h_px),
//         fill: { color: "1976D2" },
//         line: { color: "0D47A1", width: 1 },
//       });
//     }

//     // table label (centered)
//     slide.addText(t.label || "", {
//       x: pxToIn(cx_px - (t.radius * scale)),
//       y: pxToIn(cy_px - (t.radius * scale) / 2),
//       w: pxToIn((t.radius * 2) * scale),
//       h: 0.3,
//       fontSize: 12,
//       color: "FFFFFF",
//       align: "center",
//     });

//     // seats
//     for (const s of t.seats) {
//       const sx_px = s.x * scale + offsetX_px;
//       const sy_px = s.y * scale + offsetY_px;
//       const sw_px = s.radius * 2 * scale;
//       const sh_px = sw_px;

//       slide.addShape(pptx.ShapeType.ellipse, {
//         x: pxToIn(sx_px - sw_px / 2),
//         y: pxToIn(sy_px - sh_px / 2),
//         w: pxToIn(sw_px),
//         h: pxToIn(sh_px),
//         fill: { color: "90CAF9" },
//         line: { color: "1565C0", width: 0.5 },
//       });

//       // seat label (small)
//       slide.addText(String(s.label || ""), {
//         x: pxToIn(sx_px - sw_px / 2),
//         y: pxToIn(sy_px - sh_px / 2),
//         w: pxToIn(sw_px),
//         h: pxToIn(sh_px),
//         fontSize: 8,
//         color: "0D47A1",
//         align: "center",
//         valign: "middle",
//       });
//     }
//   }

//   await pptx.writeFile({ fileName: filename });
// }


import PptxGenJS from "pptxgenjs";
import { Table } from "@/store/seatStore";

/**
 * Converts the tables and seats into an editable PowerPoint slide.
 * Maintains proper scaling and layout for different screen sizes.
 */
export async function exportToPPTX(tables: Table[], filename = "SeatPlan.pptx") {
  if (!tables || tables.length === 0) {
    console.warn("exportToPPTX: no tables provided");
    return;
  }

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  // Slide config
  const SLIDE_W_IN = 10;
  const SLIDE_H_IN = 5.625;
  const DPI = 96;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  tables.forEach(t => {
    const left = t.x - t.radius - 40;
    const right = t.x + t.radius + 40;
    const top = t.y - t.radius - 40;
    const bottom = t.y + t.radius + 40;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, bottom);
  });

  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  const slideW_px = SLIDE_W_IN * DPI;
  const slideH_px = SLIDE_H_IN * DPI;

  const scale = Math.min(
    (slideW_px - 80) / contentW,
    (slideH_px - 80) / contentH,
    1
  );

  const offsetX = (slideW_px - contentW * scale) / 2 - minX * scale;
  const offsetY = (slideH_px - contentH * scale) / 2 - minY * scale;

  const pxToIn = (px: number) => px / DPI;

  slide.background = { color: "FFFFFF" };

  // --- Draw tables ---
  for (const t of tables) {
    const cx = t.x * scale + offsetX;
    const cy = t.y * scale + offsetY;
    const diameter = t.radius * 2 * scale;
    const fillColor = "1976D2";

    if (t.shape === "round") {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: pxToIn(cx - t.radius * scale),
        y: pxToIn(cy - t.radius * scale),
        w: pxToIn(diameter),
        h: pxToIn(diameter),
        fill: { color: fillColor },
        line: { color: "0D47A1", width: 1 },
      });
    } else {
      slide.addShape(pptx.ShapeType.rect, {
        x: pxToIn(cx - t.radius * scale),
        y: pxToIn(cy - t.radius * scale),
        w: pxToIn(diameter),
        h: pxToIn(diameter),
        fill: { color: fillColor },
        line: { color: "0D47A1", width: 1 },
      });
    }

    // Label
    slide.addText(t.label || "", {
      x: pxToIn(cx - t.radius * scale),
      y: pxToIn(cy - 0.15 * DPI * scale),
      w: pxToIn(diameter),
      h: 0.3,
      fontSize: 12,
      color: "FFFFFF",
      align: "center",
    });

    // --- Seats ---
    for (const s of t.seats) {
      const sx = s.x * scale + offsetX;
      const sy = s.y * scale + offsetY;
      const sr = s.radius * scale;
      const seatColor = s.locked ? "B0BEC5" : "90CAF9";

      slide.addShape(pptx.ShapeType.ellipse, {
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

  await pptx.writeFile({ fileName: filename });
}
