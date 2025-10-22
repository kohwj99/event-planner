import { Table } from "@/store/seatStore";

export function createRoundTable(
  id: string,
  centerX: number,
  centerY: number,
  radius: number,
  seatCount: number,
  label: string
): Table {
  const seats = [];
  const seatRadius = 12;
  
  // Scale table radius based on seat count
  // Base size for 8 seats, scale up for more
  const baseRadius = 60;
  const scaledRadius = Math.max(baseRadius, baseRadius * Math.sqrt(seatCount / 8));
  const seatDistance = scaledRadius + Math.max(30, 20 + seatCount/2); // Increase spacing for larger tables
  
  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2; // start top, clockwise
    const x = centerX + Math.cos(angle) * seatDistance;
    const y = centerY + Math.sin(angle) * seatDistance;
    seats.push({
      id: `${id}-seat-${i + 1}`,
      x,
      y,
      radius: seatRadius,
      label: `${i + 1}`,
      seatNumber: i + 1,
      assignedGuestId: null,
      locked: false,
      selected: false,
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

export function createRectangleTable(
  id: string,
  centerX: number,
  centerY: number,
  top: number,
  bottom: number,
  left: number,
  right: number,
  label: string
): Table {
  const seats = [];
  const seatRadius = 12;
  
  // Calculate dimensions based on seat counts
  const minSeatSpacing = 40; // Minimum space between seats
  const padding = 30; // Space between seats and table edge
  
  // Width based on the longer of top/bottom sides
  const horizontalSeats = Math.max(top, bottom);
  const width = horizontalSeats > 0 
    ? Math.max(160, horizontalSeats * minSeatSpacing + 2 * padding) 
    : 160;
  
  // Height based on the longer of left/right sides
  const verticalSeats = Math.max(left, right);
  const height = verticalSeats > 0 
    ? Math.max(100, verticalSeats * minSeatSpacing + 2 * padding)
    : 100;
  
  let seatCount = 1;

  // Helper function to calculate seat positions with even spacing
  const calculateSeatPositions = (count: number, totalLength: number): number[] => {
    if (count === 0) return [];
    const spacing = totalLength / (count + 1);
    return Array.from({ length: count }, (_, i) => spacing * (i + 1));
  };

  // Top edge
  const topPositions = calculateSeatPositions(top, width);
  for (let i = 0; i < top; i++) {
    seats.push({
      id: `${id}-seat-${seatCount}`,
      x: centerX - width/2 + topPositions[i],
      y: centerY - height/2 - padding,
      radius: seatRadius,
      label: `${seatCount}`,
      seatNumber: seatCount,
      assignedGuestId: null,
      locked: false,
      selected: false,
    });
    seatCount++;
  }

  // Bottom edge
  const bottomPositions = calculateSeatPositions(bottom, width);
  for (let i = 0; i < bottom; i++) {
    seats.push({
      id: `${id}-seat-${seatCount}`,
      x: centerX - width/2 + bottomPositions[i],
      y: centerY + height/2 + padding,
      radius: seatRadius,
      label: `${seatCount}`,
      seatNumber: seatCount,
      assignedGuestId: null,
      locked: false,
      selected: false,
    });
    seatCount++;
  }

  // Left edge
  const leftPositions = calculateSeatPositions(left, height);
  for (let i = 0; i < left; i++) {
    seats.push({
      id: `${id}-seat-${seatCount}`,
      x: centerX - width/2 - padding,
      y: centerY - height/2 + leftPositions[i],
      radius: seatRadius,
      label: `${seatCount}`,
      seatNumber: seatCount,
      assignedGuestId: null,
      locked: false,
      selected: false,
    });
    seatCount++;
  }

  // Right edge
  const rightPositions = calculateSeatPositions(right, height);
  for (let i = 0; i < right; i++) {
    seats.push({
      id: `${id}-seat-${seatCount}`,
      x: centerX + width/2 + padding,
      y: centerY - height/2 + rightPositions[i],
      radius: seatRadius,
      label: `${seatCount}`,
      seatNumber: seatCount,
      assignedGuestId: null,
      locked: false,
      selected: false,
    });
    seatCount++;
  }

  return {
    id,
    x: centerX,
    y: centerY,
    radius: Math.sqrt((width/2 + padding)**2 + (height/2 + padding)**2), // for collision detection
    label,
    shape: "rectangle",
    seats,
    width,
    height,
  };
}
