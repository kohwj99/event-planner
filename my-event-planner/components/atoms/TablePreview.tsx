// components/atoms/TablePreview.tsx
// Reusable SVG table preview component for both round and rectangle tables
// Used in AddTableModal, ModifyTableModal, TemplateCard, CreateEditTemplateModal
// Uses centralized color configuration from colorConfig.ts
// 
// FEATURES:
// - Dynamic sizing based on seat count - large tables render at full size
// - Supports multiple interaction modes: none, ordering, modes, manual-ordering
// - Manual ordering shows click-to-assign with position labels and checkmarks

'use client';

import { useMemo } from 'react';
import { Box, Chip } from '@mui/material';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';
import { useColorScheme } from '@/store/colorModeStore';
import { ColorScheme } from '@/utils/colorConfig';

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface SeatPosition {
  x: number;
  y: number;
  index: number;
}

export type InteractionMode = 'none' | 'ordering' | 'modes' | 'manual-ordering';

// ============================================================================
// HELPER FUNCTION TO GET SEAT COLORS
// ============================================================================

function getSeatColorsFromScheme(
  mode: SeatMode,
  colorScheme: ColorScheme
): { fill: string; stroke: string } {
  switch (mode) {
    case 'host-only':
      return {
        fill: colorScheme.seats.hostOnlyFill,
        stroke: colorScheme.seats.hostOnlyStroke,
      };
    case 'external-only':
      return {
        fill: colorScheme.seats.externalOnlyFill,
        stroke: colorScheme.seats.externalOnlyStroke,
      };
    default:
      return {
        fill: colorScheme.seats.defaultFill,
        stroke: colorScheme.seats.defaultStroke,
      };
  }
}

