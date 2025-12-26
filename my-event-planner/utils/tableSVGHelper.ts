// utils/tableSVGHelper.ts
// Helper functions for generating table SVG elements in PlaygroundCanvas
// Uses centralized color configuration from colorConfig.ts
//
// IMPORTANT: This file contains the RADIAL CONFIGURATION for guest text boxes
// around BOTH round AND rectangle tables. This creates an "oval" formation
// instead of a grid-like layout for rectangles.

import * as d3 from 'd3';
import { Table } from '@/types/Table';
import { Seat, SeatMode } from '@/types/Seat';
import { Guest } from '@/store/guestStore';
import {
  ColorScheme,
  getSeatFillColor as getConfigSeatFillColor,
  getSeatStrokeColor as getConfigSeatStrokeColor,
  getGuestBoxColors as getConfigGuestBoxColors,
  getSeatStrokeDashArray as getConfigStrokeDashArray,
  getSeatStrokeWidth,
} from '@/utils/colorConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface BoxRect {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface GuestBoxData {
  s: Seat;
  guest: Guest;
  nx: number;  // Normal X direction (radial, from table center outward)
  ny: number;  // Normal Y direction (radial, from table center outward)
  width: number;
  height: number;
  x: number;   // Current X position (relative to table center)
  y: number;   // Current Y position (relative to table center)
  relX: number;  // Seat X relative to table center
  relY: number;  // Seat Y relative to table center
  minRadialDist: number;
  mealPlanText: string;
  hasStars: boolean;
  hasMealPlan: boolean;
  nameText: string;
  metaText: string;
  starsText: string;
}

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

/**
 * Convert box center coordinates to bounding rect
 */
export function boxRectFromCenter(b: { x: number; y: number; width: number; height: number }): BoxRect {
  return {
    x1: b.x - b.width / 2,
    x2: b.x + b.width / 2,
    y1: b.y - b.height / 2,
    y2: b.y + b.height / 2,
  };
}

/**
 * Check if two rectangles overlap with padding
 */
export function rectsOverlap(a: BoxRect, b: BoxRect, padding = 6): boolean {
  return !(
    a.x2 + padding < b.x1 ||
    a.x1 - padding > b.x2 ||
    a.y2 + padding < b.y1 ||
    a.y1 - padding > b.y2
  );
}

// ============================================================================
// RADIAL DIRECTION CALCULATION
// ============================================================================

/**
 * Calculate the radial outward direction vector from table center to seat
 * 
 * IMPORTANT: This uses RADIAL vectors for BOTH round AND rectangle tables.
 * This ensures rectangular tables get an "oval" formation of guests
 * instead of a grid-like layout.
 */
export function calculateRadialNormal(
  relX: number,
  relY: number
): { nx: number; ny: number } {
  const len = Math.sqrt(relX * relX + relY * relY) || 1;
  const nx = relX / len;
  const ny = relY / len;
  return { nx, ny };
}

// ============================================================================
// RANK STARS HELPER
// ============================================================================

/**
 * Get rank stars string for guest ranking
 */
export function getRankStars(ranking: number | string | undefined): string {
  if (ranking === undefined || ranking === null) return '';
  const r = Number(ranking) || Infinity;
  if (r <= 1) return ' ⭐⭐⭐⭐';
  if (r <= 2) return ' ⭐⭐⭐';
  if (r <= 3) return ' ⭐⭐';
  if (r <= 4) return ' ⭐';
  return '';
}

// ============================================================================
// SEAT APPEARANCE HELPERS (using centralized colors)
// ============================================================================

/**
 * Get seat fill color based on state and mode
 */
export function getSeatFillColor(seat: Seat, colorScheme: ColorScheme): string {
  const mode = (seat.mode || 'default') as 'default' | 'host-only' | 'external-only';
  return getConfigSeatFillColor(
    {
      mode,
      isLocked: !!seat.locked,
      isSelected: !!seat.selected,
      isAssigned: !!seat.assignedGuestId,
    },
    colorScheme
  );
}

/**
 * Get seat stroke color based on state and mode
 */
