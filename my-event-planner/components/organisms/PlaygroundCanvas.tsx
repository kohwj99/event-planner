// components/organisms/PlaygroundCanvas.tsx
// Main canvas for seat planning with D3-based SVG rendering
// Uses centralized color configuration from colorConfig.ts via colorModeStore

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
import ColorModeToggle, { CanvasColorLegend } from '@/components/atoms/ColorModeToggle';

import { useSeatStore } from '@/store/seatStore';
import { useGuestStore, Guest } from '@/store/guestStore';
import { useColorScheme } from '@/store/colorModeStore';
import { createRoundTable, createRectangleTable } from '@/utils/generateTable';
import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/types/Chunk';
import { Table } from '@/types/Table';
import { EventType } from '@/types/Event';

// Import SVG helper functions
import {
  renderSeats,
  renderTableGuestDisplay,
} from '@/utils/tableSVGHelper';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface PlaygroundCanvasProps {
  sessionType?: EventType | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PlaygroundCanvas({ sessionType = null }: PlaygroundCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gLayerRef = useRef<SVGGElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [connectorGap, setConnectorGap] = useState<number>(8);
  const [showLegend, setShowLegend] = useState(false);

  // Meal plan popover state
  const [mealPlanAnchorEl, setMealPlanAnchorEl] = useState<HTMLButtonElement | null>(null);
  const mealPlanPopoverOpen = Boolean(mealPlanAnchorEl);

  // Get color scheme from store
  const colorScheme = useColorScheme();

  // Store hooks
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
    selectedMealPlanIndex,
    setSelectedMealPlanIndex,
    ensureChunkExists,
    assignTableToChunk,
    expandWorldIfNeeded,
    cleanupEmptyChunks,
  } = useSeatStore();

  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);

  const guests = useMemo(
    () => [...hostGuests, ...externalGuests],
    [hostGuests, externalGuests]
  );

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

  // ============================================================================
  // MODAL & POPOVER HANDLERS
  // ============================================================================

  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const handleAddTableClick = () => setIsAddTableModalOpen(true);
  const handleCloseAddModal = () => setIsAddTableModalOpen(false);

  const handleMealPlanClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMealPlanAnchorEl(event.currentTarget);
  };

  const handleMealPlanClose = () => {
    setMealPlanAnchorEl(null);
  };

  // ============================================================================
  // SVG INITIALIZATION
  // ============================================================================

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    // Create background pattern
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

  // ============================================================================
  // CHUNKS RENDERING
  // ============================================================================

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
      .attr('fill', '#616161')
      .attr('font-size', 18);
    
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

  // ============================================================================
  // TABLES RENDERING (using tableSVGHelper with colorScheme)
  // ============================================================================

  useEffect(() => {
    const svgEl = svgRef.current;
    const gEl = gLayerRef.current;
    if (!svgEl || !gEl) return;

    const g = d3.select(gEl).select('.tables-layer');
    const tableGroups = g.selectAll<SVGGElement, Table>('.table-group').data(tables, (d) => d.id);
    
    tableGroups.exit().remove();
    
    const enter = tableGroups
      .enter()
      .append('g')
      .attr('class', 'table-group')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'grab');

    // Create table shapes on enter - using colorScheme
    enter.each(function (this: SVGGElement, d: Table) {
      const grp = d3.select(this);
      const isSelected = d.id === selectedTableId;
      const fillColor = isSelected ? colorScheme.table.tableSelectedFill : colorScheme.table.tableFill;
      
      if (d.shape === 'round') {
        grp.append('circle')
          .attr('r', d.radius)
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke)
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
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke)
          .attr('stroke-width', 2)
          .attr('rx', 4)
          .attr('ry', 4)
          .on('click', function (event) { event.stopPropagation(); setSelectedTable(d.id); });
      }
    });

    // Table label - using colorScheme
    enter.append('text')
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('fill', colorScheme.table.tableText)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .text((d) => d.label);

    const merged = enter.merge(tableGroups as any).attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Update table colors when selection changes
    merged.each(function (d) {
      const grp = d3.select(this);
      const isSelected = d.id === selectedTableId;
      const fillColor = isSelected ? colorScheme.table.tableSelectedFill : colorScheme.table.tableFill;
      
      if (d.shape === 'round') {
        grp.select('circle')
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke);
      } else {
        grp.select('rect')
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke);
      }
      
      grp.select('text')
        .attr('fill', colorScheme.table.tableText);
    });

    // Render table contents using helper functions with colorScheme
    merged.each(function (tableDatum) {
      const group = d3.select(this);

      // Render seats with mode-based colors (using helper with colorScheme)
      renderSeats(
        group as any,
        tableDatum,
        colorScheme,
        selectSeat,
        lockSeat,
        clearSeat
      );

      // Render guest display (connectors + boxes with centered text + meal plan)
      renderTableGuestDisplay(
        group as any,
        tableDatum,
        guestLookup,
        connectorGap,
        selectedMealPlanIndex,
        colorScheme
      );
    });

    // ================================================================
    // DRAG BEHAVIOR
    // ================================================================
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
        if (zoomBehavior.current) svgSelection.call(zoomBehavior.current as any);
        d3.select(this).style('cursor', 'grab');
      });

    merged.call(drag as any);

  }, [
    tables, moveTable, selectSeat, lockSeat, clearSeat,
    selectedTableId, selectedSeatId, selectedMealPlanIndex,
    ensureChunkExists, assignTableToChunk, expandWorldIfNeeded,
    cleanupEmptyChunks, connectorGap, guestLookup, colorScheme
  ]);

  // ============================================================================
  // ADD TABLE HANDLER
  // ============================================================================

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
        table = createRoundTable(
          id, x, y, 60,
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
          id, x, y,
          top, bottom, left, right,
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div id="playground-canvas" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Paper elevation={0} sx={{ position: 'absolute', inset: 0, bgcolor: '#fafafa' }}>
        <Box
          component="svg"
          ref={svgRef}
          sx={{ width: '100%', height: '100%', display: 'block', userSelect: 'none', touchAction: 'none' }}
          preserveAspectRatio="xMidYMid meet"
        />
      </Paper>

      {/* Top Right - Color Mode Toggle */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1,
        }}
      >
        <Paper elevation={2} sx={{ px: 2, py: 1, borderRadius: 2 }}>
          <ColorModeToggle size="small" showLabel />
        </Paper>
        
        {/* Toggle Legend Button */}
        <Tooltip title={showLegend ? 'Hide Legend' : 'Show Legend'} placement="left">
          <Paper
            elevation={1}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => setShowLegend(!showLegend)}
          >
            <Typography variant="caption" color="text.secondary">
              {showLegend ? 'Hide Legend' : 'Legend'}
            </Typography>
          </Paper>
        </Tooltip>
        
        {/* Color Legend (collapsible) */}
        {showLegend && <CanvasColorLegend />}
      </Box>

      {/* Bottom Right Controls */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        {/* FAB Buttons - VERTICAL Stack (Meal Plan on top, Add Table below) */}
        <Stack direction="column" spacing={1} alignItems="center">
          {/* Meal Plan FAB - Only show if there are meal plans */}
          {maxMealPlanCount > 0 && (
            <Tooltip title="Select Meal Plan to Display" placement="left">
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

          {/* Add Table FAB - Below Meal Plan */}
          <Tooltip title="Add Table" placement="left">
            <Fab color="primary" size="medium" onClick={handleAddTableClick}>
              <AddIcon />
            </Fab>
          </Tooltip>
        </Stack>

        {/* Zoom & Connector Gap Controls Card */}
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
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
                <MenuItem
                  key={option.value === null ? 'none' : option.value}
                  value={option.value === null ? 'none' : option.value}
                >
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

      {/* Add Table Modal */}
      <AddTableModal
        open={isAddTableModalOpen}
        onClose={handleCloseAddModal}
        onConfirm={(config) => {
          handleAddTable(config);
          handleCloseAddModal();
        }}
        sessionType={sessionType}
      />
    </div>
  );
}