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

import AddTableModal, { TableConfig } from '@/components/molecules/AddTableModal';

import {
  useSeatStore
} from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { createRoundTable, createRectangleTable } from '@/utils/generateTable';
import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/types/Chunk';
import { Table } from '@/types/Table';
import { Seat } from '@/types/Seat';

/**
 * 🎯 Controlled finite world (chunks expand only right/down)
 * - Visible dotted grid
 * - Striped background outside valid chunks
 * - Clean PDF/PPT export structure
 */
export default function PlaygroundCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gLayerRef = useRef<SVGGElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // --- NEW: connector gap state (user-adjustable) ---
  // Default 8 to match previous behavior. User can slide 0..120 px.
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

  // Create a lookup table for fast access
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const guests = useMemo(() => [...hostGuests, ...externalGuests], [hostGuests, externalGuests]);
  const guestLookup = useMemo(() => {
    const m: Record<string, any> = {};
    guests.forEach((g) => (m[g.id] = g));
    return m;
  }, [guests]);

  /** ---------- helper: crown color by ranking ---------- */
  function getCrownColor(ranking: number | string | undefined) {
    if (ranking === undefined || ranking === null) return null;
    const r = Number(ranking) || Infinity;
    if (r <= 1) return '#FFD700';       // gold
    if (r <= 2) return '#C0C0C0';       // silver
    if (r <= 3) return '#CD7F32';       // bronze
    if (r <= 4) return '#1976d2';       // blue
    return null;
  }

  /** ---------- SETUP SVG + ZOOM ---------- */
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    // Background pattern for outside area
    const defs = svg.append('defs');
    const pattern = defs
      .append('pattern')
      .attr('id', 'diagonal-stripes')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternTransform', 'rotate(45)');
    pattern.append('rect').attr('width', 10).attr('height', 20).attr('fill', '#f0f0f0');

    // Whole world background (striped)
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

    // --- ZOOM ---
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

    // Clear selection on background click
    svg.on('click', () => {
      setSelectedTable(null);
      selectSeat('', null);
    });
  }, []);

  /** ---------- DRAW CHUNKS (VISIBLE GRID) ---------- */
  useEffect(() => {
    const gEl = gLayerRef.current;
    if (!gEl) return;

    const chunkLayer = d3.select(gEl).select('.chunks-layer');
    const allChunks = Object.values(chunks).filter((c) => c.row >= 0 && c.col >= 0);

    const chunkGroups = chunkLayer
      .selectAll<SVGGElement, any>('g.chunk-group')
      .data(allChunks, (c: any) => c.id);

    const enter = chunkGroups.enter().append('g').attr('class', 'chunk-group');

    // Add rect with stronger dotted border
    enter
      .append('rect')
      .attr('class', 'chunk-outline')
      .attr('fill', 'white')
      .attr('stroke', '#9e9e9e')
      .attr('stroke-dasharray', '8,6')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Add coordinate label
    enter
      .append('text')
      .attr('class', 'chunk-label')
      .attr('x', 8)
      .attr('y', 20)
      .attr('fill', '#616161')
      .attr('font-size', 18)
      .text((c) => `R${c.row}C${c.col}`);

    const merged = enter.merge(chunkGroups as any);
    merged
      .select('rect.chunk-outline')
      .attr('x', (c) => c.col * CHUNK_WIDTH)
      .attr('y', (c) => c.row * CHUNK_HEIGHT)
      .attr('width', CHUNK_WIDTH)
      .attr('height', CHUNK_HEIGHT);

    merged
      .select('text.chunk-label')
      .attr('x', (c) => c.col * CHUNK_WIDTH + 16)
      .attr('y', (c) => c.row * CHUNK_HEIGHT + 28)
      .text((c) => `R${c.row}C${c.col}`);

    chunkGroups.exit().remove();
  }, [chunks]);

  /** ---------- RENDER TABLES ---------- */
  useEffect(() => {
    const svgEl = svgRef.current;
    const gEl = gLayerRef.current;
    if (!svgEl || !gEl) return;

    const g = d3.select(gEl).select('.tables-layer') as d3.Selection<
      SVGGElement,
      unknown,
      null,
      undefined
    >;

    const tableGroups = g.selectAll<SVGGElement, Table>('.table-group').data(tables, (d) => d.id);

    tableGroups.exit().remove();

    const enter = tableGroups
      .enter()
      .append('g')
      .attr('class', 'table-group')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'grab');

    // Table shape based on type
    enter.each(function (this: SVGGElement, d: Table) {
      const g = d3.select(this);
      if (d.shape === 'round') {
        g.append('circle')
          .attr('r', d.radius)
          .attr('fill', d.id === selectedTableId ? '#1565c0' : '#1976d2')
          .attr('stroke', '#0d47a1')
          .attr('stroke-width', 2)
          .on('click', function (this: SVGCircleElement, event: Event) {
            event.stopPropagation();
            setSelectedTable(d.id);
          });
      } else {
        // Rectangle table
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
          .on('click', function (this: SVGRectElement, event: Event) {
            event.stopPropagation();
            setSelectedTable(d.id);
          });
      }
    });

    enter
      .append('text')
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '14px')
      .text((d) => d.label);

    const merged = (enter.merge(tableGroups as any) as d3.Selection<
      SVGGElement,
      Table,
      any,
      any
    >).attr('transform', (d) => `translate(${d.x},${d.y})`);

    merged.each(function (tableDatum) {
      const group = d3.select(this);

      // ---------- CONNECTORS (guaranteed behind everything: keep them in a first-child group) ----------
      const seatsWithGuest = (tableDatum.seats || []).filter((s) => s.assignedGuestId);

      // ensure we have a connectors layer as the FIRST child of the table group
      let connectorsLayer = group.select<SVGGElement>('g.connectors-layer');
      if (connectorsLayer.empty()) {
        // insert as first child so connectors render behind all other children
        connectorsLayer = group.insert('g', ':first-child').attr('class', 'connectors-layer') as d3.Selection<SVGGElement, unknown, null, undefined>;
      }

      // bind data to lines inside the connectors layer (not directly on group)
      const connectors = connectorsLayer.selectAll<SVGLineElement, Seat>('line.connector-line')
        .data(seatsWithGuest, (s: any) => s.id);

      // remove stale
      connectors.exit().remove();

      // enter -> append into connectorsLayer (so they are always inside that first-child group)
      const connectorsEnter = connectors.enter()
        .append('line')
        .attr('class', 'connector-line')
        .attr('stroke', '#90a4ae')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');

      // update (enter+update)
      connectorsEnter
        .merge(connectors as any)
        .each(function (s: Seat) {
          const relX = s.x - tableDatum.x;
          const relY = s.y - tableDatum.y;

          // compute outward direction (same logic you already use)
          let nx = 0, ny = 0;
          if (tableDatum.shape === 'round') {
            const len = Math.sqrt(relX * relX + relY * relY) || 1;
            nx = relX / len;
            ny = relY / len;
          } else {
            if (Math.abs(relX) >= Math.abs(relY)) { nx = relX >= 0 ? 1 : -1; ny = 0; }
            else { nx = 0; ny = relY >= 0 ? 1 : -1; }
          }

          // match the same box sizing/offset you use for guest boxes
          const guest = s.assignedGuestId ? guestLookup[s.assignedGuestId] : null;
          const line1 = guest ? `${guest.salutation || ''} ${guest.name || ''}`.trim() : '';
          const line2 = guest ? `${guest.country || ''} | ${guest.company || ''}`.trim() : '';
          const paddingX = 10, paddingY = 6, lineHeight = 14;
          const charPx = 7;
          const estTextWidth = Math.max(line1.length, line2.length) * charPx;
          const maxBoxWidth = 300;
          const width = Math.min(Math.max(60, estTextWidth + paddingX * 2), maxBoxWidth);
          // --- USE connectorGap (user-controlled) instead of fixed gap ---
          const seatR = s.radius ?? 8;
          const centerOffset = seatR + connectorGap + width / 2;

          const boxCenterX = relX + nx * centerOffset;
          const boxCenterY = relY + ny * centerOffset;

          d3.select(this)
            .attr('x1', relX)
            .attr('y1', relY)
            .attr('x2', boxCenterX)
            .attr('y2', boxCenterY);
        });


      // ---------- SEATS (so they render above connectors) ----------
      const seatsSel = group.selectAll<SVGCircleElement, Seat>('circle.seat').data(tableDatum.seats || [], (s) => s.id);
      seatsSel.exit().remove();
      const seatsEnter = seatsSel.enter().append('circle').attr('class', 'seat');
      seatsEnter
        .merge(seatsSel as any)
        .attr('cx', (s) => s.x - tableDatum.x)
        .attr('cy', (s) => s.y - tableDatum.y)
        .attr('r', (s) => s.radius)
        .attr('fill', (s) => (s.locked ? '#b0bec5' : s.assignedGuestId ? '#66bb6a' : s.selected ? '#ffb300' : '#90caf9'))
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

      // ---------- Seat labels ----------
      const seatLabels = group.selectAll<SVGTextElement, Seat>('text.seat-number')
        .data(tableDatum.seats || [], (s) => s.id);
      seatLabels.exit().remove();
      const seatLabelsEnter = seatLabels.enter().append('text').attr('class', 'seat-number');
      seatLabelsEnter
        .merge(seatLabels as any)
        .attr('x', (s) => s.x - tableDatum.x)
        .attr('y', (s) => s.y - tableDatum.y + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0d47a1')
        .attr('font-size', '10px')
        .text((s) => s.seatNumber);

      // ---------- GUEST BOXES (draw after connectors & seats so they are on top) ----------
      const guestBoxes = group
        .selectAll<SVGGElement, Seat>('g.guest-box')
        .data(tableDatum.seats || [], (s) => s.id);
      guestBoxes.exit().remove();
      const guestBoxesEnter = guestBoxes.enter()
        .append('g')
        .attr('class', 'guest-box')
        .style('pointer-events', 'none');

      guestBoxesEnter.append('rect').attr('class', 'guest-rect').attr('rx', 8).attr('ry', 8).attr('stroke-width', 1.2).attr('stroke', '#1565c0');
      guestBoxesEnter.append('path').attr('class', 'guest-crown').attr('pointer-events', 'none');
      guestBoxesEnter.append('text').attr('class', 'guest-name').attr('font-size', 11).attr('fill', '#0d47a1');
      guestBoxesEnter.append('text').attr('class', 'guest-meta').attr('font-size', 10).attr('fill', '#455a64');

      // --- Build initial box positions ---
      const boxData: any[] = [];
      (tableDatum.seats || []).forEach((s) => {
        const guest = s.assignedGuestId ? guestLookup[s.assignedGuestId] : null;
        if (!guest) return;

        const relX = s.x - tableDatum.x;
        const relY = s.y - tableDatum.y;

        // outward normal
        let nx = 0, ny = 0;
        if (tableDatum.shape === 'round') {
          const len = Math.sqrt(relX * relX + relY * relY) || 1;
          nx = relX / len;
          ny = relY / len;
        } else {
          if (Math.abs(relX) >= Math.abs(relY)) { nx = relX >= 0 ? 1 : -1; ny = 0; }
          else { nx = 0; ny = relY >= 0 ? 1 : -1; }
        }

        const line1 = `${guest.salutation || ''} ${guest.name || ''}`.trim();
        const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();
        const paddingX = 10, paddingY = 6, lineHeight = 14;
        const charPx = 7;
        const estTextWidth = Math.max(line1.length, line2.length) * charPx;
        const maxBoxWidth = 300;
        const width = Math.min(Math.max(60, estTextWidth + paddingX * 2), maxBoxWidth);
        const height = lineHeight * 2 + paddingY * 2;

        const seatR = s.radius ?? 8;
        const dist = seatR + connectorGap + width / 2;

        boxData.push({
          s,
          guest,
          nx, ny,
          width, height,
          x: relX + nx * dist,
          y: relY + ny * dist
        });
      });

      // --- Localized overlap relaxation ---
      function relaxOverlaps(boxes: any[], shape: 'round' | 'rectangle') {
        const iterations = 50;
        const padding = 6;
        let changed = true;
        let iter = 0;

        while (changed && iter < iterations) {
          changed = false;
          iter++;
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i];
              const b = boxes[j];

              // Detect overlap
              if (
                a.x < b.x + b.width + padding &&
                a.x + a.width + padding > b.x &&
                a.y < b.y + b.height + padding &&
                a.y + a.height + padding > b.y
              ) {
                changed = true;

                const dx = (a.x + a.width / 2) - (b.x + b.width / 2);
                const dy = (a.y + a.height / 2) - (b.y + b.height / 2);

                // overlap magnitude
                const overlapX = Math.max(0, (a.width + padding) - Math.abs(dx));
                const overlapY = Math.max(0, (a.height + padding) - Math.abs(dy));
                const moveMultiplier = 2.5; // 1 = half, 2 = full overlap, >2 = overshoot

                if (shape === 'rectangle') {
                  // move along predominant axis
                  if (Math.abs(dx) > Math.abs(dy)) {
                    const move = overlapX / 2 * moveMultiplier;
                    a.x += Math.sign(dx) * move;
                    b.x -= Math.sign(dx) * move;
                  } else {
                    const move = overlapY / 2 * moveMultiplier;
                    a.y += Math.sign(dy) * move;
                    b.y -= Math.sign(dy) * move;
                  }
                } else {
                  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                  const moveX = (dx / dist) * Math.max(overlapX, overlapY) / 2 * moveMultiplier;
                  const moveY = (dy / dist) * Math.max(overlapX, overlapY) / 2 * moveMultiplier;
                  a.x += moveX;
                  a.y += moveY;
                  b.x -= moveX;
                  b.y -= moveY;
                }

                // Small random jitter to help dense clusters
                const jitter = 2;
                a.x += (Math.random() - 0.5) * jitter;
                a.y += (Math.random() - 0.5) * jitter;
                b.x += (Math.random() - 0.5) * jitter;
                b.y += (Math.random() - 0.5) * jitter;
              }
            }
          }
        }
      }

      // Run overlap relaxation
      relaxOverlaps(boxData, tableDatum.shape);

      // --- Render guest boxes using relaxed positions ---
      boxData.forEach((b) => {
        const { guest, s, width, height } = b;
        const rectX = b.x - width / 2;
        const rectY = b.y - height / 2;
        const isHost = !!guest.fromHost;
        const hostFill = '#e3f2fd', hostStroke = '#1976d2';
        const externalFill = '#e8f5e9', externalStroke = '#2e7d32';

        const gbox = group.selectAll<SVGGElement, any>('g.guest-box').filter((d) => d.id === s.id);

        gbox.select('rect.guest-rect')
          .attr('x', rectX)
          .attr('y', rectY)
          .attr('width', width)
          .attr('height', height)
          .attr('fill', isHost ? hostFill : externalFill)
          .attr('stroke', isHost ? hostStroke : externalStroke);

        const line1 = `${guest.salutation || ''} ${guest.name || ''}`.trim();
        const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();
        const paddingY = 6, lineHeight = 14;

        gbox.select('text.guest-name')
          .attr('x', b.x)
          .attr('y', rectY + paddingY + lineHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(line1);

        gbox.select('text.guest-meta')
          .attr('x', b.x)
          .attr('y', rectY + paddingY + lineHeight + lineHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(line2);

        // Crown (kept same)
        const crownColor = getCrownColor(guest.ranking);
        const crown = gbox.select('path.guest-crown');
        if (crownColor) {
          const crownW = Math.min(34, width * 0.28);
          const crownH = Math.min(18, height * 0.28);
          const left = rectX + 6;
          const right = left + crownW;
          const baseY = rectY + 6 + crownH;
          const p1x = left + crownW * 0.18, p2x = left + crownW * 0.5, p3x = left + crownW * 0.82;
          const p1y = baseY - crownH * 0.6, p2y = baseY - crownH * 0.95, p3y = baseY - crownH * 0.6;
          const v1x = left + crownW * 0.33, v1y = baseY - crownH * 0.25;
          const v2x = left + crownW * 0.67, v2y = baseY - crownH * 0.25;

          const d = [
            `M ${left} ${baseY}`,
            `L ${left} ${baseY - crownH * 0.18}`,
            `L ${p1x - 2} ${baseY - crownH * 0.30}`,
            `L ${p1x} ${p1y}`,
            `L ${v1x} ${v1y}`,
            `L ${p2x} ${p2y}`,
            `L ${v2x} ${v2y}`,
            `L ${p3x} ${p3y}`,
            `L ${right - 2} ${baseY - crownH * 0.30}`,
            `L ${right} ${baseY - crownH * 0.18}`,
            `L ${right} ${baseY}`,
            `Z`
          ].join(' ');
          crown.attr('d', d).attr('fill', crownColor).attr('stroke', '#8b5a00').attr('stroke-width', 0.7);
        } else {
          crown.attr('visibility', 'hidden');
        }

        // Update connector lines to follow final box positions
        group.selectAll<SVGLineElement, any>('line.connector-line')
          .filter((d) => d.id === s.id)
          .attr('x2', b.x)
          .attr('y2', b.y);
      });

    });


    /** ---------- DRAG behavior ---------- */
    const svgSelection = d3.select(svgEl);
    const drag = d3.drag<SVGGElement, Table>()
      .on('start', function () {
        svgSelection.on('.zoom', null);
        d3.select(this).style('cursor', 'grabbing');
      })
      .on('drag', function (event, d) {
        const [px, py] = d3.pointer(event, svgEl);
        const t = d3.zoomTransform(svgEl);
        const worldX = Math.max(0, (px - t.x) / t.k);
        const worldY = Math.max(0, (py - t.y) / t.k);
        d3.select(this).attr('transform', `translate(${worldX},${worldY})`);
        moveTable(d.id, worldX, worldY);

        const row = Math.floor(worldY / CHUNK_HEIGHT);
        const col = Math.floor(worldX / CHUNK_WIDTH);
        ensureChunkExists(row, col);
        assignTableToChunk(d.id, row, col);
        expandWorldIfNeeded();
      })
      .on('end', function () {
        cleanupEmptyChunks();
        if (zoomBehavior.current && svgEl) svgSelection.call(zoomBehavior.current as any);
        d3.select(this).style('cursor', 'grab');
      });

    merged.call(drag as any);

  }, [
    tables,
    moveTable,
    selectSeat,
    lockSeat,
    clearSeat,
    selectedTableId,
    selectedSeatId,
    ensureChunkExists,
    assignTableToChunk,
    expandWorldIfNeeded,
    cleanupEmptyChunks,
    // keep guest dependencies so boxes update when guests change
    hostGuests,
    externalGuests,
    // RE-RENDER when connectorGap changes
    connectorGap,
  ]);

  /** ---------- ZOOM CONTROLS ---------- */
  const zoomByFactor = (factor: number) => {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomBehavior.current) return;
    const svgSel = d3.select(svgEl);
    svgSel.transition().duration(300).call((sel: any) =>
      sel.call((zoomBehavior.current as any).scaleBy, factor)
    );
  };

  const resetZoom = () => {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomBehavior.current) return;
    const svgSel = d3.select(svgEl);
    svgSel
      .transition()
      .duration(300)
      .call((sel: any) => sel.call((zoomBehavior.current as any).transform, d3.zoomIdentity));
    setZoomLevel(1);
  };

  /** ---------- ADD TABLE ---------- */
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);

  const handleAddTableClick = () => {
    setIsAddTableModalOpen(true);
  };

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
      const label = config.label ? `${config.label} ${tables.length + i + 1}` : `Table ${tables.length + i + 1}`;

      // Offset each table slightly in a grid pattern
      const offsetX = (i % 3) * 200;  // 3 tables per row
      const offsetY = Math.floor(i / 3) * 200;
      const x = worldX + offsetX;
      const y = worldY + offsetY;

      let table;
      if (config.type === 'round') {
        table = createRoundTable(id, x, y, 60, config.roundSeats || 8, label);
      } else {
        const { top, bottom, left, right } = config.rectangleSeats || { top: 2, bottom: 2, left: 1, right: 1 };
        table = createRectangleTable(id, x, y, top, bottom, left, right, label);
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
        <Box
          component="svg"
          ref={svgRef}
          sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            userSelect: 'none',
            touchAction: 'none',
          }}
          preserveAspectRatio="xMidYMid meet"
        />
      </Paper>

      {/* Floating Controls */}
      <Stack spacing={1} sx={{ position: 'absolute', bottom: 24, right: 24, alignItems: 'center' }}>
        <Tooltip title="Add Table">
          <Fab color="primary" size="medium" onClick={handleAddTableClick}>
            <AddIcon />
          </Fab>
        </Tooltip>

        {/* Zoom buttons */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Tooltip title="Zoom Out">
            <Fab size="small" onClick={() => zoomByFactor(0.8)}>
              <ZoomOutIcon fontSize="small" />
            </Fab>
          </Tooltip>

          <Tooltip title="Reset View">
            <Fab size="small" onClick={resetZoom}>
              <CenterFocusStrongIcon fontSize="small" />
            </Fab>
          </Tooltip>

          <Tooltip title="Zoom In">
            <Fab size="small" onClick={() => zoomByFactor(1.25)}>
              <ZoomInIcon fontSize="small" />
            </Fab>
          </Tooltip>
        </Stack>

        {/* ---------- NEW: Connector distance slider ---------- */}
        <Box sx={{ width: 220, px: 1 }}>
          <Typography variant="caption" display="block" textAlign="center">
            Connector gap: {Math.round(connectorGap)}px
          </Typography>
          <Slider
            value={connectorGap}
            min={0}
            max={120}
            step={1}
            onChange={(_, v) => setConnectorGap(Array.isArray(v) ? v[0] : v)}
            size="small"
            aria-label="Connector gap"
          />
        </Box>
      </Stack>

      {/* Add Table Modal */}
      <AddTableModal
        open={isAddTableModalOpen}
        onClose={() => setIsAddTableModalOpen(false)}
        onConfirm={handleAddTable}
      />
    </div>
  );
}
