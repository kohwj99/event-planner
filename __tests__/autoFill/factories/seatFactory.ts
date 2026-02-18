import { SeatMode } from '@/types/Seat';

interface SeatOverrides {
  id?: string;
  seatNumber?: number;
  adjacentSeats?: string[];
  locked?: boolean;
  assignedGuestId?: string | null;
  mode?: SeatMode;
  x?: number;
  y?: number;
  position?: number;
}

let seatCounter = 0;

export function createSeat(overrides: SeatOverrides = {}) {
  seatCounter++;
  const num = overrides.seatNumber ?? seatCounter;
  return {
    id: overrides.id ?? `seat-${num}`,
    x: overrides.x ?? num * 50,
    y: overrides.y ?? 0,
    radius: 20,
    label: `Seat ${num}`,
    seatNumber: num,
    assignedGuestId: overrides.assignedGuestId ?? null,
    locked: overrides.locked ?? false,
    adjacentSeats: overrides.adjacentSeats ?? [],
    position: overrides.position ?? num - 1,
    mode: overrides.mode ?? ('default' as SeatMode),
  };
}

export function resetSeatCounter() {
  seatCounter = 0;
}
