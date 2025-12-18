// components/organisms/PlaygroundCanvas.tsx - UPDATED WITH MEAL PLAN DISPLAY
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Restaurant from '@mui/icons-material/Restaurant';
import Popover from '@mui/material/Popover';
import Badge from '@mui/material/Badge';

import AddTableModal, { TableConfig } from '@/components/molecules/AddTableModal';

import { useSeatStore } from '@/store/seatStore';
import { useGuestStore, Guest } from '@/store/guestStore';
import { createRoundTable, createRectangleTable } from '@/utils/generateTable';
import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/types/Chunk';
import { Table } from '@/types/Table';
import { Seat, SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';

// Helper function to get rank stars
function getRankStars(ranking: number): string {
  if (ranking <= 1) return ' ⭐⭐⭐⭐';
  if (ranking <= 2) return ' ⭐⭐⭐';
  if (ranking <= 3) return ' ⭐⭐';
  if (ranking <= 4) return ' ⭐';
  return '';
}

export default function PlaygroundCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gLayerRef = useRef<SVGGElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [connectorGap, setConnectorGap] = useState<number>(8);

  // Meal plan popover state
  const [mealPlanAnchorEl, setMealPlanAnchorEl] = useState<HTMLButtonElement | null>(null);
  const mealPlanPopoverOpen = Boolean(mealPlanAnchorEl);

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
  const selectedMealPlanIndex = useGuestStore((s) => s.selectedMealPlanIndex);
  const setSelectedMealPlanIndex = useGuestStore((s) => s.setSelectedMealPlanIndex);
  
  const guests = useMemo(() => [...hostGuests, ...externalGuests], [hostGuests, externalGuests]);
  const guestLookup = useMemo(() => {
    const m: Record<string, Guest> = {};
    guests.forEach((g) => (m[g.id] = g));
    return m;
  }, [guests]);

  // Calculate max meal plans across all guests
  const maxMealPlanCount = useMemo(() => {
    let max = 0;
    guests.forEach((g) => {
      if (g.mealPlans && g.mealPlans.length > max) {
        max = g.mealPlans.length;
      }
    });
    return max;
  }, [guests]);

  // Generate meal plan options
  const mealPlanOptions = useMemo(() => {
    const options: { value: number | null; label: string }[] = [
      { value: null, label: 'None' }
    ];
    for (let i = 0; i < maxMealPlanCount; i++) {
      options.push({ value: i, label: `Meal Plan ${i + 1}` });
    }
    return options;
  }, [maxMealPlanCount]);

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
      a.x2 + padding < b.x1 - padding ||
      b.x2 + padding < a.x1 - padding ||
      a.y2 + padding < b.y1 - padding ||
      b.y2 + padding < a.y1 - padding
    );
  }

  /** ---------- Get seat fill color based on state and mode ---------- */
  function getSeatFillColor(seat: Seat): string {
    const mode = seat.mode || 'default';
    const modeConfig = SEAT_MODE_CONFIGS[mode];

    // Locked seats are always grey
    if (seat.locked) return '#b0bec5';

    // Assigned seats are green (takes priority over mode)
    if (seat.assignedGuestId) return '#66bb6a';

    // Selected seats are yellow
    if (seat.selected) return '#ffb300';

    // Return mode-specific color
    return modeConfig.color;
  }

  /** ---------- Get seat stroke color based on mode ---------- */
  function getSeatStrokeColor(seat: Seat): string {
    const mode = seat.mode || 'default';
    return SEAT_MODE_CONFIGS[mode].strokeColor;
  }

  /** ---------- Modal State ---------- */
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const handleAddTableClick = () => setIsAddTableModalOpen(true);
  const handleCloseAddModal = () => setIsAddTableModalOpen(false);

  /** ---------- Meal Plan Popover Handlers ---------- */
  const handleMealPlanClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMealPlanAnchorEl(event.currentTarget);
  };

  const handleMealPlanClose = () => {
    setMealPlanAnchorEl(null);
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
      const grp = d3.select(this);
      if (d.shape === 'round') {
        grp.append('circle')
          .attr('r', d.radius)
          .attr('fill', d.id === selectedTableId ? '#1565c0' : '#1976d2')
          .attr('stroke', '#0d47a1')
          .attr('stroke-width', 2)
          .on('click', function (event) { event.stopPropagation(); setSelectedTable(d.id); });
      } else {
        const width = d.width || 160;
        const height = d.height || 100;
        grp.append('rect')
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

    enter.append('text').attr('class', 'table-label').attr('y', 5).attr('text-anchor', 'middle').attr('fill', 'white').attr('font-size', '14px');
    const merged = enter.merge(tableGroups as any).attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Update the label text on ALL tables (including existing ones)
    merged.select('text.table-label').text((d) => d.label);

    merged.each(function (tableDatum) {
      const group = d3.select(this);

      // CONNECTORS
      const seatsWithGuest = (tableDatum.seats || []).filter((s) => s.assignedGuestId);
      let connectorsLayer = group.select<SVGGElement>('g.connectors-layer');
      if (connectorsLayer.empty()) connectorsLayer = group.insert('g', ':first-child').attr('class', 'connectors-layer') as any;

      const connectors = connectorsLayer.selectAll<SVGLineElement, Seat>('line.connector-line').data(seatsWithGuest, (s: any) => s.id);
      connectors.exit().remove();
      const connectorsEnter = connectors.enter().append('line').attr('class', 'connector-line').attr('stroke', '#90a4ae').attr('stroke-width', 1).attr('pointer-events', 'none');
      connectorsEnter.merge(connectors as any).each(function (s: Seat) {
        const relX = s.x - tableDatum.x;
        const relY = s.y - tableDatum.y;
        let nx = 0, ny = 0;
        if (tableDatum.shape === 'round') {
          const len = Math.sqrt(relX * relX + relY * relY) || 1; nx = relX / len; ny = relY / len;
        } else { if (Math.abs(relX) >= Math.abs(relY)) { nx = relX >= 0 ? 1 : -1; ny = 0; } else { nx = 0; ny = relY >= 0 ? 1 : -1; } }
        const guest = s.assignedGuestId ? guestLookup[s.assignedGuestId] : null;
        if (!guest) return;
        const line1 = `${guest.salutation || ''} ${guest.name || ''}`.trim();
        const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();
        // Add extra height for meal plan display if needed
        const hasMealPlan = selectedMealPlanIndex !== null;
        const charPx = 7;
        const estTextWidth = Math.max(line1.length, line2.length) * charPx;
        const width = Math.min(Math.max(60, estTextWidth + 20), 300);
        const seatR = s.radius ?? 8;
        const centerOffset = seatR + connectorGap + width / 2;
        const boxCenterX = relX + nx * centerOffset;
        const boxCenterY = relY + ny * centerOffset;
        d3.select(this).attr('x1', relX).attr('y1', relY).attr('x2', boxCenterX).attr('y2', boxCenterY);
      });

      // SEATS
      const seatsSel = group.selectAll<SVGCircleElement, Seat>('circle.seat').data(tableDatum.seats || [], (s) => s.id);
      seatsSel.exit().remove();
      const seatsEnter = seatsSel.enter().append('circle').attr('class', 'seat');
      seatsEnter.merge(seatsSel as any)
        .attr('cx', (s) => s.x - tableDatum.x)
        .attr('cy', (s) => s.y - tableDatum.y)
        .attr('r', (s) => s.radius)
        .attr('fill', (s) => getSeatFillColor(s))
        .attr('stroke', (s) => getSeatStrokeColor(s))
        .attr('stroke-width', (s) => {
          const mode = s.mode || 'default';
          return mode !== 'default' ? 2.5 : 1;
        })
        .attr('stroke-dasharray', (s) => {
          if (s.mode === 'external-only') return '4,2';
          return 'none';
        })
        .style('cursor', 'pointer')
        .on('click', (event, s) => { event.stopPropagation(); selectSeat(tableDatum.id, s.id); })
        .on('contextmenu', (event, s) => { event.preventDefault(); lockSeat(tableDatum.id, s.id, !s.locked); })
        .on('dblclick', (event, s) => { clearSeat(tableDatum.id, s.id); });

      // SEAT NUMBERS
      const seatLabels = group.selectAll<SVGTextElement, Seat>('text.seat-number').data(tableDatum.seats || [], (s) => s.id);
      seatLabels.exit().remove();
      const seatLabelsEnter = seatLabels.enter().append('text').attr('class', 'seat-number');
      seatLabelsEnter.merge(seatLabels as any)
        .attr('x', (s) => s.x - tableDatum.x)
        .attr('y', (s) => s.y - tableDatum.y + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0d47a1')
        .attr('font-size', '10px')
        .attr('pointer-events', 'none')
        .text((s) => s.seatNumber);

      // SEAT MODE INDICATORS (small badge for non-default modes)
      const seatsWithModes = (tableDatum.seats || []).filter((s) => s.mode && s.mode !== 'default');
      const modeIndicators = group.selectAll<SVGGElement, Seat>('g.seat-mode-badge').data(seatsWithModes, (s) => s.id);
      modeIndicators.exit().remove();

      const modeIndicatorsEnter = modeIndicators.enter().append('g').attr('class', 'seat-mode-badge');
      modeIndicatorsEnter.append('circle')
        .attr('class', 'mode-badge-bg')
        .attr('r', 7)
        .attr('pointer-events', 'none');
      modeIndicatorsEnter.append('text')
        .attr('class', 'mode-badge-text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', '8px')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none');

      const mergedBadges = modeIndicatorsEnter.merge(modeIndicators as any);
      mergedBadges
        .attr('transform', (s) => {
          const relX = s.x - tableDatum.x;
          const relY = s.y - tableDatum.y;
          return `translate(${relX + s.radius - 2}, ${relY - s.radius + 2})`;
        });
      mergedBadges.select('circle.mode-badge-bg')
        .attr('fill', (s) => SEAT_MODE_CONFIGS[s.mode || 'default'].strokeColor);
      mergedBadges.select('text.mode-badge-text')
        .attr('fill', 'white')
        .text((s) => SEAT_MODE_CONFIGS[s.mode || 'default'].shortLabel);

      // GUEST BOXES
      const guestBoxes = group.selectAll<SVGGElement, Seat>('g.guest-box').data(seatsWithGuest, (s) => s.id);
      guestBoxes.exit().remove();
      const guestBoxesEnter = guestBoxes.enter().append('g').attr('class', 'guest-box').style('pointer-events', 'none');
      guestBoxesEnter.append('rect').attr('class', 'guest-rect').attr('rx', 8).attr('ry', 8).attr('stroke-width', 1.2).attr('stroke', '#1565c0');
      guestBoxesEnter.append('text').attr('class', 'guest-name').attr('font-size', 11).attr('fill', '#0d47a1').style('font-family', `Segoe UI Emoji, "Apple Color Emoji", "Noto Color Emoji", sans-serif`);
      guestBoxesEnter.append('text').attr('class', 'guest-meta').attr('font-size', 10).attr('fill', '#455a64');
      // NEW: Add meal plan text element
      guestBoxesEnter.append('text').attr('class', 'guest-meal-plan').attr('font-size', 9).attr('fill', '#2e7d32').attr('font-weight', 'bold');

      // --- Compute relaxed guest box positions ---
      const boxData: any[] = [];
      (tableDatum.seats || []).forEach((s) => {
        const guest = s.assignedGuestId ? guestLookup[s.assignedGuestId] : null;
        if (!guest) return;
        const relX = s.x - tableDatum.x;
        const relY = s.y - tableDatum.y;
        let nx = 0, ny = 0;
        if (tableDatum.shape === 'round') {
          const len = Math.sqrt(relX * relX + relY * relY) || 1; nx = relX / len; ny = relY / len;
        } else { if (Math.abs(relX) >= Math.abs(relY)) { nx = relX >= 0 ? 1 : -1; ny = 0; } else { nx = 0; ny = relY >= 0 ? 1 : -1; } }
        const name = `${guest.salutation || ''} ${guest.name || ''}`.trim();
        const stars = getRankStars(guest.ranking);
        const line1 = `${name}${stars}`;
        const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();
        
        // Get meal plan for display
        let mealPlanText = '';
        if (selectedMealPlanIndex !== null) {
          const mealPlan = guest.mealPlans?.[selectedMealPlanIndex];
          mealPlanText = mealPlan && mealPlan.trim() ? mealPlan : 'None';
        }
        
        const estTextWidth = Math.max(line1.length, line2.length, mealPlanText.length) * 7;
        const width = Math.min(Math.max(60, estTextWidth + 20), 300);
        // Add extra height if showing meal plan
        const baseHeight = 14 * 2 + 12;
        const height = selectedMealPlanIndex !== null ? baseHeight + 14 : baseHeight;
        const seatR = s.radius ?? 8;
        const dist = seatR + connectorGap + width / 2;
        boxData.push({ s, guest, nx, ny, width, height, x: relX + nx * dist, y: relY + ny * dist, relX, relY, minRadialDist: dist, mealPlanText });
      });

      /** Radial outward relaxation to prevent overlap */
      const maxIterations = 100; const step = 10; const padding = 6;
      for (let iter = 0; iter < maxIterations; iter++) {
        let moved = false;
        for (let i = 0; i < boxData.length; i++) {
          const a = boxData[i], aRect = boxRectFromCenter(a);
          for (let j = i + 1; j < boxData.length; j++) {
            const b = boxData[j], bRect = boxRectFromCenter(b);
            if (rectsOverlap(aRect, bRect, padding)) {
              a.x += a.nx * step; a.y += a.ny * step; b.x += b.nx * step; b.y += b.ny * step; moved = true;
            }
          }
        }
        if (!moved) break;
      }

      // Render relaxed guest boxes
      boxData.forEach((b) => {
        const { guest, s, width, height, mealPlanText } = b;
        const rectX = b.x - width / 2; const rectY = b.y - height / 2;
        const isHost = !!guest.fromHost;
        const hostFill = '#e3f2fd', hostStroke = '#1976d2';
        const externalFill = '#e8f5e9', externalStroke = '#E53935';
        const gbox = group.selectAll<SVGGElement, any>('g.guest-box').filter((d) => d.id === s.id);
        gbox.select('rect.guest-rect')
          .attr('x', rectX)
          .attr('y', rectY)
          .attr('width', width)
          .attr('height', height)
          .attr('fill', isHost ? hostFill : externalFill)
          .attr('stroke', isHost ? hostStroke : externalStroke);

        const name = `${guest.salutation || ''} ${guest.name || ''}`.trim();
        const stars = getRankStars(guest.ranking);
        gbox.select('text.guest-name')
          .attr('x', b.x)
          .attr('y', rectY + 14)
          .attr('text-anchor', 'middle')
          .text(`${name}${stars}`);
        gbox.select('text.guest-meta')
          .attr('x', b.x)
          .attr('y', rectY + 14 + 14)
          .attr('text-anchor', 'middle')
          .text(`${guest.country || ''} | ${guest.company || ''}`);
        
        // NEW: Render meal plan text on BOTTOM LEFT
        gbox.select('text.guest-meal-plan')
          .attr('x', rectX + 4) // Left aligned with small padding
          .attr('y', rectY + height - 4) // Bottom with small padding
          .attr('text-anchor', 'start')
          .text(selectedMealPlanIndex !== null ? `🍽️ ${mealPlanText}` : '');
      });

      // Update connectors to relaxed positions
      connectorsEnter.merge(connectors as any).each(function (s: Seat) {
        const b = boxData.find((box) => box.s.id === s.id);
        if (!b) return;
        d3.select(this).attr('x2', b.x).attr('y2', b.y);
      });
    });

    // Drag
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

  }, [tables, moveTable, selectSeat, lockSeat, clearSeat, selectedTableId, selectedSeatId, ensureChunkExists, assignTableToChunk, expandWorldIfNeeded, cleanupEmptyChunks, hostGuests, externalGuests, connectorGap, selectedMealPlanIndex, guestLookup]);

  /** ---------- Handle Add Table ---------- */
  const handleAddTable = (config: TableConfig) => {
    const existingCount = tables.length;
    const chunkArr = Object.values(chunks).filter((c) => c.row >= 0 && c.col >= 0);
    const startChunk = chunkArr.find((c) => c.tables.length === 0) || chunkArr[0] || { row: 0, col: 0 };
    const worldX = startChunk.col * CHUNK_WIDTH + CHUNK_WIDTH / 2;
    const worldY = startChunk.row * CHUNK_HEIGHT + CHUNK_HEIGHT / 2;

    for (let i = 0; i < config.quantity; i++) {
      const id = `table-${Date.now()}-${existingCount + i}`;
      const label = config.label
        ? `${config.label} ${tables.length + i + 1}`
        : `Table ${tables.length + i + 1}`;
      const offsetX = (i % 3) * 200;
      const offsetY = Math.floor(i / 3) * 200;
      const x = worldX + offsetX;
      const y = worldY + offsetY;

      let table;
      if (config.type === 'round') {
        table = createRoundTable(
          id,
          x,
          y,
          60,
          config.roundSeats || 8,
          label,
          config.seatOrdering,
          config.seatModes
        );
      } else {
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
          config.seatOrdering,
          config.seatModes
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

      {/* BOTTOM RIGHT CONTROLS - FABs above Card */}
      <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
        {/* FLOATING ACTION BUTTONS - Vertical stack */}
        <Stack direction="column" spacing={1} alignItems="flex-end">
          {/* Meal Plan FAB - Left */}
          {maxMealPlanCount > 0 && (
            <Tooltip title="Select Meal Plan" placement="left">
              <Badge
                badgeContent={selectedMealPlanIndex !== null ? selectedMealPlanIndex + 1 : 0}
                color="success"
                invisible={selectedMealPlanIndex === null}
              >
                <Fab
                  color={selectedMealPlanIndex !== null ? 'success' : 'default'}
                  size="medium"
                  onClick={handleMealPlanClick}
                >
                  <Restaurant />
                </Fab>
              </Badge>
            </Tooltip>
          )}
          {/* Add Table FAB - Right */}
          <Tooltip title="Add Table" placement="left">
            <Fab color="primary" size="medium" onClick={handleAddTableClick}>
              <AddIcon />
            </Fab>
          </Tooltip>
        </Stack>

        {/* ZOOM LEVEL + CONNECTOR GAP CONTROLS - Card */}
        <Paper elevation={2} sx={{ px: 2, py: 1, minWidth: 140, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Zoom: {Math.round(zoomLevel * 100)}%
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" mt={1}>
            <Typography variant="caption">Gap:</Typography>
            <Slider
              size="small"
              value={connectorGap}
              onChange={(_, v) => setConnectorGap(v as number)}
              min={2}
              max={30}
              sx={{ width: 80 }}
            />
          </Stack>
        </Paper>
      </Box>

      {/* Meal Plan Popover */}
      <Popover
        open={mealPlanPopoverOpen}
        anchorEl={mealPlanAnchorEl}
        onClose={handleMealPlanClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <Paper sx={{ p: 2, minWidth: 220 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <Restaurant color="success" fontSize="small" />
            <Typography variant="subtitle2" fontWeight="bold">
              Select Meal Plan
            </Typography>
          </Stack>
          <FormControl fullWidth size="small">
            <Select
              value={selectedMealPlanIndex === null ? 'none' : selectedMealPlanIndex}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMealPlanIndex(val === 'none' ? null : Number(val));
                handleMealPlanClose();
              }}
            >
              {mealPlanOptions.map((option) => (
                <MenuItem key={option.value === null ? 'none' : option.value} value={option.value === null ? 'none' : option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedMealPlanIndex !== null && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Showing meal plan on guest boxes
            </Typography>
          )}
        </Paper>
      </Popover>

      {/* ADD TABLE MODAL */}
      <AddTableModal
        open={isAddTableModalOpen}
        onClose={handleCloseAddModal}
        onConfirm={(config) => {
          handleAddTable(config);
          handleCloseAddModal();
        }}
      />
    </div>
  );
}