// utils/generateTableV2.ts
// V2 Table Generation - COMPLETELY INDEPENDENT from V1
// Creates Table objects from V2 template configurations

import { v4 as uuidv4 } from 'uuid';
import {
  TableConfigV2,
  CircleTableConfigV2,
  RectangleTableConfigV2,
  ScaledResultV2,
  ScaledCircleResultV2,
  ScaledRectangleResultV2,
  SeatMode,
  SideKeyV2,
  isCircleConfigV2,
  isCircleResultV2,
  isRectangleResultV2,
  getTotalSeatCountV2,
  TableTemplateV2,
} from '@/types/TemplateV2';
import { scaleTemplateV2, scaleConfigV2 } from '@/utils/templateScalerV2';

// ============================================================================
// V2 OUTPUT TYPES (for Table generation)
// These mirror your existing Table/Seat types but are defined here for independence
// ============================================================================

export interface SeatV2 {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  seatNumber: number;
  mode: SeatMode;
  textX?: number;
  textY?: number;
  position?: number;
  locked: boolean;
  selected: boolean;
  adjacentSeats: string[];
  guestId?: string | null;
}

export interface RectangleSeatsConfigV2 {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TableV2 {
  id: string;
  x: number;
  y: number;
  radius: number;
  seats: SeatV2[];
  label: string;
  shape: 'round' | 'rectangle';
  width?: number;
  height?: number;
  rectangleSeats?: RectangleSeatsConfigV2;
  templateId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SEAT_RADIUS = 20;
const DEFAULT_TABLE_RADIUS = 80;
const DEFAULT_RECT_WIDTH = 200;
const DEFAULT_RECT_HEIGHT = 120;

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

function calculateCircleSeatPositions(
  tableX: number,
  tableY: number,
  tableRadius: number,
  seatCount: number,
  seatRadius: number = DEFAULT_SEAT_RADIUS
): Array<{ x: number; y: number; textX: number; textY: number }> {
  const positions: Array<{ x: number; y: number; textX: number; textY: number }> = [];
  const distanceFromCenter = tableRadius + seatRadius + 5;
  const textDistance = distanceFromCenter + seatRadius + 15;

  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2;
    const x = tableX + Math.cos(angle) * distanceFromCenter;
    const y = tableY + Math.sin(angle) * distanceFromCenter;
    const textX = tableX + Math.cos(angle) * textDistance;
    const textY = tableY + Math.sin(angle) * textDistance;
    positions.push({ x, y, textX, textY });
  }

