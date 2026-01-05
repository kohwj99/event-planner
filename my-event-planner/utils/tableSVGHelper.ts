// utils/tableSVGHelper.ts
// Helper functions for generating table SVG elements in PlaygroundCanvas
// Uses centralized color configuration from colorConfig.ts
//
// FIXED: Uniform circular placement for guest boxes
// - All boxes placed at same base distance (no vertical ellipse)
// - Smart collision resolution with tangential sliding
// - Compact layout with minimal connector lengths

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
  angle: number; // Angle from table center (radians)
  baseDist: number; // Base distance from seat (uniform for all)
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

/**
 * Calculate overlap depth between two rectangles
 * Returns penetration depth on each axis
 */
function getOverlapDepth(a: BoxRect, b: BoxRect, padding = 6): { dx: number; dy: number } | null {
  const overlapX = Math.min(a.x2 + padding, b.x2 + padding) - Math.max(a.x1 - padding, b.x1 - padding);
  const overlapY = Math.min(a.y2 + padding, b.y2 + padding) - Math.max(a.y1 - padding, b.y1 - padding);

  if (overlapX <= 0 || overlapY <= 0) {
    return null;
  }

  // Return the overlap depths
  return { dx: overlapX, dy: overlapY };
}

/**
 * Calculate distance between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ============================================================================
// RADIAL DIRECTION CALCULATION
// ============================================================================

/**
 * Calculate the radial outward direction vector from table center to seat
 */
