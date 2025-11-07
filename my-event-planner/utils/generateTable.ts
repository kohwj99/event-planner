// utils/generateTable.ts - UPDATED
import { Table } from "@/types/Table";
import { Seat } from "@/types/Seat";

/**
 * Create a round table with custom seat ordering and adjacency tracking
 */
export function createRoundTable(
  id: string,
  centerX: number,
  centerY: number,
  radius: number,
  seatCount: number,
  label: string,
  seatOrdering?: number[] // NEW: Custom seat numbering
): Table {
  const seats: Seat[] = [];
  const seatRadius = 12;
  
  // Scale table radius based on seat count
  const baseRadius = 60;
  const scaledRadius = Math.max(baseRadius, baseRadius * Math.sqrt(seatCount / 8));
  const seatDistance = scaledRadius + Math.max(30, 20 + seatCount / 2);
  
  // Use custom ordering or default (1, 2, 3, ...)
  const ordering = seatOrdering || Array.from({ length: seatCount }, (_, i) => i + 1);
  
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
      label: `${ordering[i]}`, // Use custom ordering
      seatNumber: ordering[i], // Use custom ordering
      assignedGuestId: null,
      locked: false,
      selected: false,
      position: i, // Physical position (0-based)
      adjacentSeats, // Adjacent seat IDs
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
 * Create a rectangular table with custom seat ordering and adjacency tracking
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
  seatOrdering?: number[] // NEW: Custom seat numbering
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
  
  const totalSeats = top + right + bottom + left;
  const ordering = seatOrdering || Array.from({ length: totalSeats }, (_, i) => i + 1);
  
  let seatCount = 0; // Overall seat counter
  let positionIndex = 0; // Physical position index

  // Helper to calculate positions
  const calculateSeatPositions = (count: number, totalLength: number): number[] => {
    if (count === 0) return [];
    const spacing = totalLength / (count + 1);
    return Array.from({ length: count }, (_, i) => spacing * (i + 1));
  };

  // Helper to add seats with adjacency
  const addSeats = (
    positions: { x: number; y: number }[],
    startCount: number
  ) => {
    positions.forEach((pos, idx) => {
      const currentPosition = positionIndex;
      
      // Calculate adjacent seats
      const adjacentSeats: string[] = [];
      
      // Previous seat in sequence (if not first seat overall)
      if (positionIndex > 0) {
        adjacentSeats.push(`${id}-seat-${positionIndex}`);
      }
      
      // Next seat in sequence (if not last seat overall)
      if (positionIndex < totalSeats - 1) {
        adjacentSeats.push(`${id}-seat-${positionIndex + 2}`);
      }
      
      // For rectangular tables, first and last seats are adjacent (closing the loop)
      if (positionIndex === 0) {
        adjacentSeats.push(`${id}-seat-${totalSeats}`);
      }
      if (positionIndex === totalSeats - 1) {
        adjacentSeats.push(`${id}-seat-1`);
      }
      
      seats.push({
        id: `${id}-seat-${seatCount + 1}`,
        x: pos.x,
        y: pos.y,
        radius: seatRadius,
        label: `${ordering[positionIndex]}`,
        seatNumber: ordering[positionIndex],
        assignedGuestId: null,
        locked: false,
        selected: false,
        position: positionIndex,
        adjacentSeats,
      });
      
      seatCount++;
      positionIndex++;
    });
  };

  // Top edge (left to right)
  const topPositions = calculateSeatPositions(top, width).map((offset) => ({
    x: centerX - width / 2 + offset,
    y: centerY - height / 2 - padding,
  }));
  addSeats(topPositions, seatCount);

  // Right edge (top to bottom)
  const rightPositions = calculateSeatPositions(right, height).map((offset) => ({
    x: centerX + width / 2 + padding,
    y: centerY - height / 2 + offset,
  }));
  addSeats(rightPositions, seatCount);

  // Bottom edge (right to left)
  const bottomPositions = calculateSeatPositions(bottom, width).map((offset) => ({
    x: centerX + width / 2 - offset,
    y: centerY + height / 2 + padding,
  }));
  addSeats(bottomPositions, seatCount);

  // Left edge (bottom to top)
  const leftPositions = calculateSeatPositions(left, height).map((offset) => ({
    x: centerX - width / 2 - padding,
    y: centerY + height / 2 - offset,
  }));
  addSeats(leftPositions, seatCount);

  return {
    id,
    x: centerX,
    y: centerY,
    radius: Math.sqrt((width / 2 + padding) ** 2 + (height / 2 + padding) ** 2),
    label,
    shape: "rectangle",
    seats,
    width,
    height,
  };
}