  return positions;
}

function calculateRectangleSeatPositions(
  tableX: number,
  tableY: number,
  tableWidth: number,
  tableHeight: number,
  sideSeats: RectangleSeatsConfigV2,
  seatRadius: number = DEFAULT_SEAT_RADIUS
): Array<{ x: number; y: number; textX: number; textY: number; side: SideKeyV2 }> {
  const positions: Array<{ x: number; y: number; textX: number; textY: number; side: SideKeyV2 }> = [];
  const halfWidth = tableWidth / 2;
  const halfHeight = tableHeight / 2;
  const seatOffset = seatRadius + 10;
  const textOffset = seatRadius + 25;

  // Position ordering matches TablePreview's clockwise convention
  // This ensures consistency between preview and generated tables

  // Top side (left to right)
  if (sideSeats.top > 0) {
    const spacing = tableWidth / (sideSeats.top + 1);
    for (let i = 0; i < sideSeats.top; i++) {
      const x = tableX - halfWidth + spacing * (i + 1);
      const y = tableY - halfHeight - seatOffset;
      positions.push({ x, y, textX: x, textY: y - textOffset + seatOffset, side: 'top' });
    }
  }

  // Right side (top to bottom)
  if (sideSeats.right > 0) {
    const spacing = tableHeight / (sideSeats.right + 1);
    for (let i = 0; i < sideSeats.right; i++) {
      const x = tableX + halfWidth + seatOffset;
      const y = tableY - halfHeight + spacing * (i + 1);
      positions.push({ x, y, textX: x + textOffset - seatOffset, textY: y, side: 'right' });
    }
  }

  // Bottom side (right to left - CLOCKWISE order to match TablePreview)
  if (sideSeats.bottom > 0) {
    const spacing = tableWidth / (sideSeats.bottom + 1);
    for (let i = 0; i < sideSeats.bottom; i++) {
      const x = tableX + halfWidth - spacing * (i + 1);
      const y = tableY + halfHeight + seatOffset;
      positions.push({ x, y, textX: x, textY: y + textOffset - seatOffset, side: 'bottom' });
    }
  }

  // Left side (bottom to top - CLOCKWISE order to match TablePreview)
  if (sideSeats.left > 0) {
    const spacing = tableHeight / (sideSeats.left + 1);
    for (let i = 0; i < sideSeats.left; i++) {
      const x = tableX - halfWidth - seatOffset;
      const y = tableY + halfHeight - spacing * (i + 1);
      positions.push({ x, y, textX: x - textOffset + seatOffset, textY: y, side: 'left' });
    }
  }

  return positions;
}

// ============================================================================
// SEAT CREATION
// ============================================================================

function createSeatV2(
  id: string,
  x: number,
  y: number,
  seatNumber: number,
  mode: SeatMode,
  textX?: number,
  textY?: number,
  position?: number,
  radius: number = DEFAULT_SEAT_RADIUS
): SeatV2 {
  return {
    id,
    x,
    y,
    radius,
    label: '',
    seatNumber,
    mode,
    textX,
    textY,
    position,
    locked: false,
    selected: false,
    adjacentSeats: [],
  };
}

// ============================================================================
// TABLE CREATION FROM SCALED RESULT
// ============================================================================

export function createRoundTableFromResultV2(
  result: ScaledCircleResultV2,
  tableId: string,
  x: number,
  y: number,
  label: string,
  tableRadius: number = DEFAULT_TABLE_RADIUS
): TableV2 {
  const positions = calculateCircleSeatPositions(x, y, tableRadius, result.seatCount);

  const seats: SeatV2[] = result.seats.map((seatInfo, i) => {
    const pos = positions[i];
    return createSeatV2(
      `${tableId}-seat-${i}`,
      pos.x,
      pos.y,
      seatInfo.seatNumber,
      seatInfo.mode,
      pos.textX,
      pos.textY,
      i
    );
  });

  // Set adjacency
  seats.forEach((seat, i) => {
    const prev = (i - 1 + seats.length) % seats.length;
    const next = (i + 1) % seats.length;
    seat.adjacentSeats = [seats[prev].id, seats[next].id];
  });

  return {
    id: tableId,
    x,
    y,
    radius: tableRadius,
    seats,
    label,
    shape: 'round',
  };
}

export function createRectangleTableFromResultV2(
  result: ScaledRectangleResultV2,
  tableId: string,
  x: number,
  y: number,
  label: string,
  tableWidth: number = DEFAULT_RECT_WIDTH,
  tableHeight: number = DEFAULT_RECT_HEIGHT
): TableV2 {
  const positions = calculateRectangleSeatPositions(x, y, tableWidth, tableHeight, result.sideSeats);

  const seats: SeatV2[] = [];
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const seatNumber = result.seatOrdering[i] || i + 1;
    const mode = result.seatModes[i] || 'default';

    seats.push(createSeatV2(
      `${tableId}-seat-${i}`,
      pos.x,
      pos.y,
      seatNumber,
      mode,
      pos.textX,
      pos.textY,
      i
    ));
  }

  // Set adjacency (same side only)
  const sideOffsets = {
    top: 0,
    right: result.sideSeats.top,
    bottom: result.sideSeats.top + result.sideSeats.right,
    left: result.sideSeats.top + result.sideSeats.right + result.sideSeats.bottom,
  };

