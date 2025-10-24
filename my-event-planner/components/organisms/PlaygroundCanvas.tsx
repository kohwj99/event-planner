'use client';

import { useState, useRef, useEffect } from 'react';
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

import AddTableModal, { TableConfig } from '@/components/molecules/AddTableModal';

import {
  useSeatStore
} from '@/store/seatStore';
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

  /** ---------- INITIAL SETUP ---------- */
  // useEffect(() => {
  //   if (tables.length === 0) {
  //     const t1 = createRoundTable('t1', 300, 300, 60, 8, 'Table A');
  //     const t2 = createRoundTable('t2', 500, 300, 80, 10, 'Table B');
  //     addTable(t1);
  //     addTable(t2);
  //   }
  // }, []);

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
    enter.each(function(this: SVGGElement, d: Table) {
      const g = d3.select(this);
      if (d.shape === 'round') {
        g.append('circle')
          .attr('r', d.radius)
          .attr('fill', d.id === selectedTableId ? '#1565c0' : '#1976d2')
          .attr('stroke', '#0d47a1')
          .attr('stroke-width', 2)
          .on('click', function(this: SVGCircleElement, event: Event) {
            event.stopPropagation();
            setSelectedTable(d.id);
          });
      } else {
        // Rectangle table
        const width = d.width || 160;
        const height = d.height || 100;
        g.append('rect')
          .attr('x', -width/2)
          .attr('y', -height/2)
          .attr('width', width)
          .attr('height', height)
          .attr('fill', d.id === selectedTableId ? '#1565c0' : '#1976d2')
          .attr('stroke', '#0d47a1')
          .attr('stroke-width', 2)
          .on('click', function(this: SVGRectElement, event: Event) {
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
      const seatsSel = group.selectAll<SVGCircleElement, Seat>('circle.seat').data(tableDatum.seats || [], (s) => s.id);


      seatsSel.exit().remove();

      const seatsEnter = seatsSel.enter().append('circle').attr('class', 'seat');
      seatsEnter
        .merge(seatsSel as any)
        .attr('cx', (s) => s.x - tableDatum.x)
        .attr('cy', (s) => s.y - tableDatum.y)
        .attr('r', (s) => s.radius)
        .attr('fill', (s) => (s.locked ? '#b0bec5' : s.selected ? '#ffb300' : '#90caf9'))
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

      const seatLabels = group
        .selectAll<SVGTextElement, Seat>('text.seat-number')
        .data(
          tableDatum.seats || [], // fallback to empty array
          (s) => s.id
        );
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
    });

    /** ---------- DRAG behavior ---------- */
    const svgSelection = d3.select(svgEl);
    const drag = d3
      .drag<SVGGElement, Table>()
      .on('start', function () {
        svgSelection.on('.zoom', null);
        d3.select(this).style('cursor', 'grabbing');
      })
      .on('drag', function (event, d) {
        const [px, py] = d3.pointer(event, svgEl);
        const t = d3.zoomTransform(svgEl);
        const worldX = Math.max(0, (px - t.x) / t.k); // clamp to positive
        const worldY = Math.max(0, (py - t.y) / t.k); // clamp to positive
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
