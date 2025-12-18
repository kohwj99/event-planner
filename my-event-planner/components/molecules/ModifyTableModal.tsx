// components/molecules/ModifyTableModal.tsx
// Modal for modifying existing table - follows AddTableModal pattern
// Includes seat modes tab for setting host-only/external-only restrictions

'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  Box,
  Paper,
  Chip,
  Divider,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import { Refresh, Warning, RadioButtonUnchecked, Person, Public } from '@mui/icons-material';
import { Table } from '@/types/Table';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';
import { createRoundTable, createRectangleTable } from '@/utils/generateTable';

export interface ModifyTableConfig {
  type: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  label: string;
  seatOrdering?: number[];
  seatModes?: Record<number, SeatMode>;
}

interface ModifyTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newTable: Table) => void;
  table: Table | null;
}

type Direction = 'clockwise' | 'counter-clockwise';

/**
 * Generate seat ordering based on direction, alternating mode, and start position
 */
const generateOrdering = (
  count: number,
  direction: Direction,
  useAlternating: boolean,
  startPosition: number
): number[] => {
  const result: number[] = new Array(count);

  if (!useAlternating) {
    if (direction === 'clockwise') {
      for (let i = 0; i < count; i++) {
        const position = (startPosition + i) % count;
        result[position] = i + 1;
      }
    } else {
      for (let i = 0; i < count; i++) {
        const position = (startPosition - i + count) % count;
        result[position] = i + 1;
      }
    }
  } else {
    result[startPosition] = 1;
    const odds: number[] = [];
    const evens: number[] = [];

    for (let i = 2; i <= count; i++) {
      if (i % 2 === 0) {
        evens.push(i);
      } else {
        odds.push(i);
      }
    }

    if (direction === 'clockwise') {
      for (let i = 0; i < evens.length; i++) {
        const position = (startPosition + 1 + i) % count;
        result[position] = evens[i];
      }
      for (let i = 0; i < odds.length; i++) {
        const position = (startPosition - 1 - i + count) % count;
        result[position] = odds[i];
      }
    } else {
      for (let i = 0; i < evens.length; i++) {
        const position = (startPosition - 1 - i + count) % count;
        result[position] = evens[i];
      }
      for (let i = 0; i < odds.length; i++) {
        const position = (startPosition + 1 + i) % count;
        result[position] = odds[i];
      }
    }
  }

  return result;
};

/**
 * Extract rectangle seat counts from a table's seats
 */
function extractRectangleSeats(table: Table): { top: number; bottom: number; left: number; right: number } {
  if (table.shape !== 'rectangle') {
    return { top: 2, bottom: 2, left: 1, right: 1 };
  }

  const width = table.width || 160;
  const height = table.height || 100;
  const centerX = table.x;
  const centerY = table.y;

  let top = 0, bottom = 0, left = 0, right = 0;

  table.seats.forEach((seat) => {
    const relX = seat.x - centerX;
    const relY = seat.y - centerY;

    if (Math.abs(relY + height / 2) < 30) {
      top++;
    } else if (Math.abs(relY - height / 2) < 30) {
      bottom++;
    } else if (Math.abs(relX + width / 2) < 30) {
      left++;
    } else if (Math.abs(relX - width / 2) < 30) {
      right++;
    }
  });

  if (top + bottom + left + right === 0) {
    return { top: 2, bottom: 2, left: 1, right: 1 };
  }

  return { top, bottom, left, right };
}

/**
 * Extract seat modes from existing table
 */
function extractSeatModes(table: Table): Record<number, SeatMode> {
  const modes: Record<number, SeatMode> = {};
  table.seats.forEach((seat, index) => {
    modes[index] = seat.mode || 'default';
  });
  return modes;
}

/**
 * Extract current ordering from table seats
 */
function extractCurrentOrdering(table: Table): number[] {
  return table.seats.map((seat) => seat.seatNumber);
}