  const sides: SideKeyV2[] = ['top', 'right', 'bottom', 'left'];
  for (const side of sides) {
    const startIdx = sideOffsets[side];
    const count = result.sideSeats[side];

    for (let i = 0; i < count; i++) {
      const seatIdx = startIdx + i;
      const adjacentIds: string[] = [];
      if (i > 0) adjacentIds.push(seats[seatIdx - 1].id);
      if (i < count - 1) adjacentIds.push(seats[seatIdx + 1].id);
      seats[seatIdx].adjacentSeats = adjacentIds;
    }
  }

  return {
    id: tableId,
    x,
    y,
    radius: Math.min(tableWidth, tableHeight) / 2,
    seats,
    label,
    shape: 'rectangle',
    width: tableWidth,
    height: tableHeight,
    rectangleSeats: result.sideSeats,
  };
}

// ============================================================================
// MAIN TABLE CREATION FUNCTIONS
// ============================================================================

export function createTableFromConfigV2(
  config: TableConfigV2,
  targetSeatCount: number,
  tableId: string,
  x: number,
  y: number,
  label: string,
  options?: {
    tableRadius?: number;
    tableWidth?: number;
    tableHeight?: number;
  }
): TableV2 {
  const result = scaleConfigV2(config, targetSeatCount);

  if (isCircleResultV2(result)) {
    return createRoundTableFromResultV2(
      result,
      tableId,
      x,
      y,
      label,
      options?.tableRadius || DEFAULT_TABLE_RADIUS
    );
  } else {
    return createRectangleTableFromResultV2(
      result,
      tableId,
      x,
      y,
      label,
      options?.tableWidth || DEFAULT_RECT_WIDTH,
      options?.tableHeight || DEFAULT_RECT_HEIGHT
    );
  }
}

export function createTableFromTemplateV2(
  template: TableTemplateV2,
  targetSeatCount: number,
  tableId: string,
  x: number,
  y: number,
  label: string,
  options?: {
    tableRadius?: number;
    tableWidth?: number;
    tableHeight?: number;
  }
): TableV2 {
  const table = createTableFromConfigV2(template.config, targetSeatCount, tableId, x, y, label, options);
  table.templateId = template.id;
  return table;
}

export function createTableFromTemplateBaseV2(
  template: TableTemplateV2,
  tableId: string,
  x: number,
  y: number,
  label: string,
  options?: {
    tableRadius?: number;
    tableWidth?: number;
    tableHeight?: number;
  }
): TableV2 {
  const baseSeatCount = getTotalSeatCountV2(template.config);
  return createTableFromTemplateV2(template, baseSeatCount, tableId, x, y, label, options);
}

// ============================================================================
// BATCH CREATION
// ============================================================================

export function createTablesFromTemplateV2(
  template: TableTemplateV2,
  count: number,
  targetSeatCount: number,
  startX: number,
  startY: number,
  labelPrefix: string = 'Table',
  options?: {
    gridColumns?: number;
    spacingX?: number;
    spacingY?: number;
    tableRadius?: number;
    tableWidth?: number;
    tableHeight?: number;
  }
): TableV2[] {
  const tables: TableV2[] = [];
  const columns = options?.gridColumns || 4;
  const spacingX = options?.spacingX || 250;
  const spacingY = options?.spacingY || 250;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const x = startX + col * spacingX;
    const y = startY + row * spacingY;

    const table = createTableFromTemplateV2(
      template,
      targetSeatCount,
      uuidv4(),
      x,
      y,
      `${labelPrefix} ${i + 1}`,
      options
    );
    tables.push(table);
  }

  return tables;
}

// ============================================================================
// QUICK HELPERS
// ============================================================================

