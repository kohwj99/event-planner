// components/organisms/PlaygroundCanvas.tsx
// Main canvas for seat planning with D3-based SVG rendering
// Uses centralized color configuration from colorConfig.ts via colorModeStore
//
// UPDATED: UI Settings Persistence & Session Lock Support
// - Receives initialUISettings from parent (from useSessionLoader)
// - Notifies parent when UI settings change via onUISettingsChange
// - Disables all editing interactions when isLocked is true

'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TableRestaurant from '@mui/icons-material/TableRestaurant';
import CameraAlt from '@mui/icons-material/CameraAlt';

import AddTableModal, { TableConfig } from '@/components/molecules/AddTableModal';
import ColorModeToggle from '@/components/atoms/ColorModeToggle';
import { useCaptureSnapshot } from '@/components/providers/UndoRedoProvider';

import { useSeatStore } from '@/store/seatStore';
import { useGuestStore, Guest } from '@/store/guestStore';
import { useColorScheme, useColorModeStore } from '@/store/colorModeStore';
import { createRoundTable, createRectangleTable } from '@/utils/generateTable';
import { CHUNK_HEIGHT, CHUNK_WIDTH } from '@/types/Chunk';
import { Table } from '@/types/Table';
import { EventType, SessionUISettings } from '@/types/Event';

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
  /** When true, all editing is disabled (view-only mode) */
  isLocked?: boolean;
  /** UI settings from useSessionLoader - changes when session changes */
  initialUISettings?: SessionUISettings | null;
  /** Callback when user changes settings */
  onUISettingsChange?: (settings: SessionUISettings) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PlaygroundCanvas({ 
  sessionType = null,
  isLocked = false,
  initialUISettings,
  onUISettingsChange,
}: PlaygroundCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gLayerRef = useRef<SVGGElement | null>(null);
  
  // UI State - local state that renders the UI
  const [zoomLevel, setZoomLevel] = useState(1);
  const [connectorGap, setConnectorGap] = useState<number>(8);
  const [hideTableBodies, setHideTableBodies] = useState<boolean>(false);
  const [isPhotoMode, setIsPhotoMode] = useState<boolean>(false);

  // Flag to prevent notifying parent while we're syncing from parent's props
  const isSyncingFromParent = useRef(false);

  // Get color scheme from store
  const colorModeStore = useColorModeStore();
  const colorScheme = useColorScheme();
  const isColorblindMode = colorModeStore.colorMode === 'colorblind';

  // Meal plan popover state
  const [mealPlanAnchorEl, setMealPlanAnchorEl] = useState<HTMLButtonElement | null>(null);
  const mealPlanPopoverOpen = Boolean(mealPlanAnchorEl);

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

  const captureSnapshot = useCaptureSnapshot();

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

  const maxMealPlanCount = useMemo(() => {
    let max = 0;
    guests.forEach((g) => {
      if (g.mealPlans && g.mealPlans.length > max) {
        max = g.mealPlans.length;
      }
    });
    return max;
  }, [guests]);

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
  // SYNC UI SETTINGS FROM PARENT (when session changes)
  // ============================================================================

  useEffect(() => {
    // When initialUISettings changes (new session loaded), sync to local state
    if (initialUISettings) {
      console.log('[PlaygroundCanvas] Syncing settings from parent:', initialUISettings);
      isSyncingFromParent.current = true;
      
      setConnectorGap(initialUISettings.connectorGap ?? 8);
      setHideTableBodies(initialUISettings.hideTableBodies ?? false);
      setIsPhotoMode(initialUISettings.isPhotoMode ?? false);
      
      // Colorblind mode is already applied by useSessionLoader
      
      // Reset flag after state updates are processed
      requestAnimationFrame(() => {
        isSyncingFromParent.current = false;
      });
    }
  }, [initialUISettings]);

  // ============================================================================
  // NOTIFY PARENT OF SETTINGS CHANGES (when user interacts)
  // ============================================================================

  const notifyTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't notify if we're syncing from parent (would cause loop)
    if (isSyncingFromParent.current || !onUISettingsChange) return;
    
    // Clear pending notification
    if (notifyTimeout.current) {
      clearTimeout(notifyTimeout.current);
    }
    
    // Debounce notification
    notifyTimeout.current = setTimeout(() => {
      const settings: SessionUISettings = {
        connectorGap,
        hideTableBodies,
        isPhotoMode,
        isColorblindMode,
        zoomLevel,
      };
      console.log('[PlaygroundCanvas] Notifying parent of user changes:', settings);
      onUISettingsChange(settings);
    }, 200);
    
    return () => {
      if (notifyTimeout.current) clearTimeout(notifyTimeout.current);
    };
  }, [connectorGap, hideTableBodies, isPhotoMode, isColorblindMode, zoomLevel, onUISettingsChange]);

  // ============================================================================
  // LOCKED MODE HANDLERS - wrap store functions to check lock state
  // ============================================================================

  const handleSelectSeat = useCallback((tableId: string, seatId: string) => {
    if (isLocked) return;
    selectSeat(tableId, seatId);
  }, [isLocked, selectSeat]);

  const handleLockSeat = useCallback((tableId: string, seatId: string, locked: boolean) => {
    if (isLocked) return;
    captureSnapshot(locked ? "Lock Seat" : "Unlock Seat");
    lockSeat(tableId, seatId, locked);
  }, [isLocked, lockSeat, captureSnapshot]);

  const handleClearSeat = useCallback((tableId: string, seatId: string) => {
    if (isLocked) return;
    captureSnapshot("Clear Seat");
    clearSeat(tableId, seatId);
  }, [isLocked, clearSeat, captureSnapshot]);

  // ============================================================================
  // MODAL & POPOVER HANDLERS
  // ============================================================================

  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  
  const handleAddTableClick = () => {
    if (isLocked) return;
    setIsAddTableModalOpen(true);
  };
  
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
      .scaleExtent([0.1, 4])
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
      .text((c) => `Row:${c.row + 1} Col:${c.col + 1}`);
    
    chunkGroups.exit().remove();
  }, [chunks]);

  // ============================================================================
  // TABLES RENDERING
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
      .style('cursor', isLocked ? 'default' : 'grab');

    enter.each(function (this: SVGGElement, d: Table) {
      const grp = d3.select(this);
      const isSelected = d.id === selectedTableId;
      const fillColor = isSelected ? colorScheme.table.tableSelectedFill : colorScheme.table.tableFill;
      
      const bodyGroup = grp.append('g').attr('class', 'table-body');
      
      if (d.shape === 'round') {
        bodyGroup.append('circle')
          .attr('class', 'table-shape')
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke)
          .attr('stroke-width', 2)
          .on('click', function (event) { 
            event.stopPropagation(); 
            setSelectedTable(d.id); 
          });
      } else {
        bodyGroup.append('rect')
          .attr('class', 'table-shape')
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke)
          .attr('stroke-width', 2)
          .attr('rx', 4)
          .attr('ry', 4)
          .on('click', function (event) { 
            event.stopPropagation(); 
            setSelectedTable(d.id); 
          });
      }
      
      bodyGroup.append('text')
        .attr('class', 'table-label')
        .attr('y', 5)
        .attr('text-anchor', 'middle')
        .attr('fill', colorScheme.table.tableText)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .text(d.label);
    });

    const merged = enter.merge(tableGroups as any).attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Update cursor based on lock state
    merged.style('cursor', isLocked ? 'default' : 'grab');

    merged.each(function (d) {
      const grp = d3.select(this);
      const isSelected = d.id === selectedTableId;
      const fillColor = isSelected ? colorScheme.table.tableSelectedFill : colorScheme.table.tableFill;
      
      const bodyGroup = grp.select('.table-body');
      const photoScale = isPhotoMode ? 1.4 : 1; 

      if (d.shape === 'round') {
        bodyGroup.select('circle.table-shape')
          .attr('r', d.radius * photoScale)
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke);
      } else {
        const width = (d.width || 160) * photoScale;
        const height = (d.height || 100) * photoScale;
        bodyGroup.select('rect.table-shape')
          .attr('x', -width / 2)
          .attr('y', -height / 2)
          .attr('width', width)
          .attr('height', height)
          .attr('fill', fillColor)
          .attr('stroke', colorScheme.table.tableStroke);
      }
      
      bodyGroup.select('text.table-label')
        .attr('fill', colorScheme.table.tableText);
      
      bodyGroup.style('display', hideTableBodies ? 'none' : 'block');
    });

    // Render table contents
    merged.each(function (tableDatum) {
      const group = d3.select(this);

      // Use wrapped handlers that respect lock state
      renderSeats(
        group as any,
        tableDatum,
        colorScheme,
        guestLookup,
        selectedMealPlanIndex,
        isPhotoMode,
        handleSelectSeat,
        handleLockSeat,
        handleClearSeat
      );

      renderTableGuestDisplay(
        group as any,
        tableDatum,
        guestLookup,
        connectorGap,
        selectedMealPlanIndex,
        colorScheme,
        isPhotoMode
      );
    });

    // Drag behavior - only enable when not locked
    const svgSelection = d3.select(svgEl);
    
    if (!isLocked) {
      const drag = d3.drag<SVGGElement, Table>()
        .on('start', function () {
          svgSelection.on('.zoom', null);
          d3.select(this).style('cursor', 'grabbing');
          captureSnapshot("Move Table");
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
    } else {
      // Remove drag behavior when locked
      merged.on('.drag', null);
    }

  }, [
    tables, moveTable, handleSelectSeat, handleLockSeat, handleClearSeat,
    selectedTableId, selectedSeatId, selectedMealPlanIndex,
    ensureChunkExists, assignTableToChunk, expandWorldIfNeeded,
    cleanupEmptyChunks, connectorGap, guestLookup, colorScheme,
    hideTableBodies, isPhotoMode, isLocked, captureSnapshot
  ]);

  // ============================================================================
  // ADD TABLE HANDLER
  // ============================================================================

  const handleAddTable = (config: TableConfig) => {
    if (isLocked) return;
    captureSnapshot("Add Table");

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
        <Stack direction="column" spacing={1} alignItems="center">
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

          {/* Add Table FAB - disabled when locked */}
          <Tooltip title={isLocked ? 'Session is locked' : 'Add Table'} placement="left">
            <span>
              <Fab 
                color="primary" 
                size="medium" 
                onClick={handleAddTableClick}
                disabled={isLocked}
                sx={{ opacity: isLocked ? 0.5 : 1 }}
              >
                <AddIcon />
              </Fab>
            </span>
          </Tooltip>
        </Stack>

        {/* Controls Card */}
        <Paper elevation={2} sx={{ px: 2, py: 1.5, minWidth: 160, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Zoom: {Math.round(zoomLevel * 100)}%
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" mt={1}>
            <Typography variant="caption">Gap:</Typography>
            <Slider
              size="small"
              value={connectorGap}
              onChange={(_, v) => setConnectorGap(v as number)}
              min={-20}
              max={200}
              sx={{ width: 80 }}
            />
          </Stack>
          
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <ColorModeToggle size="small" showLabel />
          </Box>
          
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Tooltip title="Toggle visibility of table shapes" placement="left">
              <FormControlLabel
                control={
                  <Switch
                    checked={hideTableBodies}
                    onChange={(e) => setHideTableBodies(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <TableRestaurant fontSize="small" sx={{ color: hideTableBodies ? 'primary.main' : 'text.disabled' }} />
                    <Typography variant="caption" color={hideTableBodies ? 'text.primary' : 'text.disabled'}>
                      Hide Tables
                    </Typography>
                  </Stack>
                }
                sx={{ m: 0 }}
              />
            </Tooltip>
          </Box>

          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Tooltip title="Toggle Photography Mode" placement="left">
              <FormControlLabel
                control={
                  <Switch
                    checked={isPhotoMode}
                    onChange={(e) => setIsPhotoMode(e.target.checked)}
                    size="small"
                    color="secondary"
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <CameraAlt fontSize="small" sx={{ color: isPhotoMode ? 'secondary.main' : 'text.disabled' }} />
                    <Typography variant="caption" color={isPhotoMode ? 'text.primary' : 'text.disabled'}>
                      Photo Mode
                    </Typography>
                  </Stack>
                }
                sx={{ m: 0 }}
              />
            </Tooltip>
          </Box>
        </Paper>
      </Box>

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
        </Paper>
      </Popover>

      <AddTableModal
        open={isAddTableModalOpen && !isLocked}
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