export default function ModifyTableModal({
  open,
  onClose,
  onConfirm,
  table,
}: ModifyTableModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'ordering' | 'modes'>('config');

  // Table configuration
  const [tableConfig, setTableConfig] = useState<ModifyTableConfig>({
    type: 'round',
    roundSeats: 8,
    rectangleSeats: { top: 2, bottom: 2, left: 1, right: 1 },
    label: '',
  });

  // Ordering configuration
  const [direction, setDirection] = useState<Direction>('counter-clockwise');
  const [useAlternating, setUseAlternating] = useState<boolean>(false);
  const [startPosition, setStartPosition] = useState<number>(0);

  // Seat modes
  const [seatModes, setSeatModes] = useState<Record<number, SeatMode>>({});

  // Reset config when table changes or modal opens
  useEffect(() => {
    if (table && open) {
      // Initialize from existing table
      if (table.shape === 'round') {
        setTableConfig({
          type: 'round',
          roundSeats: table.seats.length,
          rectangleSeats: { top: 2, bottom: 2, left: 1, right: 1 },
          label: table.label,
        });
      } else {
        setTableConfig({
          type: 'rectangle',
          roundSeats: 8,
          rectangleSeats: extractRectangleSeats(table),
          label: table.label,
        });
      }

      // Extract seat modes
      setSeatModes(extractSeatModes(table));

      // Reset ordering to defaults
      setDirection('counter-clockwise');
      setUseAlternating(false);
      setStartPosition(0);
      setActiveTab('config');
    }
  }, [table, open]);

  // Calculate total seats
  const totalSeats = useMemo(() => {
    if (tableConfig.type === 'round') {
      return tableConfig.roundSeats || 8;
    } else {
      const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
      return top + bottom + left + right;
    }
  }, [tableConfig]);

  // Seat ordering
  const seatOrdering = useMemo(() => {
    return generateOrdering(totalSeats, direction, useAlternating, startPosition);
  }, [totalSeats, direction, useAlternating, startPosition]);

  // Reset start position and modes when seat count changes
  useEffect(() => {
    setStartPosition(0);
    // Reset modes if seat count changes
    if (table && totalSeats !== table.seats.length) {
      const newModes: Record<number, SeatMode> = {};
      for (let i = 0; i < totalSeats; i++) {
        newModes[i] = 'default';
      }
      setSeatModes(newModes);
    }
  }, [totalSeats, table]);

  // Check if there are changes that would unseat guests
  const seatsChanged = useMemo(() => {
    if (!table) return false;
    return totalSeats !== table.seats.length || tableConfig.type !== table.shape;
  }, [table, totalSeats, tableConfig.type]);

  const seatedGuestsCount = useMemo(() => {
    if (!table) return 0;
    return table.seats.filter((s) => s.assignedGuestId).length;
  }, [table]);

  // Handle seat click - for ordering tab sets start position, for modes tab cycles mode
  const handleSeatClick = (position: number) => {
    if (activeTab === 'ordering') {
      setStartPosition(position);
    } else if (activeTab === 'modes') {
      // Cycle through modes
      const currentMode = seatModes[position] || 'default';
      const modeOrder: SeatMode[] = ['default', 'host-only', 'external-only'];
      const currentIndex = modeOrder.indexOf(currentMode);
      const nextMode = modeOrder[(currentIndex + 1) % modeOrder.length];
      setSeatModes((prev) => ({ ...prev, [position]: nextMode }));
    }
  };

  // Set all seats to a specific mode
  const handleSetAllModes = (mode: SeatMode) => {
    const newModes: Record<number, SeatMode> = {};
    for (let i = 0; i < totalSeats; i++) {
      newModes[i] = mode;
    }
    setSeatModes(newModes);
  };

  // Reset ordering
  const handleResetOrdering = () => {
    setDirection('counter-clockwise');
    setUseAlternating(false);
    setStartPosition(0);
  };

  // Handle confirm
  const handleConfirm = () => {
    if (!table) return;

    // Convert seatModes Record to array
    const seatModesArray: SeatMode[] = [];
    for (let i = 0; i < totalSeats; i++) {
      seatModesArray.push(seatModes[i] || 'default');
    }

    // Create new table with updated configuration
    let newTable: Table;

    if (tableConfig.type === 'round') {
      newTable = createRoundTable(
        table.id,
        table.x,
        table.y,
        table.radius || 80,
        totalSeats,
        tableConfig.label || table.label,
        seatOrdering,
        seatModesArray
      );
    } else {
      const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
      newTable = createRectangleTable(
        table.id,
        table.x,
        table.y,
        top,
        bottom,
        left,
        right,
        tableConfig.label || table.label,
        seatOrdering,
        seatModesArray
      );
    }

    onConfirm(newTable);
    onClose();
  };

  if (!table) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Modify Table: {table.label}</Typography>
          {activeTab === 'ordering' && (
            <Button size="small" startIcon={<Refresh />} onClick={handleResetOrdering} variant="outlined">
              Reset
            </Button>
          )}
        </Stack>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label="Table Configuration" value="config" />
        <Tab label="Seat Ordering" value="ordering" />
        <Tab label="Seat Modes" value="modes" />
      </Tabs>

      <DialogContent sx={{ minHeight: 500 }}>
        {/* Warning about unseating guests */}
        {seatsChanged && seatedGuestsCount > 0 && (
          <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
            Changing the table configuration will unseat <strong>{seatedGuestsCount}</strong> guest{seatedGuestsCount > 1 ? 's' : ''}.
          </Alert>
        )}

        {activeTab === 'config' ? (
          // Configuration Tab
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Table Type</InputLabel>
              <Select
                value={tableConfig.type}
                label="Table Type"
                onChange={(e) =>
                  setTableConfig((prev) => ({
                    ...prev,
                    type: e.target.value as 'round' | 'rectangle',
                  }))
                }
              >
                <MenuItem value="round">Round</MenuItem>
                <MenuItem value="rectangle">Rectangle</MenuItem>
              </Select>
            </FormControl>

            {tableConfig.type === 'round' ? (
              <TextField
                type="number"
                label="Number of Seats"
                value={tableConfig.roundSeats}
                onChange={(e) =>
                  setTableConfig((prev) => ({
                    ...prev,
                    roundSeats: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                inputProps={{ min: 1 }}
                helperText="Seats arranged starting from top"
              />
            ) : (
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="text.secondary">
                  Seats per side:
                </Typography>
                <Stack direction="row" spacing={2}>
                  <TextField
                    type="number"
                    label="Top"
                    value={tableConfig.rectangleSeats?.top}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          top: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                  <TextField
                    type="number"
                    label="Bottom"
                    value={tableConfig.rectangleSeats?.bottom}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          bottom: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                  <TextField
                    type="number"
                    label="Left"
                    value={tableConfig.rectangleSeats?.left}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          left: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                  <TextField
                    type="number"
                    label="Right"
                    value={tableConfig.rectangleSeats?.right}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          right: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                </Stack>
              </Stack>
            )}

            <TextField
              label="Table Label"
              value={tableConfig.label}
              onChange={(e) => setTableConfig((prev) => ({ ...prev, label: e.target.value }))}
              helperText="Leave empty to keep existing label"
            />

            <Divider />

            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Current Seats</Typography>
                  <Typography variant="h6">{table.seats.length}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">New Seats</Typography>
                  <Typography variant="h6" color={seatsChanged ? 'warning.main' : 'inherit'}>{totalSeats}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Seated Guests</Typography>
                  <Typography variant="h6" color={seatedGuestsCount > 0 ? 'warning.main' : 'inherit'}>{seatedGuestsCount}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        ) : activeTab === 'ordering' ? (
          // Seat Ordering Tab
          <Stack spacing={3} sx={{ height: '100%' }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd' }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={3} alignItems="center">
                  <FormControl sx={{ minWidth: 180 }}>
                    <InputLabel>Direction</InputLabel>
                    <Select
                      value={direction}
                      label="Direction"
                      onChange={(e) => setDirection(e.target.value as Direction)}
                    >
                      <MenuItem value="clockwise">Clockwise ↻</MenuItem>
                      <MenuItem value="counter-clockwise">Counter-clockwise ↺</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={useAlternating}
                        onChange={(e) => setUseAlternating(e.target.checked)}
                      />
                    }
                    label="Alternating Pattern"
                  />
                </Stack>

                <Typography variant="caption" color="text.secondary">
                  🎯 Click on a seat to set Seat #1 starting position.{' '}
                  {useAlternating
                    ? `(Evens ${direction === 'clockwise' ? '→' : '←'} / Odds ${direction === 'clockwise' ? '←' : '→'})`
                    : `Simple ${direction} (1, 2, 3, ...)`
                  }
                </Typography>
              </Stack>
            </Paper>

            {/* Visual Preview */}
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#fafafa',
                minHeight: 300,
                p: 2,
              }}
            >
              {tableConfig.type === 'round' ? (
                <RoundTablePreview
                  seats={seatOrdering}
                  seatModes={seatModes}
                  startPosition={startPosition}
                  onSeatClick={handleSeatClick}
                  activeTab={activeTab}
                />
              ) : (
                <RectangleTablePreview
                  top={tableConfig.rectangleSeats?.top || 0}
                  bottom={tableConfig.rectangleSeats?.bottom || 0}
                  left={tableConfig.rectangleSeats?.left || 0}
                  right={tableConfig.rectangleSeats?.right || 0}
                  seats={seatOrdering}
                  seatModes={seatModes}
                  startPosition={startPosition}
                  onSeatClick={handleSeatClick}
                  activeTab={activeTab}
                />
              )}
            </Box>

            <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
              <Typography variant="caption" color="text.secondary">
                💡 <strong>Full Sequence:</strong> {seatOrdering.join(', ')}
              </Typography>
            </Paper>
          </Stack>
        ) : (
          // Seat Modes Tab
          <Stack spacing={3} sx={{ height: '100%' }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9' }}>
              <Stack spacing={2}>
                <Typography variant="subtitle2">Quick Actions:</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleSetAllModes('default')}
                    startIcon={<RadioButtonUnchecked />}
                  >
                    All Default
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => handleSetAllModes('host-only')}
                    startIcon={<Person />}
                  >
                    All Host Only
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleSetAllModes('external-only')}
                    startIcon={<Public />}
                  >
                    All External Only
                  </Button>
                </Stack>

                <Divider />

                <Typography variant="caption" color="text.secondary">
                  🎯 Click on a seat to cycle through modes: Default → Host Only → External Only
                </Typography>
              </Stack>
            </Paper>

            {/* Visual Preview with Mode Colors */}
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#fafafa',
                minHeight: 300,
                p: 2,
              }}
            >
              {tableConfig.type === 'round' ? (
                <RoundTablePreview
                  seats={seatOrdering}
                  seatModes={seatModes}
                  startPosition={startPosition}
                  onSeatClick={handleSeatClick}
                  activeTab={activeTab}
                />
              ) : (
                <RectangleTablePreview
                  top={tableConfig.rectangleSeats?.top || 0}
                  bottom={tableConfig.rectangleSeats?.bottom || 0}
                  left={tableConfig.rectangleSeats?.left || 0}
                  right={tableConfig.rectangleSeats?.right || 0}
                  seats={seatOrdering}
                  seatModes={seatModes}
                  startPosition={startPosition}
                  onSeatClick={handleSeatClick}
                  activeTab={activeTab}
                />
              )}
            </Box>

            {/* Legend */}
            <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
              <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: SEAT_MODE_CONFIGS['default'].color, border: `2px solid ${SEAT_MODE_CONFIGS['default'].strokeColor}` }} />
                  <Typography variant="caption">Default ({Object.values(seatModes).filter(m => !m || m === 'default').length})</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: SEAT_MODE_CONFIGS['host-only'].color, border: `2px solid ${SEAT_MODE_CONFIGS['host-only'].strokeColor}` }} />
                  <Typography variant="caption">Host Only ({Object.values(seatModes).filter(m => m === 'host-only').length})</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: SEAT_MODE_CONFIGS['external-only'].color, border: `2px solid ${SEAT_MODE_CONFIGS['external-only'].strokeColor}` }} />
                  <Typography variant="caption">External Only ({Object.values(seatModes).filter(m => m === 'external-only').length})</Typography>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={seatsChanged && seatedGuestsCount > 0 ? 'warning' : 'primary'}
        >
          {seatsChanged && seatedGuestsCount > 0 ? 'Apply Changes (Unseat Guests)' : 'Apply Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Round Table Preview Component ---
interface RoundTablePreviewProps {
  seats: number[];
  seatModes: Record<number, SeatMode>;
  startPosition: number;
  onSeatClick: (position: number) => void;
  activeTab: 'config' | 'ordering' | 'modes';
}

function RoundTablePreview({ seats, seatModes, startPosition, onSeatClick, activeTab }: RoundTablePreviewProps) {
  const size = 400;
  const radius = size * 0.28;
  const seatRadius = size * 0.055;
  const center = size / 2;

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Table circle */}
        <circle cx={center} cy={center} r={radius} fill="#1976d2" stroke="#0d47a1" strokeWidth="3" />

        {/* Seats */}
        {seats.map((seatNumber, index) => {
          const angle = (index / seats.length) * 2 * Math.PI - Math.PI / 2;
          const x = center + Math.cos(angle) * (radius + seatRadius * 2.5);
          const y = center + Math.sin(angle) * (radius + seatRadius * 2.5);
          const isSeatOne = seatNumber === 1;
          const mode = seatModes[index] || 'default';
          const modeConfig = SEAT_MODE_CONFIGS[mode];

          // Determine fill color based on active tab
          let fillColor = modeConfig.color;
          let strokeColor = modeConfig.strokeColor;
          if (activeTab === 'ordering' && isSeatOne) {
            fillColor = '#4caf50';
            strokeColor = '#2e7d32';
          }

          return (
            <g key={index} onClick={() => onSeatClick(index)} style={{ cursor: 'pointer' }}>
              {/* Highlight ring for seat #1 in ordering tab */}
              {activeTab === 'ordering' && isSeatOne && (
                <circle cx={x} cy={y} r={seatRadius + 4} fill="none" stroke="#4caf50" strokeWidth="3" />
              )}

              <circle
                cx={x}
                cy={y}
                r={seatRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="2"
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize={seatRadius * 0.7}
                fontWeight="bold"
                fill={(activeTab === 'ordering' && isSeatOne) ? 'white' : '#0d47a1'}
              >
                {seatNumber}
              </text>
              {/* Mode indicator for modes tab */}
              {activeTab === 'modes' && modeConfig.shortLabel && (
                <text
                  x={x}
                  y={y + seatRadius * 1.8}
                  textAnchor="middle"
                  fontSize={seatRadius * 0.5}
                  fill={strokeColor}
                  fontWeight="bold"
                >
                  {modeConfig.shortLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {activeTab === 'ordering' && (
        <Chip
          label={`Seat #1 at Position ${startPosition + 1}`}
          color="success"
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8 }}
        />
      )}
    </Box>
  );
}

// --- Rectangle Table Preview Component ---
interface RectangleTablePreviewProps {
  top: number;
  bottom: number;
  left: number;
  right: number;
  seats: number[];
  seatModes: Record<number, SeatMode>;
  startPosition: number;
  onSeatClick: (position: number) => void;
  activeTab: 'config' | 'ordering' | 'modes';
}

function RectangleTablePreview({
  top,
  bottom,
  left,
  right,
  seats,
  seatModes,
  startPosition,
  onSeatClick,
  activeTab,
}: RectangleTablePreviewProps) {
  const containerWidth = 500;
  const containerHeight = 350;

  const tableWidth = containerWidth * 0.5;
  const tableHeight = containerHeight * 0.45;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const seatRadius = Math.min(22, containerWidth * 0.04);
  const seatOffset = seatRadius * 2;

  // Calculate seat positions
  const seatPositions: { x: number; y: number }[] = [];

  // Top seats (left to right)
  for (let i = 0; i < top; i++) {
    const spacing = tableWidth / (top + 1);
    seatPositions.push({
      x: centerX - tableWidth / 2 + spacing * (i + 1),
      y: centerY - tableHeight / 2 - seatOffset,
    });
  }

  // Right seats (top to bottom)
  for (let i = 0; i < right; i++) {
    const spacing = tableHeight / (right + 1);
    seatPositions.push({
      x: centerX + tableWidth / 2 + seatOffset,
      y: centerY - tableHeight / 2 + spacing * (i + 1),
    });
  }

  // Bottom seats (right to left)
  for (let i = 0; i < bottom; i++) {
    const spacing = tableWidth / (bottom + 1);
    seatPositions.push({
      x: centerX + tableWidth / 2 - spacing * (i + 1),
      y: centerY + tableHeight / 2 + seatOffset,
    });
  }

  // Left seats (bottom to top)
  for (let i = 0; i < left; i++) {
    const spacing = tableHeight / (left + 1);
    seatPositions.push({
      x: centerX - tableWidth / 2 - seatOffset,
      y: centerY + tableHeight / 2 - spacing * (i + 1),
    });
  }

  return (
    <Box sx={{ position: 'relative', width: containerWidth, height: containerHeight }}>
      <svg width={containerWidth} height={containerHeight}>
        {/* Table rectangle */}
        <rect
          x={centerX - tableWidth / 2}
          y={centerY - tableHeight / 2}
          width={tableWidth}
          height={tableHeight}
          fill="#1976d2"
          stroke="#0d47a1"
          strokeWidth="3"
          rx="8"
        />

        {/* Seats */}
        {seats.map((seatNumber, index) => {
          const pos = seatPositions[index];
          if (!pos) return null;
          const isSeatOne = seatNumber === 1;
          const mode = seatModes[index] || 'default';
          const modeConfig = SEAT_MODE_CONFIGS[mode];

          let fillColor = modeConfig.color;
          let strokeColor = modeConfig.strokeColor;
          if (activeTab === 'ordering' && isSeatOne) {
            fillColor = '#4caf50';
            strokeColor = '#2e7d32';
          }

          return (
            <g key={index} onClick={() => onSeatClick(index)} style={{ cursor: 'pointer' }}>
              {activeTab === 'ordering' && isSeatOne && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={seatRadius + 4}
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="3"
                />
              )}

              <circle
                cx={pos.x}
                cy={pos.y}
                r={seatRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="2"
              />
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                fontSize={seatRadius * 0.7}
                fontWeight="bold"
                fill={(activeTab === 'ordering' && isSeatOne) ? 'white' : '#0d47a1'}
              >
                {seatNumber}
              </text>
              {activeTab === 'modes' && modeConfig.shortLabel && (
                <text
                  x={pos.x}
                  y={pos.y + seatRadius * 1.8}
                  textAnchor="middle"
                  fontSize={seatRadius * 0.5}
                  fill={strokeColor}
                  fontWeight="bold"
                >
                  {modeConfig.shortLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {activeTab === 'ordering' && (
        <Chip
          label={`Seat #1 at Position ${startPosition + 1}`}
          color="success"
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8 }}
        />
      )}
    </Box>
  );
}