export function calculateRadialNormal(
  relX: number,
  relY: number
): { nx: number; ny: number; angle: number } {
  const len = Math.sqrt(relX * relX + relY * relY) || 1;
  const nx = relX / len;
  const ny = relY / len;
  const angle = Math.atan2(relY, relX);
  return { nx, ny, angle };
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
 * Calculate the minimum clearance distance for a box at any angle
 * Uses the DIAGONAL of the box to ensure clearance at all angles
 * This creates UNIFORM circular placement
 */
function getUniformRadialSize(width: number, height: number): number {
  // Use the larger dimension to ensure boxes don't clip the seat
  // at any angle. This creates a circular arrangement.
  return Math.max(width, height) / 2;
}

/**
 * Generate initial guest box data with UNIFORM CIRCULAR placement
 * All boxes start at the same distance from their seats
 */
export function generateGuestBoxData(
  tableDatum: Table,
  guestLookup: Record<string, Guest>,
  connectorGap: number,
  selectedMealPlanIndex: number | null
): GuestBoxData[] {
  const boxData: GuestBoxData[] = [];

  // First pass: calculate all box dimensions to find the maximum
  const boxDimensions: { width: number; height: number; seat: Seat; guest: Guest }[] = [];
  
  (tableDatum.seats || []).forEach((s) => {
    const guest = s.assignedGuestId ? guestLookup[s.assignedGuestId] : null;
    if (!guest) return;

    const name = `${guest.salutation || ''} ${guest.name || ''}`.trim();
    const stars = getRankStars(guest.ranking);
    const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();

    let mealPlanText = '';
    if (selectedMealPlanIndex !== null) {
      const mealPlan = guest.mealPlans?.[selectedMealPlanIndex];
      mealPlanText = mealPlan && mealPlan.trim() ? mealPlan : 'None';
    }

    const charPx = 7;
    const nameWidth = name.length * charPx;
    const starsWidth = stars.length * 10;
    const line2Width = line2.length * charPx;
    const mealPlanWidth = mealPlanText.length * charPx;
    const estTextWidth = Math.max(nameWidth, starsWidth, line2Width, mealPlanWidth);
    const width = Math.min(Math.max(80, estTextWidth + 24), 300);

    const hasStars = stars.length > 0;
    const hasMealPlan = selectedMealPlanIndex !== null;
    const starsHeight = hasStars ? 14 : 0;
    const mealPlanHeight = hasMealPlan ? 14 : 0;
    const contentHeight = 28;
    const padding = 12;
    const height = padding + starsHeight + contentHeight + mealPlanHeight;

    boxDimensions.push({ width, height, seat: s, guest });
  });

  // Find the maximum radial size needed for uniform placement
  let maxRadialSize = 0;
  boxDimensions.forEach(({ width, height }) => {
    const radialSize = getUniformRadialSize(width, height);
    if (radialSize > maxRadialSize) {
      maxRadialSize = radialSize;
    }
  });

  // Second pass: create box data with uniform distance
  boxDimensions.forEach(({ width, height, seat: s, guest }) => {
    const relX = s.x - tableDatum.x;
    const relY = s.y - tableDatum.y;
    const { nx, ny, angle } = calculateRadialNormal(relX, relY);

    const name = `${guest.salutation || ''} ${guest.name || ''}`.trim();
    const stars = getRankStars(guest.ranking);
    const line2 = `${guest.country || ''} | ${guest.company || ''}`.trim();

    let mealPlanText = '';
    if (selectedMealPlanIndex !== null) {
      const mealPlan = guest.mealPlans?.[selectedMealPlanIndex];
      mealPlanText = mealPlan && mealPlan.trim() ? mealPlan : 'None';
    }

    const hasStars = stars.length > 0;
    const hasMealPlan = selectedMealPlanIndex !== null;

    const seatR = s.radius ?? 8;

    // UNIFORM distance: use the same radial size for ALL boxes
    // This creates a circular arrangement instead of an ellipse
    const baseDist = seatR + connectorGap + maxRadialSize;

    boxData.push({
      s,
      guest,
      nx,
      ny,
      width,
      height,
      x: relX + nx * baseDist,
      y: relY + ny * baseDist,
      relX,
      relY,
      angle,
      baseDist,
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
// SMART COLLISION RESOLUTION
// ============================================================================

/**
 * Try to resolve overlap by sliding boxes tangentially (around the circle)
 * Returns true if overlap was resolved
 */
function tryTangentialSlide(
  boxA: GuestBoxData,
  boxB: GuestBoxData,
  padding: number
): boolean {
  const aRect = boxRectFromCenter(boxA);
  const bRect = boxRectFromCenter(boxB);
  
  const overlap = getOverlapDepth(aRect, bRect, padding);
  if (!overlap) return true; // No overlap
  
  // Calculate tangent directions (perpendicular to radial)
  const tangentAx = -boxA.ny;
  const tangentAy = boxA.nx;
  const tangentBx = -boxB.ny;
  const tangentBy = boxB.nx;
  
  // Determine which direction to slide based on relative angles
  const angleDiff = boxB.angle - boxA.angle;
  const normalizedAngleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
  
  // Slide amount based on overlap (use smaller axis for efficiency)
  const slideAmount = Math.min(overlap.dx, overlap.dy) / 2 + 1;
  
  if (normalizedAngleDiff > 0) {
    // B is counterclockwise from A: slide A clockwise, B counterclockwise
    boxA.x -= tangentAx * slideAmount;
    boxA.y -= tangentAy * slideAmount;
    boxB.x += tangentBx * slideAmount;
    boxB.y += tangentBy * slideAmount;
  } else {
    // B is clockwise from A: slide A counterclockwise, B clockwise
    boxA.x += tangentAx * slideAmount;
    boxA.y += tangentAy * slideAmount;
    boxB.x -= tangentBx * slideAmount;
    boxB.y -= tangentBy * slideAmount;
  }
  
  // Update angles after sliding
  boxA.angle = Math.atan2(boxA.y - boxA.relY, boxA.x - boxA.relX);
  boxB.angle = Math.atan2(boxB.y - boxB.relY, boxB.x - boxB.relX);
  
  // Check if overlap is resolved
  const newARect = boxRectFromCenter(boxA);
  const newBRect = boxRectFromCenter(boxB);
  return !rectsOverlap(newARect, newBRect, padding);
}

/**
 * Resolve overlap by pushing ONLY the outer box further out
 * (The box that's already further from center moves more)
 */
function radialPushOuter(
  boxA: GuestBoxData,
  boxB: GuestBoxData,
  padding: number
): void {
  const aRect = boxRectFromCenter(boxA);
  const bRect = boxRectFromCenter(boxB);
  
  const overlap = getOverlapDepth(aRect, bRect, padding);
  if (!overlap) return;
  
  // Calculate current distances from table center (origin)
  const distA = Math.sqrt(boxA.x * boxA.x + boxA.y * boxA.y);
  const distB = Math.sqrt(boxB.x * boxB.x + boxB.y * boxB.y);
  
  // Push the outer box further out (preserves compact inner arrangement)
  // Use the overlap on the axis that requires less movement
  const pushDist = Math.min(overlap.dx, overlap.dy) + 2;
  
  if (distA >= distB) {
    // A is outer, push A out
    boxA.x += boxA.nx * pushDist;
    boxA.y += boxA.ny * pushDist;
  } else {
    // B is outer, push B out
    boxB.x += boxB.nx * pushDist;
    boxB.y += boxB.ny * pushDist;
  }
}

/**
 * Smart collision resolution algorithm
 * 1. First tries tangential sliding (preserves compact circular shape)
 * 2. Falls back to radial push only when necessary
 */
export function relaxGuestBoxPositions(
  boxData: GuestBoxData[],
  maxIterations = 100,
  padding = 6
): void {
  if (boxData.length <= 1) return;

  // Phase 1: Tangential sliding to resolve most overlaps
  for (let iter = 0; iter < maxIterations; iter++) {
    let hasOverlap = false;

    for (let i = 0; i < boxData.length; i++) {
      for (let j = i + 1; j < boxData.length; j++) {
        const boxA = boxData[i];
        const boxB = boxData[j];
        
        const aRect = boxRectFromCenter(boxA);
        const bRect = boxRectFromCenter(boxB);
        
        if (rectsOverlap(aRect, bRect, padding)) {
          hasOverlap = true;
          
          // Try tangential sliding first
          const resolved = tryTangentialSlide(boxA, boxB, padding);
          
          // If tangential didn't fully resolve, apply small radial push
          if (!resolved) {
            radialPushOuter(boxA, boxB, padding);
          }
        }
      }
    }

    if (!hasOverlap) break;
  }

  // Phase 2: Final cleanup - resolve any remaining overlaps with direct radial push
  for (let iter = 0; iter < 50; iter++) {
    let hasOverlap = false;

    for (let i = 0; i < boxData.length; i++) {
      for (let j = i + 1; j < boxData.length; j++) {
        const boxA = boxData[i];
        const boxB = boxData[j];
        
        const aRect = boxRectFromCenter(boxA);
        const bRect = boxRectFromCenter(boxB);
        
        if (rectsOverlap(aRect, bRect, padding)) {
          hasOverlap = true;
          
          // Direct radial push both boxes
          const overlap = getOverlapDepth(aRect, bRect, padding);
          if (overlap) {
            const pushDist = Math.min(overlap.dx, overlap.dy) / 2 + 1;
            boxA.x += boxA.nx * pushDist;
            boxA.y += boxA.ny * pushDist;
            boxB.x += boxB.nx * pushDist;
            boxB.y += boxB.ny * pushDist;
          }
        }
      }
    }

    if (!hasOverlap) break;
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

  // Generate guest box positions with UNIFORM circular placement
  const boxData = generateGuestBoxData(tableDatum, guestLookup, connectorGap, selectedMealPlanIndex);
  
  // Apply smart collision resolution
  relaxGuestBoxPositions(boxData, 100, 6);

  // Render connectors
  renderConnectors(group, seatsWithGuest, tableDatum, boxData, colorScheme);

  // Render guest boxes with centered text
  renderGuestBoxes(group, seatsWithGuest, boxData, selectedMealPlanIndex, colorScheme);
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// 
// FIXED: Uniform circular placement (no more vertical ellipse)
//
// Key changes:
// 1. getUniformRadialSize() - Uses max(width,height) for all boxes
// 2. generateGuestBoxData() - Places all boxes at same base distance
// 3. relaxGuestBoxPositions() - Smart collision with tangential sliding
//
// Geometry:
//   - boxRectFromCenter(box) - Convert center coords to bounding rect
//   - rectsOverlap(a, b, padding) - Check rectangle overlap
//   - calculateRadialNormal(relX, relY) - RADIAL direction with angle
//
// Guest Box Data:
//   - generateGuestBoxData(...) - Create UNIFORM circular box positions
//   - relaxGuestBoxPositions(...) - Smart collision resolution
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