export function getSeatStrokeColor(seat: Seat, colorScheme: ColorScheme): string {
  const mode = (seat.mode || 'default') as 'default' | 'host-only' | 'external-only';
  return getConfigSeatStrokeColor(
    {
      mode,
      isLocked: !!seat.locked,
      isSelected: !!seat.selected,
      isAssigned: !!seat.assignedGuestId,
    },
    colorScheme
  );
}

/**
 * Get seat stroke dash array based on mode
 */
export function getSeatStrokeDashArray(seat: Seat, colorScheme: ColorScheme): string {
  const mode = (seat.mode || 'default') as 'default' | 'host-only' | 'external-only';
  return getConfigStrokeDashArray(mode, colorScheme.mode);
}

// ============================================================================
// GUEST BOX COLORS (using centralized colors)
// ============================================================================

/**
 * Get guest box colors based on guest type
 */
export function getGuestBoxColors(
  isHost: boolean,
  colorScheme: ColorScheme
): { fill: string; stroke: string; text: string } {
  return getConfigGuestBoxColors(isHost, colorScheme);
}

// ============================================================================
// GUEST BOX DATA GENERATION
// ============================================================================

/**
 * Generate initial guest box data with RADIAL positioning
 * 
 * This creates an oval/radial formation around the table for ALL table types.
 * Rectangle tables will have guests positioned radially outward from center.
 */
export function generateGuestBoxData(
  tableDatum: Table,
  guestLookup: Record<string, Guest>,
  connectorGap: number,
  selectedMealPlanIndex: number | null
): GuestBoxData[] {
  const boxData: GuestBoxData[] = [];

  (tableDatum.seats || []).forEach((s) => {
    const guest = s.assignedGuestId ? guestLookup[s.assignedGuestId] : null;
    if (!guest) return;

    const relX = s.x - tableDatum.x;
    const relY = s.y - tableDatum.y;

    // RADIAL direction vector (same for round and rectangle)
    const { nx, ny } = calculateRadialNormal(relX, relY);

    // Build text content
    const name = `${guest.salutation || ''} ${guest.name || ''}`.trim();
    const stars = getRankStars(guest.ranking);
    const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();

    // Get meal plan for display
    let mealPlanText = '';
    if (selectedMealPlanIndex !== null) {
      const mealPlan = guest.mealPlans?.[selectedMealPlanIndex];
      mealPlanText = mealPlan && mealPlan.trim() ? mealPlan : 'None';
    }

    // Calculate box dimensions with proper spacing for all elements
    const charPx = 7;
    const nameWidth = name.length * charPx;
    const starsWidth = stars.length * 10;
    const line2Width = line2.length * charPx;
    const mealPlanWidth = mealPlanText.length * charPx;
    const estTextWidth = Math.max(nameWidth, starsWidth, line2Width, mealPlanWidth);
    const width = Math.min(Math.max(80, estTextWidth + 24), 300);

    // Height calculation
    const hasStars = stars.length > 0;
    const hasMealPlan = selectedMealPlanIndex !== null;
    const starsHeight = hasStars ? 14 : 0;
    const mealPlanHeight = hasMealPlan ? 14 : 0;
    const contentHeight = 28;
    const padding = 12;
    const height = padding + starsHeight + contentHeight + mealPlanHeight;

    const seatR = s.radius ?? 8;

    // Orientation-aware radial sizing
    const verticalBias = Math.abs(ny);
    const horizontalBias = Math.abs(nx);
    const radialSize = (verticalBias * height) + (horizontalBias * width);

    let dist = seatR + connectorGap + radialSize / 2;

    // Pull top/bottom boxes slightly closer
    if (Math.abs(ny) > 0.85) {
      dist *= 0.75;
    }

    boxData.push({
      s,
      guest,
      nx,
      ny,
      width,
      height,
      x: relX + nx * dist,
      y: relY + ny * dist,
      relX,
      relY,
      minRadialDist: dist,
      mealPlanText,
      hasStars,
      hasMealPlan,
      nameText: name,
      metaText: line2,
      starsText: stars,
    });
  });

  return boxData;
}

