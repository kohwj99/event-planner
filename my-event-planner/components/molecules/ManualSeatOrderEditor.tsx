// components/molecules/ManualSeatOrderEditor.tsx
// Interactive component for manually assigning seat numbers by clicking
// Supports both round and rectangle tables

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Refresh,
  Undo,
  Check,
  TouchApp,
  Info,
} from '@mui/icons-material';
import { SeatMode } from '@/types/Seat';
import { useColorScheme } from '@/store/colorModeStore';
import { ColorScheme } from '@/utils/colorConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface ManualSeatOrderEditorProps {
  // Table configuration
  tableType: 'round' | 'rectangle';
  totalSeats: number;
  roundSeats?: number;
  rectangleSeats?: { top: number; bottom: number; left: number; right: number };
  
  // Current ordering (can be from auto-pattern or previous manual)
  currentOrdering: number[];
  
  // Seat modes for visual display
  seatModes?: SeatMode[];
  
  // Callbacks
  onOrderingChange: (ordering: number[]) => void;
  onComplete?: () => void;
  
  // Optional styling
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
  colorScheme?: ColorScheme;
}

interface SeatPosition {
  x: number;
  y: number;
  index: number; // Physical position index (0-based)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateRoundSeatPositions(
  seatCount: number,
  centerX: number,
  centerY: number,
  seatDistance: number
): SeatPosition[] {
  const positions: SeatPosition[] = [];
  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2;
    positions.push({
      x: centerX + Math.cos(angle) * seatDistance,
      y: centerY + Math.sin(angle) * seatDistance,
      index: i,
    });
  }
  return positions;
}

