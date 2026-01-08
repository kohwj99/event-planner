// utils/tableSVGHelper.ts
// Helper functions for generating table SVG elements in PlaygroundCanvas
// Uses centralized color configuration from colorConfig.ts
//
// ENHANCED: Photography Mode Support
// - Full preservation of original "Standard Mode" logic.
// - NEW "Photo Mode" with Smart Layout Engine:
//   - Automatically calculates non-overlapping grids for Rectangular tables.
//   - Automatically expands orbit radius for Round tables to fit boxes.
//   - Uniform Square Cards (90x90px) containing full guest details.

import * as d3 from 'd3';
import { Table } from '@/types/Table';
import { Seat } from '@/types/Seat';
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
// CONSTANTS
// ============================================================================

export const PHOTO_BOX_SIZE = 90; // Fixed size for Photo Mode squares
export const PHOTO_BOX_GAP = 8;   // Gap between boxes in Photo Mode

// ============================================================================
// TYPES
// ============================================================================

interface PhotoLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  photoWidth?: number;
  photoHeight?: number;
}

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
  if (r <= 1) return '⭐⭐⭐⭐';
  if (r <= 2) return '⭐⭐⭐';
  if (r <= 3) return '⭐⭐';
  if (r <= 4) return '⭐';
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
// GUEST BOX DATA GENERATION (STANDARD MODE)
// ============================================================================

/**
 * Calculate the minimum clearance distance for a box at any angle
 * Uses the DIAGONAL of the box to ensure clearance at all angles
 * This creates UNIFORM circular placement
 */
function getUniformRadialSize(width: number, height: number): number {
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
// SMART COLLISION RESOLUTION (STANDARD MODE)
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
// CONNECTOR LINE HELPERS (STANDARD MODE)
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
// MAIN RENDERING FUNCTIONS (STANDARD MODE)
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
 * Render guest boxes (Standard Mode)
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

  // Text elements
  guestBoxesEnter.append('text').attr('class', 'guest-stars').attr('font-size', 10);
  guestBoxesEnter.append('text').attr('class', 'guest-name').attr('font-size', 11).attr('font-weight', 'bold');
  guestBoxesEnter.append('text').attr('class', 'guest-meta').attr('font-size', 10);
  guestBoxesEnter.append('text').attr('class', 'guest-meal-plan').attr('font-size', 9);

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
    let currentY = rectY + topPadding;

    const starsY = currentY + (hasStars ? 14 : 0) / 2;
    if (hasStars) currentY += 14;

    const nameY = currentY + 14 / 2 + 3;
    currentY += 14;
    const metaY = currentY + 14 / 2 + 2;
    currentY += 14;

    const mealPlanY = currentY + (hasMealPlan ? 14 : 0) / 2 + 2;

    // Update Text
    gbox.select('text.guest-stars').attr('x', b.x).attr('y', starsY).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', colorScheme.ui.starsColor).text(hasStars ? starsText.trim() : '');
    gbox.select('text.guest-name').attr('x', b.x).attr('y', nameY).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', colors.text).text(nameText);
    gbox.select('text.guest-meta').attr('x', b.x).attr('y', metaY).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', colorScheme.ui.metaText).text(metaText);
    gbox.select('text.guest-meal-plan').attr('x', b.x).attr('y', mealPlanY).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', colorScheme.ui.mealPlanText).text(hasMealPlan ? `🍽 ${mealPlanText}` : '');

    // Update connector
    group
      .selectAll<SVGLineElement, any>('line.connector-line')
      .filter((d) => d.id === s.id)
      .attr('x2', b.x)
      .attr('y2', b.y);
  });
}

// ============================================================================
// PHOTOGRAPHY MODE - SMART LAYOUT ENGINE
// ============================================================================

/**
 * Calculates optimized, non-overlapping positions for large Square Boxes.
 * Uses redistribution logic rather than simple projection to ensure spacing.
 */