// ============================================================================
// RADIAL RELAXATION ALGORITHM
// ============================================================================

/**
 * Perform radial outward relaxation to prevent guest box overlap
 */
export function relaxGuestBoxPositions(
  boxData: GuestBoxData[],
  maxIterations = 150,
  step = 2,
  padding = 6
): void {
  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;

    for (let i = 0; i < boxData.length; i++) {
      const a = boxData[i];
      const aRect = boxRectFromCenter(a);

      for (let j = i + 1; j < boxData.length; j++) {
        const b = boxData[j];
        const bRect = boxRectFromCenter(b);

        if (rectsOverlap(aRect, bRect, padding)) {
          a.x += a.nx * step;
          a.y += a.ny * step;
          b.x += b.nx * step;
          b.y += b.ny * step;
          moved = true;
        }
      }
    }

    if (!moved) break;
  }
}

// ============================================================================
// CONNECTOR LINE HELPERS
// ============================================================================

/**
 * Get connector line endpoints from seat to guest box
 */
export function getConnectorEndpoint(
  seat: Seat,
  tableDatum: Table,
  boxData: GuestBoxData[]
): { x1: number; y1: number; x2: number; y2: number } | null {
  const relX = seat.x - tableDatum.x;
  const relY = seat.y - tableDatum.y;

  const box = boxData.find(b => b.s.id === seat.id);
  if (!box) return null;

  return {
    x1: relX,
    y1: relY,
    x2: box.x,
    y2: box.y,
  };
}

// ============================================================================
// MAIN RENDERING FUNCTIONS (using centralized colors)
// ============================================================================

/**
 * Render connectors from seats to guest boxes
 */
export function renderConnectors(
  group: d3.Selection<SVGGElement, any, any, any>,
  seatsWithGuest: Seat[],
  tableDatum: Table,
  boxData: GuestBoxData[],
  colorScheme: ColorScheme
): void {
  let connectorsLayer = group.select<SVGGElement>('g.connectors-layer');
  if (connectorsLayer.empty()) {
    connectorsLayer = group.insert('g', ':first-child').attr('class', 'connectors-layer') as any;
  }

  const connectors = connectorsLayer
    .selectAll<SVGLineElement, Seat>('line.connector-line')
    .data(seatsWithGuest, (s: any) => s.id);

  connectors.exit().remove();

  const connectorsEnter = connectors
    .enter()
    .append('line')
    .attr('class', 'connector-line')
    .attr('stroke', colorScheme.ui.connectorLine)
    .attr('stroke-width', 1)
    .attr('pointer-events', 'none');

  connectorsEnter.merge(connectors as any).each(function (s: Seat) {
    const endpoint = getConnectorEndpoint(s, tableDatum, boxData);
    if (endpoint) {
      d3.select(this)
        .attr('x1', endpoint.x1)
        .attr('y1', endpoint.y1)
        .attr('x2', endpoint.x2)
        .attr('y2', endpoint.y2)
        .attr('stroke', colorScheme.ui.connectorLine);
    }
  });
}

/**
 * Render seats with mode-based colors
 */
