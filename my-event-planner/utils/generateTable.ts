// utils/generateTable.ts - UPDATED WITH SEAT MODE SUPPORT
import { Table } from "@/types/Table";
import { Seat, SeatMode } from "@/types/Seat";

/**
 * Create a round table with custom seat ordering, adjacency tracking, and seat modes
 */
export function createRoundTable(
  id: string,
  centerX: number,
  centerY: number,
  radius: number,
  seatCount: number,
  label: string,
  seatOrdering?: number[], // Custom seat numbering
  seatModes?: SeatMode[] // NEW: Custom seat modes
): Table {
  const seats: Seat[] = [];
  const seatRadius = 12;
  
  // Scale table radius based on seat count
  const baseRadius = 60;
  const scaledRadius = Math.max(baseRadius, baseRadius * Math.sqrt(seatCount / 8));
  const seatDistance = scaledRadius + Math.max(30, 20 + seatCount / 2);
  
  // Use custom ordering or default (1, 2, 3, ...)
  const ordering = seatOrdering || Array.from({ length: seatCount }, (_, i) => i + 1);
  
  // Use custom modes or default ('default' for all)
  const modes = seatModes || Array.from({ length: seatCount }, () => 'default' as SeatMode);
  
  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2; // start top, clockwise
    const x = centerX + Math.cos(angle) * seatDistance;
    const y = centerY + Math.sin(angle) * seatDistance;
    
    // Calculate adjacent seats (previous and next in circle)
    const prevIndex = (i - 1 + seatCount) % seatCount;
    const nextIndex = (i + 1) % seatCount;
    const adjacentSeats = [
      `${id}-seat-${prevIndex + 1}`,
      `${id}-seat-${nextIndex + 1}`,
    ];
    
    seats.push({
      id: `${id}-seat-${i + 1}`,
      x,
      y,
      radius: seatRadius,
      label: `${ordering[i]}`,
      seatNumber: ordering[i],
      assignedGuestId: null,
      locked: false,
      selected: false,
      position: i,
      adjacentSeats,
      mode: modes[i] || 'default', // NEW: Apply seat mode
    });
  }

  return {
    id,
    x: centerX,
    y: centerY,
    radius: scaledRadius,
    label,
    shape: "round",
    seats,
  };
}

/**
 * Create a rectangular table with custom seat ordering, adjacency tracking, and seat modes
 */
export function createRectangleTable(
  id: string,
  centerX: number,
  centerY: number,
  top: number,
  bottom: number,
  left: number,
  right: number,
  label: string,
  seatOrdering?: number[], // Custom seat numbering
  seatModes?: SeatMode[] // NEW: Custom seat modes
): Table {
  const seats: Seat[] = [];
  const seatRadius = 12;
  
  // Calculate dimensions based on seat counts
  const minSeatSpacing = 40;
  const padding = 30;
  
  const horizontalSeats = Math.max(top, bottom);
  const width = horizontalSeats > 0 
    ? Math.max(160, horizontalSeats * minSeatSpacing + 2 * padding) 
    : 160;
  
  const verticalSeats = Math.max(left, right);
  const height = verticalSeats > 0 
    ? Math.max(100, verticalSeats * minSeatSpacing + 2 * padding) 
    : 100;
  
  const totalSeats = top + bottom + left + right;
  
  // Use custom ordering or default
  const ordering = seatOrdering || Array.from({ length: totalSeats }, (_, i) => i + 1);
  
  // Use custom modes or default
  const modes = seatModes || Array.from({ length: totalSeats }, () => 'default' as SeatMode);
  
  const seatOffset = seatRadius * 2.5;
  let seatIndex = 0;
  
  // Helper to push seats with position tracking
  const pushSeat = (x: number, y: number) => {
    if (seatIndex >= totalSeats) return;
    
    seats.push({
      id: `${id}-seat-${seatIndex + 1}`,
      x,
      y,
      radius: seatRadius,
      label: `${ordering[seatIndex]}`,
      seatNumber: ordering[seatIndex],
      assignedGuestId: null,
      locked: false,
      selected: false,
      position: seatIndex,
      adjacentSeats: [], // Will be computed below
      mode: modes[seatIndex] || 'default', // NEW: Apply seat mode
    });
    seatIndex++;
  };
  
  // Top seats (left to right)
  if (top > 0) {
    const spacing = width / (top + 1);
    for (let i = 0; i < top; i++) {
      const x = centerX - width / 2 + spacing * (i + 1);
      const y = centerY - height / 2 - seatOffset;
      pushSeat(x, y);
    }
  }
  
  // Right seats (top to bottom)
  if (right > 0) {
    const spacing = height / (right + 1);
    for (let i = 0; i < right; i++) {
      const x = centerX + width / 2 + seatOffset;
      const y = centerY - height / 2 + spacing * (i + 1);
      pushSeat(x, y);
    }
  }
  
  // Bottom seats (right to left)
  if (bottom > 0) {
    const spacing = width / (bottom + 1);
    for (let i = 0; i < bottom; i++) {
      const x = centerX + width / 2 - spacing * (i + 1);
      const y = centerY + height / 2 + seatOffset;
      pushSeat(x, y);
    }
  }
  
  // Left seats (bottom to top)
  if (left > 0) {
    const spacing = height / (left + 1);
    for (let i = 0; i < left; i++) {
      const x = centerX - width / 2 - seatOffset;
      const y = centerY + height / 2 - spacing * (i + 1);
      pushSeat(x, y);
    }
  }
  
  // Compute adjacency for rectangle tables
  for (let i = 0; i < seats.length; i++) {
    const prevIndex = (i - 1 + seats.length) % seats.length;
    const nextIndex = (i + 1) % seats.length;
    seats[i].adjacentSeats = [
      seats[prevIndex].id,
      seats[nextIndex].id,
    ];
  }

  return {
    id,
    x: centerX,
    y: centerY,
    radius: 0,
    label,
    shape: "rectangle",
    width,
    height,
    seats,
  };
}