function calculateSmartPhotoPositions(
  tableDatum: Table,
  boxSize: number,
  gap: number
): PhotoLayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const seats = tableDatum.seats || [];
  if (seats.length === 0) {
    return { positions };
  }

  // ============================================================
  // ROUND TABLE — UNCHANGED
  // ============================================================
  if (tableDatum.shape === 'round') {
    const seatsWithAngles = seats
      .map(s => {
        const relX = s.x - tableDatum.x;
        const relY = s.y - tableDatum.y;
        return { s, angle: Math.atan2(relY, relX) };
      })
      .sort((a, b) => a.angle - b.angle);

    const minCircumference = seats.length * (boxSize + gap);
    const minRadius = minCircumference / (2 * Math.PI);
    const baseRadius = (tableDatum.radius || 60) + boxSize / 2 + 10;
    const finalRadius = Math.max(baseRadius, minRadius);
    const angleStep = (2 * Math.PI) / seats.length;
    const startAngle = seatsWithAngles[0].angle;

    seatsWithAngles.forEach((item, i) => {
      const angle = startAngle + i * angleStep;
      positions.set(item.s.id, {
        x: Math.cos(angle) * finalRadius,
        y: Math.sin(angle) * finalRadius,
      });
    });

    return { positions };
  }

  // ============================================================
  // RECTANGLE TABLE — PHOTO MODE AUTO-SIZING (NEW)
  // ============================================================

  const w = tableDatum.width || 160;
  const h = tableDatum.height || 100;
  const halfW = w / 2;
  const halfH = h / 2;

  interface SeatGroup {
    side: 'top' | 'bottom' | 'left' | 'right';
    items: { s: Seat; sortKey: number }[];
  }

  const groups: Record<'top' | 'bottom' | 'left' | 'right', SeatGroup> = {
    top: { side: 'top', items: [] },
    bottom: { side: 'bottom', items: [] },
    left: { side: 'left', items: [] },
    right: { side: 'right', items: [] },
  };

  seats.forEach(s => {
    const relX = s.x - tableDatum.x;
    const relY = s.y - tableDatum.y;

    const dTop = Math.abs(relY + halfH);
    const dBottom = Math.abs(relY - halfH);
    const dLeft = Math.abs(relX + halfW);
    const dRight = Math.abs(relX - halfW);

    const minD = Math.min(dTop, dBottom, dLeft, dRight);

    if (minD === dTop) groups.top.items.push({ s, sortKey: relX });
    else if (minD === dBottom) groups.bottom.items.push({ s, sortKey: relX });
    else if (minD === dLeft) groups.left.items.push({ s, sortKey: relY });
    else groups.right.items.push({ s, sortKey: relY });
  });

  // ============================================================
  // NEW: Compute REQUIRED table dimensions from photo boxes
  // ============================================================

  const topCount = groups.top.items.length;
  const bottomCount = groups.bottom.items.length;
  const leftCount = groups.left.items.length;
  const rightCount = groups.right.items.length;

  const SIDE_PADDING = boxSize / 2 + gap;

  const requiredWidth =
    Math.max(topCount, bottomCount) * boxSize +
    Math.max(0, Math.max(topCount, bottomCount) - 1) * gap +
    SIDE_PADDING * 2;

  const requiredHeight =
    Math.max(leftCount, rightCount) * boxSize +
    Math.max(0, Math.max(leftCount, rightCount) - 1) * gap +
    SIDE_PADDING * 2;

  const photoWidth = Math.max(w, requiredWidth);
  const photoHeight = Math.max(h, requiredHeight);

  const halfPW = photoWidth / 2;
  const halfPH = photoHeight / 2;

  // ============================================================
  // Position boxes EXACTLY on resized perimeter
  // ============================================================

  Object.values(groups).forEach(group => {
    if (group.items.length === 0) return;

    group.items.sort((a, b) => a.sortKey - b.sortKey);

    const count = group.items.length;
    const totalSpan = count * boxSize + (count - 1) * gap;
    const startOffset = -totalSpan / 2 + boxSize / 2;

    group.items.forEach((item, i) => {
      const offset = startOffset + i * (boxSize + gap);
      let x = 0;
      let y = 0;

      switch (group.side) {
        case 'top':
          x = offset;
          y = -halfPH - boxSize / 2;
          break;
        case 'bottom':
          x = offset;
          y = halfPH + boxSize / 2;
          break;
        case 'left':
          x = -halfPW - boxSize / 2;
          y = offset;
          break;
        case 'right':
          x = halfPW + boxSize / 2;
          y = offset;
          break;
      }

      positions.set(item.s.id, { x, y });
    });
  });

  return {
    positions,
    photoWidth,
    photoHeight,
  };
}

