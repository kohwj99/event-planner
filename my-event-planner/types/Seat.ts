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

    // NEW: independent guest box position
  textX?: number;
  textY?: number;
}