function getModeStrokeWidth(mode: SeatMode): number {
  switch (mode) {
    case 'host-only':
      return 3.5;
    case 'external-only':
      return 2.5;
    default:
      return 2;
  }
}

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
  colorScheme?: ColorScheme;
  manualAssignments?: Map<number, number>;
  nextManualNumber?: number;
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
  colorScheme: propColorScheme,
  manualAssignments,
  nextManualNumber,
}: RoundTablePreviewProps) {
  const storeColorScheme = useColorScheme();
  const colorScheme = propColorScheme || storeColorScheme;

  // Dynamic size calculation based on seat count
  const config = useMemo(() => {
    const baseConfig = {
      small: { tableRadius: 35, seatRadius: 8, font: 8, minSpacing: 20 },
      medium: { tableRadius: 70, seatRadius: 18, font: 12, minSpacing: 45 },
      large: { tableRadius: 100, seatRadius: 24, font: 14, minSpacing: 60 },
    };
    
    const base = baseConfig[size];
    const minCircumference = seatCount * base.minSpacing;
    const minRadius = minCircumference / (2 * Math.PI);
    const seatDistance = Math.max(base.tableRadius + base.seatRadius + 10, minRadius);
    const containerSize = (seatDistance + base.seatRadius) * 2 + 40;
    
    return {
      container: Math.max(containerSize, size === 'small' ? 120 : size === 'medium' ? 280 : 400),
      tableRadius: base.tableRadius,
      seatRadius: base.seatRadius,
      font: base.font,
      seatDistance,
    };
  }, [seatCount, size]);

  const centerX = config.container / 2;
  const centerY = config.container / 2;

  const seatPositions = useMemo(() => {
    const positions: SeatPosition[] = [];
    for (let i = 0; i < seatCount; i++) {
      const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2;
      positions.push({
        x: centerX + Math.cos(angle) * config.seatDistance,
        y: centerY + Math.sin(angle) * config.seatDistance,
        index: i,
      });
    }
    return positions;
  }, [seatCount, centerX, centerY, config.seatDistance]);

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
        style={{ display: 'block' }}
      >
        <circle
          cx={centerX}
          cy={centerY}
          r={config.tableRadius}
          fill="#e8e8e8"
          stroke="#bdbdbd"
          strokeWidth={2}
        />

        {seatPositions.map((pos) => {
          const seatNumber = seatOrdering[pos.index] || pos.index + 1;
          const mode = seatModes[pos.index] || 'default';
          const seatColors = getSeatColorsFromScheme(mode, colorScheme);
          
          const isManualMode = interactionMode === 'manual-ordering';
          const manualSeatNum = manualAssignments?.get(pos.index);
          const isManualAssigned = isManualMode && manualSeatNum !== undefined;
          const isNextToAssign = isManualMode && !isManualAssigned && nextManualNumber !== undefined;
          
          const isStart = interactionMode === 'ordering' && pos.index === startPosition;
          const isHighlighted = highlightPosition === pos.index;

          let fillColor = seatColors.fill;
          if (isManualAssigned) {
            fillColor = 'rgba(76, 175, 80, 0.3)';
          }
          
          let strokeColor = seatColors.stroke;
          if (isStart) {
            strokeColor = colorScheme.ui.success;
          } else if (isHighlighted) {
            strokeColor = colorScheme.seats.selectedStroke;
          } else if (isManualAssigned) {
            strokeColor = '#4caf50';
          }
              
          const modeStrokeWidth = getModeStrokeWidth(mode);
          const strokeWidth = isStart || isHighlighted || isManualAssigned ? Math.max(modeStrokeWidth, 3) : modeStrokeWidth;
          const strokeDasharray = mode === 'external-only' ? '4,2' : 'none';

          let displayText = String(seatNumber);
          if (isManualMode) {
            displayText = isManualAssigned ? String(manualSeatNum) : `P${pos.index + 1}`;
          }

          return (
            <g
              key={pos.index}
              onClick={(e) => handleSeatClick(e, pos.index)}
              style={{ cursor: interactionMode !== 'none' ? 'pointer' : 'default' }}
            >
              {isStart && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={config.seatRadius + 4}
                  fill="none"
                  stroke={colorScheme.ui.success}
                  strokeWidth={2}
                />
              )}
              {isNextToAssign && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={config.seatRadius + 4}
                  fill="none"
                  stroke="#ff9800"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={config.seatRadius}
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
                  fontSize={isManualMode && !isManualAssigned ? config.font * 0.8 : config.font}
                  fill={isManualAssigned ? '#2e7d32' : colorScheme.table.tableStroke}
                  fontWeight={isStart || isManualAssigned ? 'bold' : 'normal'}
                >
                  {displayText}
                </text>
              )}
              {isManualAssigned && (
                <text
                  x={pos.x + config.seatRadius * 0.6}
                  y={pos.y - config.seatRadius * 0.5}
                  fontSize={config.font * 0.7}
                  fill="#2e7d32"
                >
                  ✓
                </text>
              )}
              {size === 'small' && mode !== 'default' && !isManualMode && (
                <text
                  x={pos.x}
                  y={pos.y + config.seatRadius + 8}
                  textAnchor="middle"
                  fontSize={6}
                  fill={seatColors.stroke}
                  fontWeight="bold"
                >
                  {mode === 'host-only' ? 'H' : 'E'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

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
  colorScheme?: ColorScheme;
  manualAssignments?: Map<number, number>;
  nextManualNumber?: number;
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
  colorScheme: propColorScheme,
  manualAssignments,
  nextManualNumber,
}: RectangleTablePreviewProps) {
  const storeColorScheme = useColorScheme();
  const colorScheme = propColorScheme || storeColorScheme;

  const { top, bottom, left, right } = seats;
  const totalSeats = top + bottom + left + right;

  // Dynamic size calculation based on seat count per side
  const config = useMemo(() => {
    const baseConfig = {
      small: { seatRadius: 8, font: 7, minSpacing: 22, padding: 30 },
      medium: { seatRadius: 16, font: 11, minSpacing: 45, padding: 50 },
      large: { seatRadius: 22, font: 14, minSpacing: 60, padding: 70 },
    };
    
    const base = baseConfig[size];
    const maxHorizontalSeats = Math.max(top, bottom, 1);
    const minTableWidth = maxHorizontalSeats * base.minSpacing + base.minSpacing;
    const maxVerticalSeats = Math.max(left, right, 1);
    const minTableHeight = maxVerticalSeats * base.minSpacing + base.minSpacing * 0.5;
    const seatOffset = base.seatRadius * 2;
    
    const width = minTableWidth + seatOffset * 2 + base.padding * 2;
    const height = minTableHeight + seatOffset * 2 + base.padding * 2;
    
    const minDims = {
      small: { width: 150, height: 100 },
      medium: { width: 350, height: 220 },
      large: { width: 450, height: 300 },
    };
    
    return {
      width: Math.max(width, minDims[size].width),
      height: Math.max(height, minDims[size].height),
      seatRadius: base.seatRadius,
      font: base.font,
      tableWidth: minTableWidth,
      tableHeight: minTableHeight,
    };
  }, [top, bottom, left, right, size]);

  const centerX = config.width / 2;
  const centerY = config.height / 2;
  const tableWidth = config.tableWidth;
  const tableHeight = config.tableHeight;

  const seatPositions = useMemo(() => {
    const positions: SeatPosition[] = [];
    const seatOffset = config.seatRadius * 1.8;
    let index = 0;

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
  }, [top, bottom, left, right, centerX, centerY, tableWidth, tableHeight, config.seatRadius]);

  const handleSeatClick = (event: React.MouseEvent, index: number) => {
    if (onSeatClick && interactionMode !== 'none') {
      onSeatClick(event, index);
    }
  };

  const showGrowthIndicators = growthSides && size !== 'small';

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
        style={{ display: 'block' }}
      >
        <rect
          x={centerX - tableWidth / 2}
          y={centerY - tableHeight / 2}
          width={tableWidth}
          height={tableHeight}
          rx={8}
          ry={8}
          fill="#e8e8e8"
          stroke="#bdbdbd"
          strokeWidth={2}
        />

        {showGrowthIndicators && (
          <>
            {growthSides.top && (
              <text x={centerX} y={centerY - tableHeight / 2 - config.seatRadius - 20} textAnchor="middle" fontSize={10} fill={colorScheme.ui.success}>↕ grows</text>
            )}
            {growthSides.bottom && (
              <text x={centerX} y={centerY + tableHeight / 2 + config.seatRadius + 28} textAnchor="middle" fontSize={10} fill={colorScheme.ui.success}>↕ grows</text>
            )}
            {growthSides.left && (
              <text x={centerX - tableWidth / 2 - config.seatRadius - 20} y={centerY} textAnchor="middle" fontSize={10} fill={colorScheme.ui.success} transform={`rotate(-90, ${centerX - tableWidth / 2 - config.seatRadius - 20}, ${centerY})`}>↕ grows</text>
            )}
            {growthSides.right && (
              <text x={centerX + tableWidth / 2 + config.seatRadius + 20} y={centerY} textAnchor="middle" fontSize={10} fill={colorScheme.ui.success} transform={`rotate(90, ${centerX + tableWidth / 2 + config.seatRadius + 20}, ${centerY})`}>↕ grows</text>
            )}
          </>
        )}

        {seatPositions.map((pos) => {
          const seatNumber = seatOrdering[pos.index] || pos.index + 1;
          const mode = seatModes[pos.index] || 'default';
          const seatColors = getSeatColorsFromScheme(mode, colorScheme);
          
          const isManualMode = interactionMode === 'manual-ordering';
          const manualSeatNum = manualAssignments?.get(pos.index);
          const isManualAssigned = isManualMode && manualSeatNum !== undefined;
          const isNextToAssign = isManualMode && !isManualAssigned && nextManualNumber !== undefined;
          
          const isStart = interactionMode === 'ordering' && pos.index === startPosition;
          const isHighlighted = highlightPosition === pos.index;

          let fillColor = seatColors.fill;
          if (isManualAssigned) fillColor = 'rgba(76, 175, 80, 0.3)';
          
          let strokeColor = seatColors.stroke;
          if (isStart) strokeColor = colorScheme.ui.success;
          else if (isHighlighted) strokeColor = colorScheme.seats.selectedStroke;
          else if (isManualAssigned) strokeColor = '#4caf50';
              
          const modeStrokeWidth = getModeStrokeWidth(mode);
          const strokeWidth = isStart || isHighlighted || isManualAssigned ? Math.max(modeStrokeWidth, 3) : modeStrokeWidth;
          const strokeDasharray = mode === 'external-only' ? '4,2' : 'none';

          let displayText = String(seatNumber);
          if (isManualMode) displayText = isManualAssigned ? String(manualSeatNum) : `P${pos.index + 1}`;

          return (
            <g key={pos.index} onClick={(e) => handleSeatClick(e, pos.index)} style={{ cursor: interactionMode !== 'none' ? 'pointer' : 'default' }}>
              {isStart && <circle cx={pos.x} cy={pos.y} r={config.seatRadius + 4} fill="none" stroke={colorScheme.ui.success} strokeWidth={2} />}
              {isNextToAssign && <circle cx={pos.x} cy={pos.y} r={config.seatRadius + 4} fill="none" stroke="#ff9800" strokeWidth={2} strokeDasharray="4,4" />}
              <circle cx={pos.x} cy={pos.y} r={config.seatRadius} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} />
              {showLabels && (
                <text x={pos.x} y={pos.y + config.font / 3} textAnchor="middle" fontSize={isManualMode && !isManualAssigned ? config.font * 0.8 : config.font} fill={isManualAssigned ? '#2e7d32' : colorScheme.table.tableStroke} fontWeight={isStart || isManualAssigned ? 'bold' : 'normal'}>
                  {displayText}
                </text>
              )}
              {isManualAssigned && <text x={pos.x + config.seatRadius * 0.6} y={pos.y - config.seatRadius * 0.5} fontSize={config.font * 0.7} fill="#2e7d32">✓</text>}
            </g>
          );
        })}
      </svg>

      {interactionMode === 'ordering' && totalSeats > 0 && (
        <Chip label={`Seat #1 at Position ${startPosition + 1}`} color="success" size="small" sx={{ position: 'absolute', top: 4, left: 4, fontSize: size === 'small' ? 8 : 12 }} />
      )}
    </Box>
  );
}

// ============================================================================
// UNIFIED TABLE PREVIEW
// ============================================================================

interface TablePreviewProps {
  type: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: { top: number; bottom: number; left: number; right: number };
  growthSides?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  seatOrdering: number[];
  seatModes: SeatMode[];
  startPosition?: number;
  onSeatClick?: (event: React.MouseEvent, index: number) => void;
  interactionMode?: InteractionMode;
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
  highlightPosition?: number | null;
  colorScheme?: ColorScheme;
  manualAssignments?: Map<number, number>;
  nextManualNumber?: number;
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
  colorScheme,
  manualAssignments,
  nextManualNumber,
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
        colorScheme={colorScheme}
        manualAssignments={manualAssignments}
        nextManualNumber={nextManualNumber}
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
      colorScheme={colorScheme}
      manualAssignments={manualAssignments}
      nextManualNumber={nextManualNumber}
    />
  );
}