export function renderSeats(
  group: d3.Selection<SVGGElement, any, any, any>,
  tableDatum: Table,
  colorScheme: ColorScheme,
  onSeatClick: (tableId: string, seatId: string) => void,
  onSeatRightClick: (tableId: string, seatId: string, locked: boolean) => void,
  onSeatDoubleClick: (tableId: string, seatId: string) => void
): void {
  const seatsSel = group
    .selectAll<SVGCircleElement, Seat>('circle.seat')
    .data(tableDatum.seats || [], (s) => s.id);

  seatsSel.exit().remove();

  const seatsEnter = seatsSel.enter().append('circle').attr('class', 'seat');

  seatsEnter.merge(seatsSel as any)
    .attr('cx', (s) => s.x - tableDatum.x)
    .attr('cy', (s) => s.y - tableDatum.y)
    .attr('r', (s) => s.radius)
    .attr('fill', (s) => getSeatFillColor(s, colorScheme))
    .attr('stroke', (s) => getSeatStrokeColor(s, colorScheme))
    .attr('stroke-width', (s) => {
      const mode = (s.mode || 'default') as 'default' | 'host-only' | 'external-only';
      return getSeatStrokeWidth(mode, colorScheme.mode);
    })
    .attr('stroke-dasharray', (s) => getSeatStrokeDashArray(s, colorScheme))
    .style('cursor', 'pointer')
    .on('click', (event, s) => {
      event.stopPropagation();
      onSeatClick(tableDatum.id, s.id);
    })
    .on('contextmenu', (event, s) => {
      event.preventDefault();
      onSeatRightClick(tableDatum.id, s.id, !s.locked);
    })
    .on('dblclick', (event, s) => {
      onSeatDoubleClick(tableDatum.id, s.id);
    });

  // Seat number labels
  const seatLabels = group
    .selectAll<SVGTextElement, Seat>('text.seat-number')
    .data(tableDatum.seats || [], (s) => s.id);

  seatLabels.exit().remove();

  const seatLabelsEnter = seatLabels.enter().append('text').attr('class', 'seat-number');

  seatLabelsEnter.merge(seatLabels as any)
    .attr('x', (s) => s.x - tableDatum.x)
    .attr('y', (s) => s.y - tableDatum.y + 3)
    .attr('text-anchor', 'middle')
    .attr('fill', colorScheme.table.tableStroke)
    .attr('font-size', '10px')
    .attr('font-weight', 'bold')
    .text((s) => s.seatNumber);
}

/**
 * Render guest boxes with proper layout:
 * - Stars at TOP (if VIP, within box)
 * - Name + Meta CENTERED in the middle area
 * - Meal plan at BOTTOM (if selected, within box)
 * 
 * Box height adjusts to fit all elements without overlap.
 */
