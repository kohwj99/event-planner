// types/Seat.ts - UPDATED
export interface Seat {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  seatNumber: number;
  assignedGuestId?: string | null;
  locked?: boolean;
  selected?: boolean;

  // Guest box position
  textX?: number;
  textY?: number;

  // NEW: Physical adjacency tracking
  adjacentSeats?: string[]; // Array of seat IDs that are physically next to this seat
  position?: number; // Physical position index (0-based, clockwise from top)
}