import { SeatMode } from '@/types/Seat';

let tableCounter = 0;

interface SeatOverrideEntry {
  mode?: SeatMode;
  locked?: boolean;
  assignedGuestId?: string | null;
}

interface TableOverrides {
  id?: string;
  label?: string;
  shape?: 'round' | 'rectangle';
  seatCount?: number;
  tableNumber?: number;
  seatOverrides?: Record<number, SeatOverrideEntry>;
}

/**
 * Creates a round table with N seats where each seat is adjacent to
 * its clockwise and counter-clockwise neighbors (circular adjacency).
 */
export function createRoundTable(overrides: TableOverrides = {}) {
  tableCounter++;
  const tableId = overrides.id ?? `table-${tableCounter}`;
  const seatCount = overrides.seatCount ?? 8;

  const seats = Array.from({ length: seatCount }, (_, i) => {
    const seatId = `${tableId}-seat-${i + 1}`;
    const seatOverride = overrides.seatOverrides?.[i] ?? {};
    return {
      id: seatId,
      x: Math.cos((2 * Math.PI * i) / seatCount) * 80,
      y: Math.sin((2 * Math.PI * i) / seatCount) * 80,
      radius: 20,
      label: `Seat ${i + 1}`,
      seatNumber: i + 1,
      assignedGuestId: seatOverride.assignedGuestId ?? null,
      locked: seatOverride.locked ?? false,
      adjacentSeats: [] as string[],
      position: i,
      mode: seatOverride.mode ?? ('default' as SeatMode),
    };
  });

  // Wire circular adjacency
  for (let i = 0; i < seats.length; i++) {
    const prev = (i - 1 + seats.length) % seats.length;
    const next = (i + 1) % seats.length;
    seats[i].adjacentSeats = [seats[prev].id, seats[next].id];
  }

  return {
    id: tableId,
    x: tableCounter * 300,
    y: 0,
    radius: 100,
    seats,
    label: overrides.label ?? `Table ${tableCounter}`,
    shape: (overrides.shape ?? 'round') as 'round' | 'rectangle',
    tableNumber: overrides.tableNumber ?? tableCounter,
  };
}

export function resetTableCounter() {
  tableCounter = 0;
}