export function createQuickRoundTableV2(
  seatCount: number,
  x: number,
  y: number,
  label: string,
  modePattern: 'uniform' | 'alternating' | 'ratio' = 'uniform',
  defaultMode: SeatMode = 'default'
): TableV2 {
  const config: CircleTableConfigV2 = {
    type: 'circle',
    baseSeatCount: seatCount,
    orderingPattern: { type: 'sequential', direction: 'clockwise', startPosition: 0 },
    modePattern: {
      type: modePattern,
      defaultMode,
      alternatingModes: modePattern === 'alternating' ? ['host-only', 'external-only'] : undefined,
      ratios: modePattern === 'ratio' ? { 'host-only': 0.5, 'external-only': 0.5, 'default': 0 } : undefined,
    },
  };

  return createTableFromConfigV2(config, seatCount, uuidv4(), x, y, label);
}

export function createQuickRectangleTableV2(
  topSeats: number,
  bottomSeats: number,
  leftSeats: number,
  rightSeats: number,
  x: number,
  y: number,
  label: string
): TableV2 {
  const config: RectangleTableConfigV2 = {
    type: 'rectangle',
    sides: {
      top: { seatCount: topSeats, scalable: true, enabled: topSeats > 0, allocationPriority: 0 },
      right: { seatCount: rightSeats, scalable: false, enabled: rightSeats > 0, allocationPriority: 2 },
      bottom: { seatCount: bottomSeats, scalable: true, enabled: bottomSeats > 0, allocationPriority: 1 },
      left: { seatCount: leftSeats, scalable: false, enabled: leftSeats > 0, allocationPriority: 3 },
    },
    scalingConfig: { allocationStrategy: 'round-robin', alternateOppositeSides: true },
    orderingPattern: { type: 'sequential', direction: 'clockwise', startPosition: 0 },
    modePattern: { type: 'uniform', defaultMode: 'default' },
  };

  const totalSeats = topSeats + bottomSeats + leftSeats + rightSeats;
  return createTableFromConfigV2(config, totalSeats, uuidv4(), x, y, label);
}

export function createQuickBilateralTableV2(
  seatsPerSide: number,
  x: number,
  y: number,
  label: string
): TableV2 {
  const config: RectangleTableConfigV2 = {
    type: 'rectangle',
    sides: {
      top: { seatCount: seatsPerSide, scalable: true, enabled: true, allocationPriority: 0 },
      right: { seatCount: 0, scalable: false, enabled: false, allocationPriority: 2 },
      bottom: { seatCount: seatsPerSide, scalable: true, enabled: true, allocationPriority: 1 },
      left: { seatCount: 0, scalable: false, enabled: false, allocationPriority: 3 },
    },
    scalingConfig: { allocationStrategy: 'round-robin', alternateOppositeSides: true },
    orderingPattern: { type: 'opposite', direction: 'clockwise', startPosition: 0 },
    modePattern: { type: 'uniform', defaultMode: 'default' },
  };

  return createTableFromConfigV2(config, seatsPerSide * 2, uuidv4(), x, y, label);
}

// ============================================================================
// CONVERSION TO YOUR EXISTING TABLE TYPE
// If you need to convert TableV2 to your existing Table type
// ============================================================================

/**
 * Convert V2 table output to your existing Table type
 * Adjust this function based on your actual Table interface
 */
export function convertToExistingTableType(tableV2: TableV2): any {
  // This is a passthrough - adjust based on your actual Table type
  return {
    id: tableV2.id,
    x: tableV2.x,
    y: tableV2.y,
    radius: tableV2.radius,
    seats: tableV2.seats.map(seat => ({
      id: seat.id,
      x: seat.x,
      y: seat.y,
      radius: seat.radius,
      label: seat.label,
      seatNumber: seat.seatNumber,
      mode: seat.mode,
      textX: seat.textX,
      textY: seat.textY,
      position: seat.position,
      locked: seat.locked,
      selected: seat.selected,
      adjacentSeats: seat.adjacentSeats,
      guestId: seat.guestId,
    })),
    label: tableV2.label,
    shape: tableV2.shape,
    width: tableV2.width,
    height: tableV2.height,
    rectangleSeats: tableV2.rectangleSeats,
  };
}