export function renderGuestBoxes(
  group: d3.Selection<SVGGElement, any, any, any>,
  seatsWithGuest: Seat[],
  boxData: GuestBoxData[],
  selectedMealPlanIndex: number | null,
  colorScheme: ColorScheme
): void {
  const guestBoxes = group
    .selectAll<SVGGElement, Seat>('g.guest-box')
    .data(seatsWithGuest, (s) => s.id);

  guestBoxes.exit().remove();

  const guestBoxesEnter = guestBoxes
    .enter()
    .append('g')
    .attr('class', 'guest-box')
    .style('pointer-events', 'none');

  // Rectangle
  guestBoxesEnter
    .append('rect')
    .attr('class', 'guest-rect')
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('stroke-width', 1.5);

  // Stars text (top, centered)
  guestBoxesEnter
    .append('text')
    .attr('class', 'guest-stars')
    .attr('font-size', 10)
    .style('font-family', `Segoe UI Emoji, "Apple Color Emoji", "Noto Color Emoji", sans-serif`);

  // Name text (centered)
  guestBoxesEnter
    .append('text')
    .attr('class', 'guest-name')
    .attr('font-size', 11)
    .attr('font-weight', 'bold');

  // Meta text (country | company, centered)
  guestBoxesEnter
    .append('text')
    .attr('class', 'guest-meta')
    .attr('font-size', 10);

  // Meal plan text (bottom, centered)
  guestBoxesEnter
    .append('text')
    .attr('class', 'guest-meal-plan')
    .attr('font-size', 9)
    .style('font-family', `Segoe UI Emoji, "Apple Color Emoji", "Noto Color Emoji", sans-serif`);

  // Render each guest box with proper layout
  boxData.forEach((b) => {
    const { guest, s, width, height, mealPlanText, hasStars, hasMealPlan, nameText, metaText, starsText } = b;
    const rectX = b.x - width / 2;
    const rectY = b.y - height / 2;

    const isHost = !!guest.fromHost;
    const colors = getGuestBoxColors(isHost, colorScheme);

    const gbox = group
      .selectAll<SVGGElement, any>('g.guest-box')
      .filter((d) => d.id === s.id);

    // Update rectangle with color scheme colors
    gbox.select('rect.guest-rect')
      .attr('x', rectX)
      .attr('y', rectY)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', colors.fill)
      .attr('stroke', colors.stroke);

    // Layout calculation
    const topPadding = 6;
    const starsRowHeight = hasStars ? 14 : 0;
    const mealPlanRowHeight = hasMealPlan ? 14 : 0;

    let currentY = rectY + topPadding;

    // Stars at top (if VIP)
    const starsY = currentY + starsRowHeight / 2;
    currentY += starsRowHeight;

    // Name and Meta centered in middle area
    const nameY = currentY + 14 / 2 + 3;
    currentY += 14;
    const metaY = currentY + 14 / 2 + 2;
    currentY += 14;

    // Meal plan at bottom (if selected)
    const mealPlanY = currentY + mealPlanRowHeight / 2 + 2;

    // Update stars text (top, centered) - using UI stars color
    gbox.select('text.guest-stars')
      .attr('x', b.x)
      .attr('y', starsY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', colorScheme.ui.starsColor)
      .text(hasStars ? starsText.trim() : '');

    // Update name text (centered) - using guest text color
    gbox.select('text.guest-name')
      .attr('x', b.x)
      .attr('y', nameY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', colors.text)
      .text(nameText);

    // Update meta text (centered, below name) - using meta text color
    gbox.select('text.guest-meta')
      .attr('x', b.x)
      .attr('y', metaY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', colorScheme.ui.metaText)
      .text(metaText);

    // Update meal plan text (bottom, centered) - using meal plan color
    gbox.select('text.guest-meal-plan')
      .attr('x', b.x)
      .attr('y', mealPlanY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', colorScheme.ui.mealPlanText)
      .text(hasMealPlan ? `🍽 ${mealPlanText}` : '');

    // Update connector endpoint
    group
      .selectAll<SVGLineElement, any>('line.connector-line')
      .filter((d) => d.id === s.id)
      .attr('x2', b.x)
      .attr('y2', b.y);
  });
}

/**
 * Main entry point: Render all guest display elements for a table
 * (connectors, guest boxes with centered text and meal plan)
 */
export function renderTableGuestDisplay(
  group: d3.Selection<SVGGElement, any, any, any>,
  tableDatum: Table,
  guestLookup: Record<string, Guest>,
  connectorGap: number,
  selectedMealPlanIndex: number | null,
  colorScheme: ColorScheme
): void {
  const seatsWithGuest = (tableDatum.seats || []).filter((s) => s.assignedGuestId);

  // Generate and relax guest box positions
  const boxData = generateGuestBoxData(tableDatum, guestLookup, connectorGap, selectedMealPlanIndex);
  relaxGuestBoxPositions(boxData, 150, 2, 6);

  // Render connectors
  renderConnectors(group, seatsWithGuest, tableDatum, boxData, colorScheme);

  // Render guest boxes with centered text
  renderGuestBoxes(group, seatsWithGuest, boxData, selectedMealPlanIndex, colorScheme);
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// 
// All rendering functions now accept ColorScheme parameter for centralized colors.
//
// Geometry:
//   - boxRectFromCenter(box) - Convert center coords to bounding rect
//   - rectsOverlap(a, b, padding) - Check rectangle overlap
//   - calculateRadialNormal(relX, relY) - RADIAL direction
//
// Guest Box Data:
//   - generateGuestBoxData(...) - Create initial RADIAL box positions
//   - relaxGuestBoxPositions(boxData, ...) - Prevent overlap via radial push
//
// Seat Appearance:
//   - getSeatFillColor(seat, colorScheme) - Color based on state/mode
//   - getSeatStrokeColor(seat, colorScheme) - Stroke based on mode
//   - getSeatStrokeDashArray(seat, colorScheme) - Dashed for external-only
//   - getRankStars(ranking) - VIP star indicators
//
// Colors:
//   - getGuestBoxColors(isHost, colorScheme) - Host vs external colors
//
// Rendering:
//   - renderConnectors(..., colorScheme) - Draw connector lines
//   - renderSeats(..., colorScheme) - Draw seats with mode colors
//   - renderGuestBoxes(..., colorScheme) - Draw guest boxes
//   - renderTableGuestDisplay(..., colorScheme) - Main entry point
//