/**
 * Render the unified Square Boxes for Photography Mode.
 */
function renderPhotoSeats(
  group: d3.Selection<SVGGElement, any, any, any>,
  tableDatum: Table,
  colorScheme: ColorScheme,
  guestLookup: Record<string, Guest>,
  selectedMealPlanIndex: number | null,
  onSeatClick: (tableId: string, seatId: string) => void,
  onSeatRightClick: (tableId: string, seatId: string, locked: boolean) => void,
  onSeatDoubleClick: (tableId: string, seatId: string) => void
): void {
  const { positions: smartPositions, photoWidth, photoHeight } =
    calculateSmartPhotoPositions(tableDatum, PHOTO_BOX_SIZE, PHOTO_BOX_GAP);

  const seatGroups = group
    .selectAll<SVGGElement, Seat>('g.photo-seat-group')
    .data(tableDatum.seats || [], (s) => s.id);

  seatGroups.exit().remove();

  const enter = seatGroups.enter().append('g')
    .attr('class', 'photo-seat-group')
    .style('cursor', 'pointer');

  // Box Shape
  enter.append('rect')
    .attr('class', 'seat')
    .attr('width', PHOTO_BOX_SIZE)
    .attr('height', PHOTO_BOX_SIZE)
    .attr('rx', 6).attr('ry', 6);

  // Content Text
  enter.append('text').attr('class', 'photo-name').attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 'bold');
  enter.append('text').attr('class', 'photo-meta-line1').attr('text-anchor', 'middle').attr('font-size', 9);
  enter.append('text').attr('class', 'photo-meta-line2').attr('text-anchor', 'middle').attr('font-size', 9);
  enter.append('text').attr('class', 'photo-stars').attr('text-anchor', 'middle').attr('font-size', 9);
  enter.append('text').attr('class', 'photo-meal').attr('text-anchor', 'middle').attr('font-size', 9);

  // Seat Number (small, corner)
  enter.append('text').attr('class', 'photo-num').attr('text-anchor', 'start').attr('font-size', 9).attr('fill', '#999');

  const merged = enter.merge(seatGroups as any);

  merged.each(function (s: Seat) {
    const grp = d3.select(this);

    // Get position from Smart Layout Engine
    const pos = smartPositions.get(s.id) || { x: s.x - tableDatum.x, y: s.y - tableDatum.y };
    grp.attr('transform', `translate(${pos.x - PHOTO_BOX_SIZE / 2}, ${pos.y - PHOTO_BOX_SIZE / 2})`);

    // Box Styling (Reuse Seat Colors)
    grp.select('rect.seat')
      .attr('fill', getSeatFillColor(s, colorScheme))
      .attr('stroke', getSeatStrokeColor(s, colorScheme))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', getSeatStrokeDashArray(s, colorScheme));

    const guest = s.assignedGuestId ? guestLookup[s.assignedGuestId] : null;
    const cx = PHOTO_BOX_SIZE / 2;

    // Seat Number
    grp.select('text.photo-num').attr('x', 5).attr('y', 14).text(s.seatNumber);

    if (guest) {
      const isHost = !!guest.fromHost;
      const boxColors = getGuestBoxColors(isHost, colorScheme);

      const stars = getRankStars(guest.ranking);
      let mealPlan = '';
      if (selectedMealPlanIndex !== null) {
        mealPlan = guest.mealPlans?.[selectedMealPlanIndex] || '';
      }

      // Stars (Top Center)
      grp.select('text.photo-stars')
        .attr('x', cx).attr('y', 14)
        .attr('fill', colorScheme.ui.starsColor)
        .text(stars);

      // Name (Center - slightly up)
      grp.select('text.photo-name')
        .attr('x', cx)
        .attr('y', PHOTO_BOX_SIZE / 2 - 10)
        .attr('fill', boxColors.text)
        .text(`${guest.salutation || ''} ${guest.name || ''}`.trim());

      // Meta: split into 2 lines (Country below Company)
      const country = guest.country || '';
      const company = guest.company || '';
      grp.select('text.photo-meta-line1')
        .attr('x', cx)
        .attr('y', PHOTO_BOX_SIZE / 2 + 2)
        .attr('fill', colorScheme.ui.metaText)
        .text(company);

      grp.select('text.photo-meta-line2')
        .attr('x', cx)
        .attr('y', PHOTO_BOX_SIZE / 2 + 14)
        .attr('fill', colorScheme.ui.metaText)
        .text(country);

      // Meal Plan (Bottom Center)
      grp.select('text.photo-meal')
        .attr('x', cx).attr('y', PHOTO_BOX_SIZE - 8)
        .attr('fill', colorScheme.ui.mealPlanText)
        .text(mealPlan ? `🍽 ${mealPlan}` : '');

    } else {
      // Empty Seat State
      grp.select('text.photo-name')
        .attr('x', cx)
        .attr('y', PHOTO_BOX_SIZE / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#999')
        .text('Empty');

      // Clear other text nodes
      grp.select('text.photo-meta-line1').text('');
      grp.select('text.photo-meta-line2').text('');
      grp.select('text.photo-stars').text('');
      grp.select('text.photo-meal').text('');
    }

    // Events
    grp
      .on('click', (event) => {
        event.stopPropagation();
        onSeatClick(tableDatum.id, s.id);
      })
      .on('contextmenu', (event) => {
        event.preventDefault();
        onSeatRightClick(tableDatum.id, s.id, !s.locked);
      })
      .on('dblclick', () => {
        onSeatDoubleClick(tableDatum.id, s.id);
      });
  });
}


