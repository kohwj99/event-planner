// 'use client';

// import { useEffect, useRef } from 'react';
// import * as d3 from 'd3';
// import Box from '@mui/material/Box';
// import Paper from '@mui/material/Paper';

// import { useSeatStore, Table, Seat } from '@/store/seatStore';
// import { createRoundTable } from '@/utils/generateTable';

// export default function PlaygroundCanvas() {
//   const svgRef = useRef<SVGSVGElement | null>(null);

//   const {
//     tables,
//     addTable,
//     moveTable,
//     setSelectedTable,
//     selectSeat,
//     lockSeat,
//     clearSeat,
//     selectedTableId,
//     selectedSeatId,
//   } = useSeatStore();



//   // Initialize dummy tables if empty
//   useEffect(() => {
//     if (tables.length === 0) {
//       const t1 = createRoundTable('t1', 300, 250, 60, 8, 'VIP A');
//       const t2 = createRoundTable('t2', 700, 400, 60, 10, 'Guest B');
//       addTable(t1);
//       addTable(t2);
//     }
//   }, [tables, addTable]);

//   useEffect(() => {
//     const svg = d3.select(svgRef.current);
//     svg.selectAll('*').remove();

//     // Bind tables -> group elements
//     const tableGroups = svg
//       .selectAll<SVGGElement, Table>('.table-group')
//       .data(tables, (d: Table) => d.id)
//       .join('g')
//       .attr('class', 'table-group')
//       .attr('transform', (d) => `translate(${d.x},${d.y})`)
//       .style('cursor', 'grab');

//     // TABLE: circle + label
//     // Remove existing children first (join above creates fresh groups),
//     // then append shapes (these get overwritten on re-render)
//     tableGroups
//       .append('circle')
//       .attr('r', (d) => d.radius)
//       .attr('fill', (d) => (d.id === selectedTableId ? '#1565c0' : '#1976d2'))
//       .attr('stroke', '#0d47a1')
//       .attr('stroke-width', 2)
//       .on('click', function (event, d) {
//         // stop propagation so svg click doesn't deselect immediately
//         event.stopPropagation();
//         setSelectedTable(d.id);
//       });

//     tableGroups
//       .append('text')
//       .attr('y', 5)
//       .attr('text-anchor', 'middle')
//       .attr('fill', 'white')
//       .attr('font-size', '14px')
//       .text((d) => d.label);

//     // SEATS: for each table group, bind seats
//     tableGroups.each(function (tableDatum) {
//       // `this` is the group element for the table
//       const group = d3.select(this) as d3.Selection<SVGGElement, Table, null, undefined>;

//       // bind seat data with Seat typing
//       const seatsSel = group
//         .selectAll<SVGCircleElement, Seat>('circle.seat')
//         .data(tableDatum.seats, (s) => s.id);

//       // JOIN: enter + update (we use join to ensure proper update/enter/exit)
//       seatsSel
//         .join(
//           (enter) =>
//             enter
//               .append('circle')
//               .attr('class', 'seat')
//               .attr('cx', (s) => s.x - tableDatum.x)
//               .attr('cy', (s) => s.y - tableDatum.y)
//               .attr('r', (s) => s.radius)
//               .attr('fill', (s) => {
//                 if (s.locked) return '#b0bec5';
//                 if (s.selected) return '#ffb300';
//                 return '#90caf9';
//               })
//               .attr('stroke', '#1565c0')
//               .attr('stroke-width', 1)
//               .style('cursor', 'pointer'),
//           (update) =>
//             update
//               .attr('cx', (s) => s.x - tableDatum.x)
//               .attr('cy', (s) => s.y - tableDatum.y)
//               .attr('r', (s) => s.radius)
//               .attr('fill', (s) => {
//                 if (s.locked) return '#b0bec5';
//                 if (s.selected) return '#ffb300';
//                 return '#90caf9';
//               }),
//           (exit) => exit.remove()
//         )
//         // Add event handlers after join so they attach for both enter & update selections
//         .on('click', function (event, seatDatum) {
//           event.stopPropagation();
//           // seatDatum is typed as Seat
//           selectSeat(tableDatum.id, seatDatum.id);
//         })
//         .on('contextmenu', function (event, seatDatum) {
//           event.preventDefault();
//           lockSeat(tableDatum.id, seatDatum.id, !seatDatum.locked);
//         })
//         .on('dblclick', function (event, seatDatum) {
//           clearSeat(tableDatum.id, seatDatum.id);
//         });

