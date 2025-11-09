'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { forceSimulation, forceCollide, forceRadial } from 'd3-force';

import AddTableModal, { TableConfig } from '@/components/molecules/AddTableModal';

import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { createRoundTable, createRectangleTable } from '@/utils/generateTable';
import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/types/Chunk';
import { Table } from '@/types/Table';
import { Seat } from '@/types/Seat';
import SeatingStatsPanel from '../molecules/SeatingStatsPanel';

export default function PlaygroundCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gLayerRef = useRef<SVGGElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [connectorGap, setConnectorGap] = useState<number>(8);

  const {
    tables,
    chunks,
    addTable,
    moveTable,
    setSelectedTable,
    selectSeat,
    lockSeat,
    clearSeat,
    selectedTableId,
    selectedSeatId,
    ensureChunkExists,
    assignTableToChunk,
    expandWorldIfNeeded,
    cleanupEmptyChunks,
  } = useSeatStore();

  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const guests = useMemo(() => [...hostGuests, ...externalGuests], [hostGuests, externalGuests]);
  const guestLookup = useMemo(() => {
    const m: Record<string, any> = {};
    guests.forEach((g) => (m[g.id] = g));
    return m;
  }, [guests]);

  /** ---------- Helpers ---------- */
  function boxRectFromCenter(b: any) {
    return {
      x1: b.x - b.width / 2,
      x2: b.x + b.width / 2,
      y1: b.y - b.height / 2,
      y2: b.y + b.height / 2,
    };
  }

  function rectsOverlap(a: any, b: any, padding = 6) {
    return !(
      a.x2 + padding < b.x1 ||
      a.x1 - padding > b.x2 ||
      a.y2 + padding < b.y1 ||
      a.y1 - padding > b.y2
    );
  }

  function getRankStars(ranking: number | string | undefined) {
    if (ranking === undefined || ranking === null) return '';
    const r = Number(ranking) || Infinity;
    if (r <= 1) return ' ⭐⭐⭐⭐';
    if (r <= 2) return ' ⭐⭐⭐';
    if (r <= 3) return ' ⭐⭐';
    if (r <= 4) return ' ⭐';
    return '';
  }

  //attempted at making a function that will run on button click to arrange the textbox as compact as possible but failed, moving on first
  const autoArrangeGuestBoxes = (table: Table) => {
    const seats = table.seats || [];
    const seatR = 12; // default seat radius if needed
    const initialDist = 50; // fixed distance from table edge

    // Prepare box data with radial angle
    const boxes: {
      seat: Seat;
      width: number;
      height: number;
      angle: number;
      textX: number;
      textY: number;
    }[] = [];

    seats.forEach((s, i) => {
      if (!s.assignedGuestId) return;
      const guest = guestLookup[s.assignedGuestId];
      if (!guest) return;

      const name = `${guest.salutation || ''} ${guest.name || ''}`.trim();
      const stars = getRankStars(guest.ranking);
      const line1 = `${name}${stars}`;
      const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();
      const estTextWidth = Math.max(line1.length, line2.length) * 7;
      const width = Math.min(Math.max(60, estTextWidth + 20), 300);
      const height = 14 * 2 + 12;

      // Compute initial angle around table
      const angle = (i / seats.length) * 2 * Math.PI;

      // Initial position along the ring
      const textX = table.x + Math.cos(angle) * (table.radius + initialDist);
      const textY = table.y + Math.sin(angle) * (table.radius + initialDist);

      boxes.push({ seat: s, width, height, angle, textX, textY });
    });

    // --- Tangential relaxation to prevent overlap ---
    const maxIter = 200;
    const stepAngle = 0.02; // ~1 degree in radians
    const padding = 6;

    for (let iter = 0; iter < maxIter; iter++) {
      let moved = false;
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i];
        const aRect = boxRectFromCenter({ x: a.textX, y: a.textY, width: a.width, height: a.height });

        for (let j = i + 1; j < boxes.length; j++) {
          const b = boxes[j];
          const bRect = boxRectFromCenter({ x: b.textX, y: b.textY, width: b.width, height: b.height });

          if (rectsOverlap(aRect, bRect, padding)) {
            // Move both boxes tangentially along the ring
            a.angle += stepAngle;
            b.angle -= stepAngle;
            a.textX = table.x + Math.cos(a.angle) * (table.radius + initialDist);
            a.textY = table.y + Math.sin(a.angle) * (table.radius + initialDist);
            b.textX = table.x + Math.cos(b.angle) * (table.radius + initialDist);
            b.textY = table.y + Math.sin(b.angle) * (table.radius + initialDist);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    // --- Save positions to store ---
    const newSeats = seats.map((s) => {
      const b = boxes.find((bx) => bx.seat.id === s.id);
      if (!b) return s;
      return { ...s, textX: b.textX, textY: b.textY };
    });

    useSeatStore.getState().updateTable(table.id, { seats: newSeats });
  };






  /** ---------- SVG + Zoom ---------- */
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const pattern = defs
      .append('pattern')
      .attr('id', 'diagonal-stripes')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternTransform', 'rotate(45)');
    pattern.append('rect').attr('width', 10).attr('height', 20).attr('fill', '#f0f0f0');

    svg
      .append('rect')
      .attr('class', 'outside-bg')
      .attr('x', -50000)
      .attr('y', -50000)
      .attr('width', 100000)
      .attr('height', 100000)
      .attr('fill', 'url(#diagonal-stripes)');

    const g = svg.append('g').attr('class', 'zoom-layer');
    gLayerRef.current = g.node();
    g.append('g').attr('class', 'chunks-layer');
    g.append('g').attr('class', 'tables-layer');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        if (gLayerRef.current)
          gLayerRef.current.setAttribute('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    zoomBehavior.current = zoom;
    svg.call(zoom as any);
    svg.call((zoom as any).transform, d3.zoomIdentity);

    svg.on('click', () => {
      setSelectedTable(null);
      selectSeat('', null);
    });
  }, []);

  /** ---------- Chunks ---------- */
  useEffect(() => {
    const gEl = gLayerRef.current;
    if (!gEl) return;
    const chunkLayer = d3.select(gEl).select('.chunks-layer');
    const allChunks = Object.values(chunks).filter((c) => c.row >= 0 && c.col >= 0);
    const chunkGroups = chunkLayer.selectAll<SVGGElement, any>('g.chunk-group').data(allChunks, (c: any) => c.id);
    const enter = chunkGroups.enter().append('g').attr('class', 'chunk-group');
    enter.append('rect')
      .attr('class', 'chunk-outline')
      .attr('fill', 'white')
      .attr('stroke', '#9e9e9e')
      .attr('stroke-dasharray', '8,6')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);
    enter.append('text')
      .attr('class', 'chunk-label')
      .attr('x', 8)
      .attr('y', 20)
      .attr('fill', '#616161')
      .attr('font-size', 18)
      .text((c) => `R${c.row}C${c.col}`);
    const merged = enter.merge(chunkGroups as any);
    merged.select('rect.chunk-outline')
      .attr('x', (c) => c.col * CHUNK_WIDTH)
      .attr('y', (c) => c.row * CHUNK_HEIGHT)
      .attr('width', CHUNK_WIDTH)
      .attr('height', CHUNK_HEIGHT);
    merged.select('text.chunk-label')
      .attr('x', (c) => c.col * CHUNK_WIDTH + 16)
      .attr('y', (c) => c.row * CHUNK_HEIGHT + 28)
      .text((c) => `R${c.row}C${c.col}`);
    chunkGroups.exit().remove();
  }, [chunks]);

  /** ---------- Tables ---------- */
  useEffect(() => {
    const svgEl = svgRef.current;
    const gEl = gLayerRef.current;
    if (!svgEl || !gEl) return;

    const g = d3.select(gEl).select('.tables-layer');
    const tableGroups = g.selectAll<SVGGElement, Table>('.table-group').data(tables, (d) => d.id);
    tableGroups.exit().remove();
    const enter = tableGroups.enter().append('g').attr('class', 'table-group').attr('transform', (d) => `translate(${d.x},${d.y})`).style('cursor', 'grab');

    enter.each(function (this: SVGGElement, d: Table) {
      const g = d3.select(this);
      if (d.shape === 'round') {
        g.append('circle')
          .attr('r', d.radius)
          .attr('fill', d.id === selectedTableId ? '#1565c0' : '#1976d2')
          .attr('stroke', '#0d47a1')
          .attr('stroke-width', 2)
          .on('click', function (event) { event.stopPropagation(); setSelectedTable(d.id); });
      } else {
        const width = d.width || 160;
        const height = d.height || 100;
        g.append('rect')
          .attr('x', -width / 2)
          .attr('y', -height / 2)
          .attr('width', width)
          .attr('height', height)
          .attr('fill', d.id === selectedTableId ? '#1565c0' : '#1976d2')
          .attr('stroke', '#0d47a1')
          .attr('stroke-width', 2)
          .on('click', function (event) { event.stopPropagation(); setSelectedTable(d.id); });
      }
    });

    enter.append('text').attr('y', 5).attr('text-anchor', 'middle').attr('fill', 'white').attr('font-size', '14px').text((d) => d.label);
    const merged = enter.merge(tableGroups as any).attr('transform', (d) => `translate(${d.x},${d.y})`);

    // In your PlaygroundCanvas.tsx, replace the entire guest box positioning section with this:

    // ============================================================================
    // OPTIMAL TEXTBOX LAYOUT ALGORITHM
    // ============================================================================
    // This creates a compact oval ring for round tables and proper alignment
    // for rectangular tables with consistent distances.

    interface BoxData {
      s: any; // Seat
      guest: any;
      nx: number; // Normal X direction
      ny: number; // Normal Y direction
      width: number;
      height: number;
      x: number; // Box center X (relative to table)
      y: number; // Box center Y (relative to table)
      relX: number; // Seat relative X
      relY: number; // Seat relative Y
      angle: number; // Angle from table center
      seatAngle: number; // Original seat angle
    }

    /**
     * Check if two axis-aligned rectangles overlap
     */
    function rectsOverlap(
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
      padding: number = 6
    ): boolean {
      const a_left = a.x - a.width / 2 - padding;
      const a_right = a.x + a.width / 2 + padding;
      const a_top = a.y - a.height / 2 - padding;
      const a_bottom = a.y + a.height / 2 + padding;

      const b_left = b.x - b.width / 2 - padding;
      const b_right = b.x + b.width / 2 + padding;
      const b_top = b.y - b.height / 2 - padding;
      const b_bottom = b.y + b.height / 2 + padding;

      return !(a_right < b_left || a_left > b_right || a_bottom < b_top || a_top > b_bottom);
    }

    /**
     * Calculate optimal positions for round tables
     * Creates a compact oval ring around the table
     */
    function layoutRoundTable(
      boxData: BoxData[],
      tableRadius: number,
      connectorGap: number
    ): void {
      if (boxData.length === 0) return;

      // STEP 1: Sort boxes by angle
      boxData.sort((a, b) => a.seatAngle - b.seatAngle);

      // STEP 2: Calculate the oval ring parameters
      // The ring should be wider horizontally than vertically for better readability
      const avgBoxWidth = boxData.reduce((sum, b) => sum + b.width, 0) / boxData.length;
      const avgBoxHeight = boxData.reduce((sum, b) => sum + b.height, 0) / boxData.length;

      // Calculate required circumference to fit all boxes with spacing
      const boxSpacing = 8; // Gap between adjacent boxes
      const totalBoxWidth = boxData.reduce((sum, b) => sum + b.width, 0);
      const totalSpacing = boxData.length * boxSpacing;
      const requiredCircumference = totalBoxWidth + totalSpacing;

      // For an ellipse: circumference ≈ π * (3(a+b) - sqrt((3a+b)(a+3b)))
      // We want a taller, narrower oval: b > a
      // Simplify: use a ratio and solve for the radii
      const heightToWidthRatio = 1.3; // Oval is 30% taller than wide

      // Estimate ellipse semi-axes (a = horizontal, b = vertical)
      let a = requiredCircumference / (2 * Math.PI * heightToWidthRatio);
      let b = a * heightToWidthRatio;

      // Ensure minimum distance from table
      const minRadialDist = tableRadius + connectorGap + avgBoxHeight / 2 + 20;
      if (b < minRadialDist) {
        b = minRadialDist;
        a = b / heightToWidthRatio;
      }

      // STEP 3: Distribute boxes along the ellipse
      // Use cumulative angular distribution based on box widths
      let totalAngle = 0;
      const angleIncrements: number[] = [];

      for (let i = 0; i < boxData.length; i++) {
        const box = boxData[i];
        const nextBox = boxData[(i + 1) % boxData.length];

        // Calculate angular space needed for this box + spacing
        const avgRadius = (a + b) / 2;
        const boxArc = (box.width / 2 + boxSpacing / 2) / avgRadius;
        const nextBoxArc = (nextBox.width / 2 + boxSpacing / 2) / avgRadius;
        const angleIncrement = boxArc + nextBoxArc;

        angleIncrements.push(angleIncrement);
        totalAngle += angleIncrement;
      }

      // Normalize angles to fill 2π
      const scaleFactor = (2 * Math.PI) / totalAngle;
      let currentAngle = -Math.PI / 2; // Start at top

      for (let i = 0; i < boxData.length; i++) {
        const box = boxData[i];

        // Position on ellipse
        const ellipseX = a * Math.cos(currentAngle);
        const ellipseY = b * Math.sin(currentAngle);

        box.x = ellipseX;
        box.y = ellipseY;

        // Update normal direction to point outward from ellipse
        const dist = Math.sqrt(ellipseX * ellipseX + ellipseY * ellipseY);
        box.nx = ellipseX / dist;
        box.ny = ellipseY / dist;

        currentAngle += angleIncrements[i] * scaleFactor;
      }

      // STEP 4: Fine-tune positions to avoid overlaps
      resolveCollisions(boxData, 50, 3);
    }

    /**
     * Calculate optimal positions for rectangular tables
     * Places boxes at consistent distances in proper alignment
     */
    function layoutRectangularTable(
      boxData: BoxData[],
      tableWidth: number,
      tableHeight: number,
      connectorGap: number
    ): void {
      if (boxData.length === 0) return;

      const avgBoxHeight = boxData.reduce((sum, b) => sum + b.height, 0) / boxData.length;
      const fixedDistance = connectorGap + avgBoxHeight / 2 + 15; // Consistent distance

      // Categorize boxes by which side of the table they're on
      const topBoxes: BoxData[] = [];
      const bottomBoxes: BoxData[] = [];
      const leftBoxes: BoxData[] = [];
      const rightBoxes: BoxData[] = [];

      boxData.forEach((box) => {
        const absX = Math.abs(box.relX);
        const absY = Math.abs(box.relY);

        if (absY > absX) {
          // Vertical side
          if (box.relY < 0) {
            topBoxes.push(box);
          } else {
            bottomBoxes.push(box);
          }
        } else {
          // Horizontal side
          if (box.relX < 0) {
            leftBoxes.push(box);
          } else {
            rightBoxes.push(box);
          }
        }
      });

      // Sort each side by position along that edge
      topBoxes.sort((a, b) => a.relX - b.relX);
      bottomBoxes.sort((a, b) => a.relX - b.relX);
      leftBoxes.sort((a, b) => a.relY - b.relY);
      rightBoxes.sort((a, b) => a.relY - b.relY);

      // Position boxes for each side

      // TOP: Fixed distance above, align horizontally
      positionLinearSide(topBoxes, fixedDistance, 'horizontal', -1, tableWidth);

      // BOTTOM: Fixed distance below, align horizontally
      positionLinearSide(bottomBoxes, fixedDistance, 'horizontal', 1, tableWidth);

      // LEFT: Fixed distance to left, align vertically
      positionLinearSide(leftBoxes, fixedDistance, 'vertical', -1, tableHeight);

      // RIGHT: Fixed distance to right, align vertically
      positionLinearSide(rightBoxes, fixedDistance, 'vertical', 1, tableHeight);

      // Fine-tune to avoid overlaps
      resolveCollisions(boxData, 30, 2);
    }

    /**
     * Position boxes along a linear side of rectangular table
     */
    function positionLinearSide(
      boxes: BoxData[],
      distance: number,
      orientation: 'horizontal' | 'vertical',
      direction: number, // -1 or 1
      tableSize: number
    ): void {
      if (boxes.length === 0) return;

      const spacing = 8;

      if (orientation === 'horizontal') {
        // Top or bottom side
        const totalWidth = boxes.reduce((sum, b) => sum + b.width, 0);
        const totalSpacing = (boxes.length - 1) * spacing;
        const totalNeeded = totalWidth + totalSpacing;

        // Start position (centered)
        let currentX = -totalNeeded / 2;

        boxes.forEach((box) => {
          box.x = currentX + box.width / 2;
          box.y = direction * (tableSize / 2 + distance);
          box.nx = 0;
          box.ny = direction;

          currentX += box.width + spacing;
        });
      } else {
        // Left or right side
        const totalHeight = boxes.reduce((sum, b) => sum + b.height, 0);
        const totalSpacing = (boxes.length - 1) * spacing;
        const totalNeeded = totalHeight + totalSpacing;

        // Start position (centered)
        let currentY = -totalNeeded / 2;

        boxes.forEach((box) => {
          box.x = direction * (tableSize / 2 + distance);
          box.y = currentY + box.height / 2;
          box.nx = direction;
          box.ny = 0;

          currentY += box.height + spacing;
        });
      }
    }

    /**
     * Resolve any remaining collisions with minimal adjustments
     */
    function resolveCollisions(
      boxData: BoxData[],
      maxIterations: number,
      stepSize: number
    ): void {
      const padding = 6;

      for (let iter = 0; iter < maxIterations; iter++) {
        let hasCollision = false;

        for (let i = 0; i < boxData.length; i++) {
          for (let j = i + 1; j < boxData.length; j++) {
            const a = boxData[i];
            const b = boxData[j];

            if (rectsOverlap(a, b, padding)) {
              hasCollision = true;

              // Push both boxes along their normal directions
              a.x += a.nx * stepSize;
              a.y += a.ny * stepSize;
              b.x += b.nx * stepSize;
              b.y += b.ny * stepSize;
            }
          }
        }

        if (!hasCollision) break;
      }
    }

    /**
     * Main function to calculate optimal guest box positions
     */
    function calculateGuestBoxPositions(
      tableDatum: any,
      guestLookup: Record<string, any>,
      connectorGap: number,
      getRankStars: (ranking: number | string | undefined) => string
    ): BoxData[] {
      const seatsWithGuest = (tableDatum.seats || []).filter((s: any) => s.assignedGuestId);
      const boxData: BoxData[] = [];

      // STEP 1: Build initial box data
      seatsWithGuest.forEach((s: any) => {
        const guest = guestLookup[s.assignedGuestId];
        if (!guest) return;

        const relX = s.x - tableDatum.x;
        const relY = s.y - tableDatum.y;

        // Calculate normal direction (away from table center)
        let nx = 0, ny = 0;
        if (tableDatum.shape === 'round') {
          const len = Math.sqrt(relX * relX + relY * relY) || 1;
          nx = relX / len;
          ny = relY / len;
        } else {
          // For rectangular tables
          if (Math.abs(relX) >= Math.abs(relY)) {
            nx = relX >= 0 ? 1 : -1;
            ny = 0;
          } else {
            nx = 0;
            ny = relY >= 0 ? 1 : -1;
          }
        }

        // Calculate text dimensions
        const name = `${guest.salutation || ''} ${guest.name || ''}`.trim();
        const stars = getRankStars(guest.ranking);
        const line1 = `${name}${stars}`;
        const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();
        const charPx = 7;
        const estTextWidth = Math.max(line1.length, line2.length) * charPx;
        const width = Math.min(Math.max(60, estTextWidth + 20), 300);
        const height = 14 * 2 + 12;

        const seatAngle = Math.atan2(relY, relX);

        boxData.push({
          s,
          guest,
          nx,
          ny,
          width,
          height,
          x: 0, // Will be set by layout algorithm
          y: 0, // Will be set by layout algorithm
          relX,
          relY,
          angle: seatAngle,
          seatAngle,
        });
      });

      // STEP 2: Apply appropriate layout algorithm
      if (tableDatum.shape === 'round') {
        layoutRoundTable(boxData, tableDatum.radius, connectorGap);
      } else {
        const tableWidth = tableDatum.width || 160;
        const tableHeight = tableDatum.height || 100;
        layoutRectangularTable(boxData, tableWidth, tableHeight, connectorGap);
      }

      return boxData;
    }

    // ============================================================================
    // INTEGRATION CODE FOR PlaygroundCanvas.tsx
    // ============================================================================


    merged.each(function (tableDatum) {
      const group = d3.select(this);

      // Calculate optimized guest box positions
      const boxData = calculateGuestBoxPositions(tableDatum, guestLookup, connectorGap, getRankStars);

      // CONNECTORS
      let connectorsLayer = group.select<SVGGElement>('g.connectors-layer');
      if (connectorsLayer.empty()) {
        connectorsLayer = group.insert('g', ':first-child').attr('class', 'connectors-layer') as any;
      }

      const connectors = connectorsLayer
        .selectAll<SVGLineElement, any>('line.connector-line')
        .data(boxData, (d: any) => d.s.id);

      connectors.exit().remove();

      const connectorsEnter = connectors
        .enter()
        .append('line')
        .attr('class', 'connector-line')
        .attr('stroke', '#90a4ae')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');

      connectorsEnter.merge(connectors as any)
        .attr('x1', (d: any) => d.relX)
        .attr('y1', (d: any) => d.relY)
        .attr('x2', (d: any) => d.x)
        .attr('y2', (d: any) => d.y);

      // SEATS (your existing seat rendering code)
      const seatsSel = group.selectAll<SVGCircleElement, Seat>('circle.seat')
        .data(tableDatum.seats || [], (s) => s.id);
      seatsSel.exit().remove();
      const seatsEnter = seatsSel.enter().append('circle').attr('class', 'seat');
      seatsEnter.merge(seatsSel as any)
        .attr('cx', (s) => s.x - tableDatum.x)
        .attr('cy', (s) => s.y - tableDatum.y)
        .attr('r', (s) => s.radius)
        .attr('fill', (s) => (s.locked ? '#b0bec5' : s.assignedGuestId ? '#66bb6a' : s.selected ? '#ffb300' : '#90caf9'))
        .attr('stroke', '#1565c0')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', (event, s) => { event.stopPropagation(); selectSeat(tableDatum.id, s.id); })
        .on('contextmenu', (event, s) => { event.preventDefault(); lockSeat(tableDatum.id, s.id, !s.locked); })
        .on('dblclick', (event, s) => { clearSeat(tableDatum.id, s.id); });

      const seatLabels = group.selectAll<SVGTextElement, Seat>('text.seat-number')
        .data(tableDatum.seats || [], (s) => s.id);
      seatLabels.exit().remove();
      const seatLabelsEnter = seatLabels.enter().append('text').attr('class', 'seat-number');
      seatLabelsEnter.merge(seatLabels as any)
        .attr('x', (s) => s.x - tableDatum.x)
        .attr('y', (s) => s.y - tableDatum.y + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0d47a1')
        .attr('font-size', '10px')
        .text((s) => s.seatNumber);

      // GUEST BOXES
      const guestBoxes = group.selectAll<SVGGElement, any>('g.guest-box')
        .data(boxData, (d: any) => d.s.id);
      guestBoxes.exit().remove();

      const guestBoxesEnter = guestBoxes.enter()
        .append('g')
        .attr('class', 'guest-box')
        .style('pointer-events', 'none');

      guestBoxesEnter.append('rect')
        .attr('class', 'guest-rect')
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('stroke-width', 1.2);

      guestBoxesEnter.append('text')
        .attr('class', 'guest-name')
        .attr('font-size', 11)
        .style('font-family', 'Segoe UI Emoji, "Apple Color Emoji", "Noto Color Emoji", sans-serif');

      guestBoxesEnter.append('text')
        .attr('class', 'guest-meta')
        .attr('font-size', 10);

      guestBoxesEnter.merge(guestBoxes as any).each(function (this: SVGGElement, d: any) {
        const gbox = d3.select(this);
        const { guest, width, height, x, y } = d;

        const rectX = x - width / 2;
        const rectY = y - height / 2;
        const isHost = !!guest.fromHost;
        const hostFill = '#e3f2fd', hostStroke = '#1976d2';
        const externalFill = '#e8f5e9', externalStroke = '#2e7d32';

        gbox.select('rect.guest-rect')
          .attr('x', rectX)
          .attr('y', rectY)
          .attr('width', width)
          .attr('height', height)
          .attr('fill', isHost ? hostFill : externalFill)
          .attr('stroke', isHost ? hostStroke : externalStroke);

        const line1 = `${getRankStars(guest.ranking)} ${guest.salutation || ''} ${guest.name || ''}`.trim();
        const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();

        gbox.select('text.guest-name')
          .attr('x', x)
          .attr('y', rectY + 6 + 14 / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#0d47a1')
          .text(line1);

        gbox.select('text.guest-meta')
          .attr('x', x)
          .attr('y', rectY + 6 + 14 + 14 / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#455a64')
          .text(line2);
      });
    });


    /** ---------- Drag ---------- */
    const svgSelection = d3.select(svgEl);
    const drag = d3.drag<SVGGElement, Table>()
      .on('start', function () { svgSelection.on('.zoom', null); d3.select(this).style('cursor', 'grabbing'); })
      .on('drag', function (event, d) {
        const [px, py] = d3.pointer(event, svgEl);
        const t = d3.zoomTransform(svgEl);
        const worldX = Math.max(0, (px - t.x) / t.k); const worldY = Math.max(0, (py - t.y) / t.k);
        d3.select(this).attr('transform', `translate(${worldX},${worldY})`);
        moveTable(d.id, worldX, worldY);
        const row = Math.floor(worldY / CHUNK_HEIGHT); const col = Math.floor(worldX / CHUNK_WIDTH);
        ensureChunkExists(row, col); assignTableToChunk(d.id, row, col); expandWorldIfNeeded();
      })
      .on('end', function () { cleanupEmptyChunks(); if (zoomBehavior.current) svgSelection.call(zoomBehavior.current as any); d3.select(this).style('cursor', 'grab'); });

    merged.call(drag as any);

  }, [tables, moveTable, selectSeat, lockSeat, clearSeat, selectedTableId, selectedSeatId, ensureChunkExists, assignTableToChunk, expandWorldIfNeeded, cleanupEmptyChunks, hostGuests, externalGuests, connectorGap]);

  /** ---------- Zoom Controls ---------- */
  const zoomByFactor = (factor: number) => { const svgEl = svgRef.current; if (!svgEl || !zoomBehavior.current) return; d3.select(svgEl).transition().duration(300).call((sel: any) => sel.call((zoomBehavior.current as any).scaleBy, factor)); };
  const resetZoom = () => { const svgEl = svgRef.current; if (!svgEl || !zoomBehavior.current) return; d3.select(svgEl).transition().duration(300).call((sel: any) => sel.call((zoomBehavior.current as any).transform, d3.zoomIdentity)); setZoomLevel(1); };

  /** ---------- Add Table ---------- */
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const handleAddTableClick = () => setIsAddTableModalOpen(true);
  // const handleAddTable = (config: TableConfig) => {
  //   const svgEl = svgRef.current; if (!svgEl) return; const rect = svgEl.getBoundingClientRect(); const centerX = rect.width / 2; const centerY = rect.height / 2;
  //   const t = d3.zoomTransform(svgEl);
  //   const worldX = Math.max(0, (centerX - t.x) / t.k); const worldY = Math.max(0, (centerY - t.y) / t.k);
  //   for (let i = 0; i < config.quantity; i++) {
  //     const id = `t${Date.now()}-${i}`;
  //     const label = config.label ? `${config.label} ${tables.length + i + 1}` : `Table ${tables.length + i + 1}`;
  //     const offsetX = (i % 3) * 200; const offsetY = Math.floor(i / 3) * 200;
  //     const x = worldX + offsetX; const y = worldY + offsetY;
  //     let table;
  //     if (config.type === 'round') { table = createRoundTable(id, x, y, 60, config.roundSeats || 8, label); }
  //     else { const { top, bottom, left, right } = config.rectangleSeats || { top: 2, bottom: 2, left: 1, right: 1 }; table = createRectangleTable(id, x, y, top, bottom, left, right, label); }
  //     addTable(table);
  //     const row = Math.floor(y / CHUNK_HEIGHT); const col = Math.floor(x / CHUNK_WIDTH); ensureChunkExists(row, col); assignTableToChunk(id, row, col);
  //   }
  //   expandWorldIfNeeded();
  // };

  // In PlaygroundCanvas.tsx - Update the handleAddTable function

  const handleAddTable = (config: TableConfig) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const t = d3.zoomTransform(svgEl);
    const worldX = Math.max(0, (centerX - t.x) / t.k);
    const worldY = Math.max(0, (centerY - t.y) / t.k);

    for (let i = 0; i < config.quantity; i++) {
      const id = `t${Date.now()}-${i}`;
      const label = config.label
        ? `${config.label} ${tables.length + i + 1}`
        : `Table ${tables.length + i + 1}`;
      const offsetX = (i % 3) * 200;
      const offsetY = Math.floor(i / 3) * 200;
      const x = worldX + offsetX;
      const y = worldY + offsetY;

      let table;
      if (config.type === 'round') {
        // Pass custom seat ordering to round table
        table = createRoundTable(
          id,
          x,
          y,
          60,
          config.roundSeats || 8,
          label,
          config.seatOrdering // NEW: Pass custom ordering
        );
      } else {
        // Pass custom seat ordering to rectangle table
        const { top, bottom, left, right } = config.rectangleSeats || {
          top: 2, bottom: 2, left: 1, right: 1
        };
        table = createRectangleTable(
          id,
          x,
          y,
          top,
          bottom,
          left,
          right,
          label,
          config.seatOrdering // NEW: Pass custom ordering
        );
      }

      addTable(table);
      const row = Math.floor(y / CHUNK_HEIGHT);
      const col = Math.floor(x / CHUNK_WIDTH);
      ensureChunkExists(row, col);
      assignTableToChunk(id, row, col);
    }
    expandWorldIfNeeded();
  };

  return (
    <div id="playground-canvas" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Paper elevation={0} sx={{ position: 'absolute', inset: 0, bgcolor: '#fafafa' }}>
        <Box component="svg" ref={svgRef} sx={{ width: '100%', height: '100%', display: 'block', userSelect: 'none', touchAction: 'none' }} preserveAspectRatio="xMidYMid meet" />
      </Paper>
      {/* NEW: Add Statistics Panel - TOP RIGHT */}
      <SeatingStatsPanel />
      <Stack spacing={1} sx={{ position: 'absolute', bottom: 24, right: 24, alignItems: 'center' }}>
        <Tooltip title="Add Table">
          <Fab color="primary" size="medium" onClick={handleAddTableClick}><AddIcon /></Fab>
        </Tooltip>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Tooltip title="Zoom Out">
            <Fab size="small" onClick={() => zoomByFactor(0.8)}><ZoomOutIcon fontSize="small" /></Fab>
          </Tooltip>
          <Tooltip title="Reset View">

            <Fab size="small" onClick={resetZoom}><CenterFocusStrongIcon fontSize="small" /></Fab>
          </Tooltip>
          <Tooltip title="Zoom In">
            <Fab size="small" onClick={() => zoomByFactor(1.25)}><ZoomInIcon fontSize="small" /></Fab>
          </Tooltip>
          {/* 
          <Tooltip title="Auto-Arrange Textboxes">
            <Fab size="small" onClick={() => {
              tables.forEach((table) => autoArrangeGuestBoxes(table));
            }}>
              ARRANGE
            </Fab>
          </Tooltip> */}

        </Stack>

        <Box sx={{ width: 120, mt: 2 }}>
          <Typography variant="caption">Connector Gap</Typography>
          <Slider
            value={connectorGap}
            min={2}
            max={30}
            step={1}
            onChange={(e, val) => setConnectorGap(val as number)}
          />
        </Box>
      </Stack>

      {isAddTableModalOpen && (
        <AddTableModal
          open={isAddTableModalOpen}
          onClose={() => setIsAddTableModalOpen(false)}
          onConfirm={handleAddTable}
        />
      )}
    </div>
  );
}