function generateRectangleSeatPositions(
  seats: { top: number; bottom: number; left: number; right: number },
  centerX: number,
  centerY: number,
  tableWidth: number,
  tableHeight: number,
  seatRadius: number
): SeatPosition[] {
  const positions: SeatPosition[] = [];
  const { top, bottom, left, right } = seats;
  let index = 0;

  // Top seats (left to right)
  if (top > 0) {
    const spacing = tableWidth / (top + 1);
    for (let i = 0; i < top; i++) {
      positions.push({
        x: centerX - tableWidth / 2 + spacing * (i + 1),
        y: centerY - tableHeight / 2 - seatRadius - 15,
        index: index++,
      });
    }
  }

  // Right seats (top to bottom)
  if (right > 0) {
    const spacing = tableHeight / (right + 1);
    for (let i = 0; i < right; i++) {
      positions.push({
        x: centerX + tableWidth / 2 + seatRadius + 15,
        y: centerY - tableHeight / 2 + spacing * (i + 1),
        index: index++,
      });
    }
  }

  // Bottom seats (right to left)
  if (bottom > 0) {
    const spacing = tableWidth / (bottom + 1);
    for (let i = 0; i < bottom; i++) {
      positions.push({
        x: centerX + tableWidth / 2 - spacing * (i + 1),
        y: centerY + tableHeight / 2 + seatRadius + 15,
        index: index++,
      });
    }
  }

  // Left seats (bottom to top)
  if (left > 0) {
    const spacing = tableHeight / (left + 1);
    for (let i = 0; i < left; i++) {
      positions.push({
        x: centerX - tableWidth / 2 - seatRadius - 15,
        y: centerY + tableHeight / 2 - spacing * (i + 1),
        index: index++,
      });
    }
  }

  return positions;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ManualSeatOrderEditor({
  tableType,
  totalSeats,
  roundSeats = 8,
  rectangleSeats = { top: 2, bottom: 2, left: 1, right: 1 },
  currentOrdering,
  seatModes = [],
  onOrderingChange,
  onComplete,
  size = 'medium',
  showLabels = true,
  colorScheme: propColorScheme,
}: ManualSeatOrderEditorProps) {
  // Color scheme
  const storeColorScheme = useColorScheme();
  const colorScheme = propColorScheme || storeColorScheme;

  // State for manual ordering
  const [assignedSeats, setAssignedSeats] = useState<Map<number, number>>(new Map());
  const [nextSeatNumber, setNextSeatNumber] = useState(1);
  const [history, setHistory] = useState<Map<number, number>[]>([]);

  // Size configurations
  const sizeConfig = {
    small: { container: 200, table: 50, seat: 12, font: 10, tableW: 100, tableH: 60 },
    medium: { container: 320, table: 80, seat: 18, font: 12, tableW: 160, tableH: 100 },
    large: { container: 450, table: 110, seat: 24, font: 14, tableW: 220, tableH: 140 },
  };
  const config = sizeConfig[size];

  const centerX = config.container / 2;
  const centerY = config.container / 2;
  const seatDistance = config.table + config.seat + 15;

  // Calculate effective total seats
  const effectiveTotalSeats = useMemo(() => {
    if (tableType === 'round') return roundSeats;
    return rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
  }, [tableType, roundSeats, rectangleSeats]);

  // Generate seat positions
  const seatPositions = useMemo(() => {
    if (tableType === 'round') {
      return generateRoundSeatPositions(roundSeats, centerX, centerY, seatDistance);
    }
    return generateRectangleSeatPositions(
      rectangleSeats,
      centerX,
      centerY,
      config.tableW,
      config.tableH,
      config.seat
    );
  }, [tableType, roundSeats, rectangleSeats, centerX, centerY, seatDistance, config]);

  // Initialize from current ordering when it changes externally
  useEffect(() => {
    if (currentOrdering.length === effectiveTotalSeats) {
      // Build map from position → seat number
      const newMap = new Map<number, number>();
      currentOrdering.forEach((seatNum, posIndex) => {
        newMap.set(posIndex, seatNum);
      });
      setAssignedSeats(newMap);
      setNextSeatNumber(effectiveTotalSeats + 1);
      setHistory([]);
    }
  }, [currentOrdering, effectiveTotalSeats]);

  // Check if ordering is complete
  const isComplete = useMemo(() => {
    return assignedSeats.size === effectiveTotalSeats;
  }, [assignedSeats, effectiveTotalSeats]);

  // Get current ordering array from map
  const getCurrentOrdering = useCallback((): number[] => {
    const ordering = new Array(effectiveTotalSeats).fill(0);
    assignedSeats.forEach((seatNum, posIndex) => {
      ordering[posIndex] = seatNum;
    });
    return ordering;
  }, [assignedSeats, effectiveTotalSeats]);

  // Handlers
  const handleSeatClick = useCallback((positionIndex: number) => {
    if (assignedSeats.has(positionIndex)) {
      // Already assigned - do nothing (or could toggle off)
      return;
    }

    // Save history for undo
    setHistory(prev => [...prev, new Map(assignedSeats)]);

    // Assign the next seat number to this position
    const newMap = new Map(assignedSeats);
    newMap.set(positionIndex, nextSeatNumber);
    setAssignedSeats(newMap);
    setNextSeatNumber(prev => prev + 1);

    // Update parent with current ordering
    const newOrdering = new Array(effectiveTotalSeats).fill(0);
    newMap.forEach((seatNum, posIndex) => {
      newOrdering[posIndex] = seatNum;
    });
    onOrderingChange(newOrdering);
  }, [assignedSeats, nextSeatNumber, effectiveTotalSeats, onOrderingChange]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const prevState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setAssignedSeats(prevState);
    setNextSeatNumber(prev => Math.max(1, prev - 1));

    // Update parent
    const newOrdering = new Array(effectiveTotalSeats).fill(0);
    prevState.forEach((seatNum, posIndex) => {
      newOrdering[posIndex] = seatNum;
    });
    onOrderingChange(newOrdering);
  }, [history, effectiveTotalSeats, onOrderingChange]);

  const handleReset = useCallback(() => {
    setHistory([]);
    setAssignedSeats(new Map());
    setNextSeatNumber(1);
    onOrderingChange(new Array(effectiveTotalSeats).fill(0));
  }, [effectiveTotalSeats, onOrderingChange]);

  const handleComplete = useCallback(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  // Get mode colors
  const getModeColors = (mode: SeatMode) => {
    switch (mode) {
      case 'host-only':
        return { fill: colorScheme.seats.hostOnlyFill, stroke: colorScheme.seats.hostOnlyStroke };
      case 'external-only':
        return { fill: colorScheme.seats.externalOnlyFill, stroke: colorScheme.seats.externalOnlyStroke };
      default:
        return { fill: colorScheme.seats.defaultFill, stroke: colorScheme.seats.defaultStroke };
    }
  };

  return (
    <Stack spacing={2}>
      {/* Instructions */}
      <Alert severity="info" icon={<TouchApp />}>
        <Typography variant="body2">
          <strong>Manual Ordering Mode:</strong> Click seats in the order you want them numbered.
          Seat #{nextSeatNumber > effectiveTotalSeats ? 'Complete!' : nextSeatNumber} is next.
        </Typography>
      </Alert>

      {/* Progress and Controls */}
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`${assignedSeats.size} / ${effectiveTotalSeats} assigned`}
            color={isComplete ? 'success' : 'default'}
            size="small"
          />
          {isComplete && (
            <Chip
              icon={<Check />}
              label="Complete!"
              color="success"
              size="small"
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Undo last assignment">
            <span>
              <IconButton
                size="small"
                onClick={handleUndo}
                disabled={history.length === 0}
              >
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={handleReset}
            variant="outlined"
          >
            Reset
          </Button>
        </Stack>
      </Stack>

      {/* Interactive Table */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#fafafa',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <svg
          width={config.container}
          height={config.container}
          viewBox={`0 0 ${config.container} ${config.container}`}
        >
          {/* Table Shape */}
          {tableType === 'round' ? (
            <circle
              cx={centerX}
              cy={centerY}
              r={config.table}
              fill="#e8e8e8"
              stroke="#bdbdbd"
              strokeWidth={2}
            />
          ) : (
            <rect
              x={centerX - config.tableW / 2}
              y={centerY - config.tableH / 2}
              width={config.tableW}
              height={config.tableH}
              rx={8}
              ry={8}
              fill="#e8e8e8"
              stroke="#bdbdbd"
              strokeWidth={2}
            />
          )}

          {/* Seats */}
          {seatPositions.map((pos) => {
            const isAssigned = assignedSeats.has(pos.index);
            const seatNumber = assignedSeats.get(pos.index);
            const mode = seatModes[pos.index] || 'default';
            const modeColors = getModeColors(mode);
            
            // Determine colors based on assignment state
            const fillColor = isAssigned 
              ? colorScheme.ui.success + '40' // Semi-transparent green
              : modeColors.fill;
            const strokeColor = isAssigned 
              ? colorScheme.ui.success 
              : modeColors.stroke;
            const strokeWidth = isAssigned ? 3 : 2;

            return (
              <g
                key={pos.index}
                onClick={() => handleSeatClick(pos.index)}
                style={{ cursor: isAssigned ? 'default' : 'pointer' }}
              >
                {/* Hover indicator for unassigned */}
                {!isAssigned && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={config.seat + 4}
                    fill="none"
                    stroke={colorScheme.ui.primary}
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    opacity={0.5}
                    className="hover-ring"
                  />
                )}
                
                {/* Seat circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={config.seat}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
                
                {/* Seat number or position indicator */}
                {showLabels && (
                  <text
                    x={pos.x}
                    y={pos.y + config.font / 3}
                    textAnchor="middle"
                    fontSize={config.font}
                    fontWeight={isAssigned ? 'bold' : 'normal'}
                    fill={isAssigned ? colorScheme.ui.success : '#666'}
                  >
                    {isAssigned ? seatNumber : `P${pos.index + 1}`}
                  </text>
                )}

                {/* Assignment order indicator */}
                {isAssigned && (
                  <circle
                    cx={pos.x + config.seat - 4}
                    cy={pos.y - config.seat + 4}
                    r={8}
                    fill={colorScheme.ui.success}
                    stroke="white"
                    strokeWidth={1}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </Paper>

      {/* Legend */}
      <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#e8f5e9' }}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: colorScheme.ui.success + '40',
                border: `2px solid ${colorScheme.ui.success}`,
              }}
            />
            <Typography variant="caption">Assigned</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: colorScheme.seats.defaultFill,
                border: `2px dashed ${colorScheme.ui.primary}`,
              }}
            />
            <Typography variant="caption">Click to assign next</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            P1, P2... = Physical position (before numbering)
          </Typography>
        </Stack>
      </Paper>

      {/* Current Sequence Preview */}
      {assignedSeats.size > 0 && (
        <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Current Sequence:</strong>{' '}
            {getCurrentOrdering()
              .map((num, idx) => (num > 0 ? num : '?'))
              .join(' → ')}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}

// ============================================================================
// COMPACT VERSION FOR INLINE USE
// ============================================================================

interface CompactManualOrderButtonProps {
  isManualMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function ManualOrderToggle({
  isManualMode,
  onToggle,
  disabled = false,
}: CompactManualOrderButtonProps) {
  return (
    <Button
      variant={isManualMode ? 'contained' : 'outlined'}
      size="small"
      startIcon={<TouchApp />}
      onClick={onToggle}
      disabled={disabled}
      color={isManualMode ? 'primary' : 'inherit'}
    >
      {isManualMode ? 'Manual Mode ON' : 'Manual Order'}
    </Button>
  );
}