//       // Seat number labels (text). Put them after seat circles so they appear above.
//       const seatLabels = group
//         .selectAll<SVGTextElement, Seat>('text.seat-number')
//         .data(tableDatum.seats, (s) => s.id);

//       seatLabels
//         .join(
//           (enter) =>
//             enter
//               .append('text')
//               .attr('class', 'seat-number')
//               .attr('x', (s) => s.x - tableDatum.x)
//               .attr('y', (s) => s.y - tableDatum.y + 3)
//               .attr('text-anchor', 'middle')
//               .attr('fill', '#0d47a1')
//               .attr('font-size', '10px')
//               .text((s) => s.seatNumber),
//           (update) =>
//             update
//               .attr('x', (s) => s.x - tableDatum.x)
//               .attr('y', (s) => s.y - tableDatum.y + 3)
//               .text((s) => s.seatNumber),
//           (exit) => exit.remove()
//         );
//     });

//     // DRAG: move the whole group; moveTable updates seat absolute positions inside store
//     const dragBehavior = d3
//       .drag<SVGGElement, Table>()
//       .on('start', function () {
//         d3.select(this).style('cursor', 'grabbing');
//       })
//       .on('drag', function (event, d) {
//         // visually transform group
//         d3.select(this).attr('transform', `translate(${event.x},${event.y})`);
//         // write back to store (this will update seats via moveTable)
//         moveTable(d.id, event.x, event.y);
//       })
//       .on('end', function () {
//         d3.select(this).style('cursor', 'grab');
//       });

//     // call with typed selection
//     (tableGroups as d3.Selection<SVGGElement, Table, SVGSVGElement | null, unknown>).call(dragBehavior);

//     // Deselect on background click
//     svg.on('click', () => {
//       setSelectedTable(null);
//       // clear selected seat as well
//       selectSeat('', null);
//     });
//   }, [
//     tables,
//     moveTable,
//     setSelectedTable,
//     selectSeat,
//     lockSeat,
//     clearSeat,
//     selectedTableId,
//     selectedSeatId,
//   ]);

//   return (
//     <div id="playground-canvas" style={{ position: 'relative', width: '100%', height: '100%' }}>
//       <Paper
//         elevation={0}
//         sx={{
//           position: 'absolute',
//           inset: 0,
//           bgcolor: '#fafafa',
//         }}
//       >
//         <Box
//           component="svg"
//           ref={svgRef}
//           sx={{
//             width: '100%',
//             height: '100%',
//             display: 'block',
//             userSelect: 'none',
//           }}
//           preserveAspectRatio="xMidYMid meet"
//         />
//       </Paper>
//     </div>
//   );
// }

'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Fab from '@mui/material/Fab';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import AddIcon from '@mui/icons-material/Add';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import { jsPDF } from 'jspdf';
import PptxGenJS from "pptxgenjs";

import { useSeatStore, Table, Seat } from '@/store/seatStore';
import { createRoundTable } from '@/utils/generateTable';
import { exportToPDF } from '@/utils/exportToPDF';
import { exportToPPTX } from '@/utils/exportToPPTX';

// Helper to export current canvas as PNG (used for both PDF/PPTX)
async function exportCanvasAsImage(svgElement: SVGSVGElement): Promise<string> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const image = new Image();
  const imgLoad = new Promise<HTMLImageElement>((resolve) => {
    image.onload = () => resolve(image);
  });
  image.src = url;
  await imgLoad;
  const canvas = document.createElement('canvas');
  const scale = 2; // high resolution
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/png');
}