// ============================================================================
// MAIN EXPORTS (TOGGLE AWARE)
// ============================================================================

export function renderSeats(
  group: d3.Selection<SVGGElement, any, any, any>,
  tableDatum: Table,
  colorScheme: ColorScheme,
  guestLookup: Record<string, Guest>,
  selectedMealPlanIndex: number | null,
  isPhotoMode: boolean,
  onSeatClick: (tableId: string, seatId: string) => void,
  onSeatRightClick: (tableId: string, seatId: string, locked: boolean) => void,
  onSeatDoubleClick: (tableId: string, seatId: string) => void
): void {
  if (isPhotoMode) {
    // Clean up Standard Elements
    group.selectAll('circle.seat').remove();
    group.selectAll('text.seat-number').remove();

    // Render Photo Mode
    renderPhotoSeats(group, tableDatum, colorScheme, guestLookup, selectedMealPlanIndex, onSeatClick, onSeatRightClick, onSeatDoubleClick);
  } else {
    // Clean up Photo Elements
    group.selectAll('g.photo-seat-group').remove();

    // Render Standard Elements (Circles)
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

    // Seat Numbers
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
}

export function renderTableGuestDisplay(
  group: d3.Selection<SVGGElement, any, any, any>,
  tableDatum: Table,
  guestLookup: Record<string, Guest>,
  connectorGap: number,
  selectedMealPlanIndex: number | null,
  colorScheme: ColorScheme,
  isPhotoMode: boolean
): void {
  // If in Photo Mode, hide standard display
  if (isPhotoMode) {
    group.select('g.connectors-layer').remove();
    group.selectAll('g.guest-box').remove();
    return;
  }

  // Standard Logic
  const seatsWithGuest = (tableDatum.seats || []).filter((s) => s.assignedGuestId);
  const boxData = generateGuestBoxData(tableDatum, guestLookup, connectorGap, selectedMealPlanIndex);
  relaxGuestBoxPositions(boxData, 100, 6);
  renderConnectors(group, seatsWithGuest, tableDatum, boxData, colorScheme);
  renderGuestBoxes(group, seatsWithGuest, boxData, selectedMealPlanIndex, colorScheme);
}