// types/Seat.ts - UPDATED WITH SEAT MODE
export type SeatMode = 'default' | 'host-only' | 'external-only';

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

  // Physical adjacency tracking
  adjacentSeats?: string[]; // Array of seat IDs that are physically next to this seat
  position?: number; // Physical position index (0-based, clockwise from top)

  // NEW: Seat mode for guest type restrictions
  mode?: SeatMode; // 'default' | 'host-only' | 'external-only'
}

// Helper type for seat mode display
export interface SeatModeConfig {
  mode: SeatMode;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  strokeColor: string;
}

// Seat mode configurations for UI
export const SEAT_MODE_CONFIGS: Record<SeatMode, SeatModeConfig> = {
  'default': {
    mode: 'default',
    label: 'Default',
    shortLabel: '',
    description: 'Any guest can be seated here',
    color: '#90caf9',
    strokeColor: '#1565c0',
  },
  'host-only': {
    mode: 'host-only',
    label: 'Host Only',
    shortLabel: 'H',
    description: 'Only host company guests can sit here',
    color: '#bbdefb',
    strokeColor: '#1976d2',
  },
  'external-only': {
    mode: 'external-only',
    label: 'External Only',
    shortLabel: 'E',
    description: 'Only external guests can sit here',
    color: '#FF8A80',
    strokeColor: '#E53935',
  },
};

export const LOCK_BADGE_CONFIG = {
  color: '#90A4AE',        
  strokeColor: '#455A64',  
  shortLabel: '🔒',         
};

/**
 * Check if a guest can be seated in a seat based on the seat's mode
 */
export function canGuestSitInSeat(
  guestFromHost: boolean,
  seatMode: SeatMode | undefined
): boolean {
  const mode = seatMode || 'default';
  
  switch (mode) {
    case 'default':
      return true;
    case 'host-only':
      return guestFromHost === true;
    case 'external-only':
      return guestFromHost === false;
    default:
      return true;
  }
}

/**
 * Get the appropriate seat modes for a guest type filter
 */
export function getSeatModesForGuestType(fromHost: boolean): SeatMode[] {
  if (fromHost) {
    return ['default', 'host-only'];
  } else {
    return ['default', 'external-only'];
  }
}