// --- Main Component ---
export default function PlaygroundCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
	const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [zoomLevel, setZoomLevel] = useState(1);
  const {
    tables,
    addTable,
    moveTable,
    setSelectedTable,
    selectSeat,
    lockSeat,
    clearSeat,
    selectedTableId,
    selectedSeatId,
  } = useSeatStore();

  // Initialize dummy tables
  useEffect(() => {
    if (tables.length === 0) {
      const t1 = createRoundTable('t1', 300, 250, 60, 8, 'VIP A');
      const t2 = createRoundTable('t2', 700, 400, 60, 10, 'Guest B');
      addTable(t1);
      addTable(t2);
    }
  }, [tables, addTable]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'zoom-layer');
    gRef.current = g.node();

    // --- GRID BACKGROUND ---
    const gridSize = 50;
    const width = svgRef.current?.clientWidth || 1600;
    const height = svgRef.current?.clientHeight || 900;

    const gridLines = g.append('g').attr('class', 'grid-lines');

    for (let x = 0; x < width; x += gridSize) {
      gridLines
        .append('line')
        .attr('x1', x)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', height)
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 0.5);
    }

    for (let y = 0; y < height; y += gridSize) {
      gridLines
        .append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', width)
        .attr('y2', y)
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 0.5);
    }

    // Export boundary
    g.append('rect')
      .attr('x', 50)
      .attr('y', 50)
      .attr('width', width - 100)
      .attr('height', height - 100)
      .attr('fill', 'none')
      .attr('stroke', '#bdbdbd')
      .attr('stroke-dasharray', '6,4')
      .attr('stroke-width', 1);

    // --- TABLES + SEATS ---
    const tableGroups = g
      .selectAll<SVGGElement, Table>('.table-group')
      .data(tables, (d: Table) => d.id)
      .join('g')
      .attr('class', 'table-group')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'grab');

    // Tables
    tableGroups
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (d.id === selectedTableId ? '#1565c0' : '#1976d2'))
      .attr('stroke', '#0d47a1')
      .attr('stroke-width', 2)
      .on('click', function (event, d) {
        event.stopPropagation();
        setSelectedTable(d.id);
      });

    tableGroups
      .append('text')
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '14px')
      .text((d) => d.label);

    // Seats
    tableGroups.each(function (tableDatum) {
      const group = d3.select(this);
      group
        .selectAll<SVGCircleElement, Seat>('circle.seat')
        .data(tableDatum.seats, (s) => s.id)
        .join('circle')
        .attr('class', 'seat')
        .attr('cx', (s) => s.x - tableDatum.x)
        .attr('cy', (s) => s.y - tableDatum.y)
        .attr('r', (s) => s.radius)
        .attr('fill', (s) => {
          if (s.locked) return '#b0bec5';
          if (s.selected) return '#ffb300';
          return '#90caf9';
        })
        .attr('stroke', '#1565c0')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', (event, s) => {
          event.stopPropagation();
          selectSeat(tableDatum.id, s.id);
        })
        .on('contextmenu', (event, s) => {
          event.preventDefault();
          lockSeat(tableDatum.id, s.id, !s.locked);
        })
        .on('dblclick', (event, s) => {
          clearSeat(tableDatum.id, s.id);
        });

      // Seat numbers
      group
        .selectAll<SVGTextElement, Seat>('text.seat-number')
        .data(tableDatum.seats, (s) => s.id)
        .join('text')
        .attr('class', 'seat-number')
        .attr('x', (s) => s.x - tableDatum.x)
        .attr('y', (s) => s.y - tableDatum.y + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0d47a1')
        .attr('font-size', '10px')
        .text((s) => s.seatNumber);
    });

    // Table drag
    const drag = d3
      .drag<SVGGElement, Table>()
      .on('start', function () {
        d3.select(this).style('cursor', 'grabbing');
      })
      .on('drag', function (event, d) {
        d3.select(this).attr('transform', `translate(${event.x},${event.y})`);
        moveTable(d.id, event.x, event.y);
      })
      .on('end', function () {
        d3.select(this).style('cursor', 'grab');
      });

    tableGroups.call(drag as any);

    // Deselect background
    svg.on('click', () => {
      setSelectedTable(null);
      selectSeat('', null);
    });

    // --- ZOOM + PAN ---
    zoomBehavior.current = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoomBehavior.current as any);
    svg.call((zoomBehavior.current as any).transform, d3.zoomIdentity);
  }, [
    tables,
    moveTable,
    setSelectedTable,
    selectSeat,
    lockSeat,
    clearSeat,
    selectedTableId,
    selectedSeatId,
  ]);

  // --- Manual Zoom Controls ---
  const handleZoom = (factor: number) => {
    const svgSel = d3.select(svgRef.current);
    svgSel.transition().duration(300).call((sel: any) => sel.call((zoomBehavior.current as any).scaleBy, factor));
  };

  const handleResetZoom = () => {
    const svgSel = d3.select(svgRef.current);
    svgSel.transition().duration(300).call((sel: any) => sel.call((zoomBehavior.current as any).transform, d3.zoomIdentity));
    setZoomLevel(1);
  };

  // // --- Export to PDF ---
  // const handleExportPDF = async () => {
  //   if (!svgRef.current) return;
  //   const imgData = await exportCanvasAsImage(svgRef.current);
  //   const pdf = new jsPDF('l', 'pt', 'a4');
  //   const pageWidth = pdf.internal.pageSize.getWidth();
  //   const pageHeight = pdf.internal.pageSize.getHeight();
  //   pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
  //   pdf.save('SeatPlan.pdf');
  // };

  // // --- Export to PowerPoint ---
  // const handleExportPPTX = async () => {
  //   if (!svgRef.current) return;
  //   const imgData = await exportCanvasAsImage(svgRef.current);
  //   const pptx = new PptxGenJS();
  //   const slide = pptx.addSlide();
  //   slide.addImage({ data: imgData, x: 0, y: 0, w: 10, h: 7.5 });
  //   await pptx.writeFile('SeatPlan.pptx');
  // };

  return (
    <div id="playground-canvas" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Paper elevation={0} sx={{ position: 'absolute', inset: 0, bgcolor: '#fafafa' }}>
        <Box
          component="svg"
          ref={svgRef}
          sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            userSelect: 'none',
          }}
          preserveAspectRatio="xMidYMid meet"
        />
      </Paper>

      {/* Floating Controls */}
      <Stack spacing={1} sx={{ position: 'absolute', bottom: 24, right: 24, alignItems: 'center' }}>
        {/* Add Table */}
        <Tooltip title="Add Table">
          <Fab color="primary" size="medium">
            <AddIcon />
          </Fab>
        </Tooltip>

        {/* Export buttons */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Tooltip title="Export to PDF">
            <Fab size="small" color="secondary" onClick={() => exportToPDF("playground-canvas")}>
              <PictureAsPdfIcon fontSize="small" />
            </Fab>
          </Tooltip>

          <Tooltip title="Export to PowerPoint">
            <Fab size="small" color="secondary" onClick={() => exportToPPTX(tables)}>
              <SlideshowIcon fontSize="small" />
            </Fab>
          </Tooltip>
        </Stack>

        {/* Zoom buttons */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Tooltip title="Zoom Out">
            <Fab size="small" onClick={() => handleZoom(0.8)}>
              <ZoomOutIcon fontSize="small" />
            </Fab>
          </Tooltip>

          <Tooltip title="Reset View">
            <Fab size="small" onClick={handleResetZoom}>
              <CenterFocusStrongIcon fontSize="small" />
            </Fab>
          </Tooltip>

          <Tooltip title="Zoom In">
            <Fab size="small" onClick={() => handleZoom(1.25)}>
              <ZoomInIcon fontSize="small" />
            </Fab>
          </Tooltip>
        </Stack>
      </Stack>
    </div>
  );
}
