// components/atom.tsx
// Reusable SVG table preview component for both round and rectangle tables
// Used in AddTableModal, ModifyTableModal, TemplateCard, and CreateEditTemplateModal

'use client';

import { useMemo } from 'react';
import { Box, Chip } from '@mui/material';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface SeatPosition {
  x: number;
  y: number;
  index: number;
}

export type InteractionMode = 'none' | 'ordering' | 'modes';

// ============================================================================
// ROUND TABLE PREVIEW
// ============================================================================

interface RoundTablePreviewProps {
  seatCount: number;
  seatOrdering: number[];
  seatModes: SeatMode[];
  startPosition?: number;
  onSeatClick?: (event: React.MouseEvent, index: number) => void;
  interactionMode?: InteractionMode;
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
  highlightPosition?: number | null;
}

export function RoundTablePreview({
  seatCount,
  seatOrdering,
  seatModes,
  startPosition = 0,
  onSeatClick,
  interactionMode = 'none',
  size = 'medium',
  showLabels = true,
  highlightPosition = null,
}: RoundTablePreviewProps) {
  // Size configurations
  const sizeConfig = {
    small: { container: 120, table: 35, seat: 8, font: 8 },
    medium: { container: 280, table: 70, seat: 18, font: 12 },
    large: { container: 400, table: 100, seat: 24, font: 14 },
  };

  const config = sizeConfig[size];
  const centerX = config.container / 2;
  const centerY = config.container / 2;
  const seatDistance = config.table + config.seat + 10;

  // Generate seat positions
  const seatPositions = useMemo(() => {
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
  }, [seatCount, centerX, centerY, seatDistance]);

  const handleSeatClick = (event: React.MouseEvent, index: number) => {
    if (onSeatClick && interactionMode !== 'none') {
      onSeatClick(event, index);
    }
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={config.container}
        height={config.container}
        viewBox={`0 0 ${config.container} ${config.container}`}
      >
        {/* Table Circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={config.table}
          fill="#e0e0e0"
          stroke="#9e9e9e"
          strokeWidth={2}
        />

        {/* Seats */}
        {seatPositions.map((pos) => {
          const seatNumber = seatOrdering[pos.index] || pos.index + 1;
          const mode = seatModes[pos.index] || 'default';
          const modeConfig = SEAT_MODE_CONFIGS[mode];
          const isStart = pos.index === startPosition;
          const isHighlighted = highlightPosition === pos.index;

          const fillColor = modeConfig.color;
          const strokeColor = isStart ? '#4caf50' : isHighlighted ? '#ff9800' : modeConfig.strokeColor;
          const strokeWidth = isStart || isHighlighted ? 3 : 2;
          const strokeDasharray = mode === 'external-only' ? '3,2' : 'none';

          return (
            <g
              key={pos.index}
              onClick={(e) => handleSeatClick(e, pos.index)}
              style={{ cursor: interactionMode !== 'none' ? 'pointer' : 'default' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={config.seat}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
              />
              {showLabels && (
                <text
                  x={pos.x}
                  y={pos.y + config.font / 3}
                  textAnchor="middle"
                  fontSize={config.font}
                  fill={isStart ? 'white' : '#0d47a1'}
                  fontWeight={isStart ? 'bold' : 'normal'}
                >
                  {seatNumber}
                </text>
              )}
              {/* Mode indicator for small views */}
              {size === 'small' && mode !== 'default' && modeConfig.shortLabel && (
                <text
                  x={pos.x}
                  y={pos.y + config.seat + 8}
                  textAnchor="middle"
                  fontSize={6}
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

      {/* Start position indicator */}
      {interactionMode === 'ordering' && (
        <Chip
          label={`Seat #1 at Position ${startPosition + 1}`}
          color="success"
          size="small"
          sx={{ position: 'absolute', top: 4, left: 4, fontSize: size === 'small' ? 8 : 12 }}
        />
      )}
    </Box>
  );
}

// ============================================================================
// RECTANGLE TABLE PREVIEW
// ============================================================================

interface RectangleTablePreviewProps {
  seats: { top: number; bottom: number; left: number; right: number };
  seatOrdering: number[];
  seatModes: SeatMode[];
  startPosition?: number;
  onSeatClick?: (event: React.MouseEvent, index: number) => void;
  interactionMode?: InteractionMode;
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
  highlightPosition?: number | null;
  growthSides?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
}

export function RectangleTablePreview({
  seats,
  seatOrdering,
  seatModes,
  startPosition = 0,
  onSeatClick,
  interactionMode = 'none',
  size = 'medium',
  showLabels = true,
  highlightPosition = null,
  growthSides,
}: RectangleTablePreviewProps) {
  // Size configurations
  const sizeConfig = {
    small: { width: 150, height: 100, seat: 8, font: 7, tablePadding: 20 },
    medium: { width: 400, height: 280, seat: 18, font: 12, tablePadding: 40 },
    large: { width: 500, height: 350, seat: 24, font: 14, tablePadding: 50 },
  };

  const config = sizeConfig[size];
  const { top, bottom, left, right } = seats;
  const totalSeats = top + bottom + left + right;

  // Calculate table dimensions
  const horizontalSeats = Math.max(top, bottom);
  const verticalSeats = Math.max(left, right);
  
  const tableWidth = Math.max(config.width * 0.5, horizontalSeats * (config.seat * 2.5));
  const tableHeight = Math.max(config.height * 0.4, verticalSeats * (config.seat * 2.5));
  
  const centerX = config.width / 2;
  const centerY = config.height / 2;

  // Generate seat positions
  const seatPositions = useMemo(() => {
    const positions: SeatPosition[] = [];
    let index = 0;
    const seatOffset = config.seat + 8;

    // Top seats (left to right)
    if (top > 0) {
      const spacing = tableWidth / (top + 1);
      for (let i = 0; i < top; i++) {
        positions.push({
          x: centerX - tableWidth / 2 + spacing * (i + 1),
          y: centerY - tableHeight / 2 - seatOffset,
          index: index++,
        });
      }
    }

    // Right seats (top to bottom)
    if (right > 0) {
      const spacing = tableHeight / (right + 1);
      for (let i = 0; i < right; i++) {
        positions.push({
          x: centerX + tableWidth / 2 + seatOffset,
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
          y: centerY + tableHeight / 2 + seatOffset,
          index: index++,
        });
      }
    }

    // Left seats (bottom to top)
    if (left > 0) {
      const spacing = tableHeight / (left + 1);
      for (let i = 0; i < left; i++) {
        positions.push({
          x: centerX - tableWidth / 2 - seatOffset,
          y: centerY + tableHeight / 2 - spacing * (i + 1),
          index: index++,
        });
      }
    }

    return positions;
  }, [top, bottom, left, right, centerX, centerY, tableWidth, tableHeight, config.seat]);

  const handleSeatClick = (event: React.MouseEvent, index: number) => {
    if (onSeatClick && interactionMode !== 'none') {
      onSeatClick(event, index);
    }
  };

  // Determine which sides show growth indicators
  const showGrowthIndicators = growthSides && size !== 'small';

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
      >
        {/* Table Rectangle */}
        <rect
          x={centerX - tableWidth / 2}
          y={centerY - tableHeight / 2}
          width={tableWidth}
          height={tableHeight}
          rx={8}
          ry={8}
          fill="#e0e0e0"
          stroke="#9e9e9e"
          strokeWidth={2}
        />

        {/* Growth indicators */}
        {showGrowthIndicators && (
          <>
            {growthSides.top && (
              <text
                x={centerX}
                y={centerY - tableHeight / 2 - config.seat - 20}
                textAnchor="middle"
                fontSize={10}
                fill="#4caf50"
              >
                ↕ grows
              </text>
            )}
            {growthSides.bottom && (
              <text
                x={centerX}
                y={centerY + tableHeight / 2 + config.seat + 28}
                textAnchor="middle"
                fontSize={10}
                fill="#4caf50"
              >
                ↕ grows
              </text>
            )}
            {growthSides.left && (
              <text
                x={centerX - tableWidth / 2 - config.seat - 20}
                y={centerY}
                textAnchor="middle"
                fontSize={10}
                fill="#4caf50"
                transform={`rotate(-90, ${centerX - tableWidth / 2 - config.seat - 20}, ${centerY})`}
              >
                ↕ grows
              </text>
            )}
            {growthSides.right && (
              <text
                x={centerX + tableWidth / 2 + config.seat + 20}
                y={centerY}
                textAnchor="middle"
                fontSize={10}
                fill="#4caf50"
                transform={`rotate(90, ${centerX + tableWidth / 2 + config.seat + 20}, ${centerY})`}
              >
                ↕ grows
              </text>
            )}
          </>
        )}

        {/* Seats */}
        {seatPositions.map((pos) => {
          const seatNumber = seatOrdering[pos.index] || pos.index + 1;
          const mode = seatModes[pos.index] || 'default';
          const modeConfig = SEAT_MODE_CONFIGS[mode];
          const isStart = pos.index === startPosition;
          const isHighlighted = highlightPosition === pos.index;

          const fillColor = modeConfig.color;
          const strokeColor = isStart ? '#4caf50' : isHighlighted ? '#ff9800' : modeConfig.strokeColor;
          const strokeWidth = isStart || isHighlighted ? 3 : 2;
          const strokeDasharray = mode === 'external-only' ? '3,2' : 'none';

          return (
            <g
              key={pos.index}
              onClick={(e) => handleSeatClick(e, pos.index)}
              style={{ cursor: interactionMode !== 'none' ? 'pointer' : 'default' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={config.seat}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
              />
              {showLabels && (
                <text
                  x={pos.x}
                  y={pos.y + config.font / 3}
                  textAnchor="middle"
                  fontSize={config.font}
                  fill={isStart ? 'white' : '#0d47a1'}
                  fontWeight={isStart ? 'bold' : 'normal'}
                >
                  {seatNumber}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Start position indicator */}
      {interactionMode === 'ordering' && totalSeats > 0 && (
        <Chip
          label={`Seat #1 at Position ${startPosition + 1}`}
          color="success"
          size="small"
          sx={{ position: 'absolute', top: 4, left: 4, fontSize: size === 'small' ? 8 : 12 }}
        />
      )}
    </Box>
  );
}

// ============================================================================
// UNIFIED TABLE PREVIEW (Auto-selects based on type)
// ============================================================================

interface TablePreviewProps {
  type: 'round' | 'rectangle';
  // For round
  roundSeats?: number;
  // For rectangle
  rectangleSeats?: { top: number; bottom: number; left: number; right: number };
  growthSides?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  // Common props
  seatOrdering: number[];
  seatModes: SeatMode[];
  startPosition?: number;
  onSeatClick?: (event: React.MouseEvent, index: number) => void;
  interactionMode?: InteractionMode;
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
  highlightPosition?: number | null;
}

export default function TablePreview({
  type,
  roundSeats = 8,
  rectangleSeats = { top: 2, bottom: 2, left: 1, right: 1 },
  growthSides,
  seatOrdering,
  seatModes,
  startPosition = 0,
  onSeatClick,
  interactionMode = 'none',
  size = 'medium',
  showLabels = true,
  highlightPosition = null,
}: TablePreviewProps) {
  if (type === 'round') {
    return (
      <RoundTablePreview
        seatCount={roundSeats}
        seatOrdering={seatOrdering}
        seatModes={seatModes}
        startPosition={startPosition}
        onSeatClick={onSeatClick}
        interactionMode={interactionMode}
        size={size}
        showLabels={showLabels}
        highlightPosition={highlightPosition}
      />
    );
  }

  return (
    <RectangleTablePreview
      seats={rectangleSeats}
      seatOrdering={seatOrdering}
      seatModes={seatModes}
      startPosition={startPosition}
      onSeatClick={onSeatClick}
      interactionMode={interactionMode}
      size={size}
      showLabels={showLabels}
      highlightPosition={highlightPosition}
      growthSides={growthSides}
    />
  );
}