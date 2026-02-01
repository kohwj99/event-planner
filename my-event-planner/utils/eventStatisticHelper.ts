import { Session } from "@/types/Event";
import { Guest } from "@/store/guestStore";

// Interface for the result
export interface AdjacencyMap {
  // Key: External Guest ID -> Value: Number of times sat next to ANY Host Rank 1
  [externalGuestId: string]: {
    count: number;
    sessions: string[]; // Names of sessions where this happened
  };
}

export const calculateVIPExposure = (
  sessions: Session[],
  allGuests: Record<string, Guest> // Map for fast lookup
): AdjacencyMap => {
  const stats: AdjacencyMap = {};

  // Helper to record an interaction
  const recordHit = (extId: string, sessName: string) => {
    if (!stats[extId]) stats[extId] = { count: 0, sessions: [] };
    stats[extId].count++;
    stats[extId].sessions.push(sessName);
  };

  // 1. Iterate Chronologically
  // We sort by session start time to ensure history is linear
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  for (const session of sortedSessions) {
    if (!session.seatPlan) continue;

    for (const table of session.seatPlan.tables) {
      const seats = table.seats;
      if (seats.length < 2) continue;

      // Check neighbors (Standard Circular Logic)
      for (let i = 0; i < seats.length; i++) {
        const currentSeat = seats[i];
        const nextSeat = seats[(i + 1) % seats.length]; // Right neighbor

        const g1 = currentSeat.assignedGuestId ? allGuests[currentSeat.assignedGuestId] : null;
        const g2 = nextSeat.assignedGuestId ? allGuests[nextSeat.assignedGuestId] : null;

        if (!g1 || !g2) continue;

        // Check Pair: G1 is Host VIP, G2 is Ext VIP
        if (isHostVIP(g1) && isExtVIP(g2)) recordHit(g2.id, session.name);
        
        // Check Pair: G2 is Host VIP, G1 is Ext VIP
        if (isHostVIP(g2) && isExtVIP(g1)) recordHit(g1.id, session.name);
      }
    }
  }

  return stats;
};

const isHostVIP = (g: Guest) => g.fromHost && g.ranking === 1;
const isExtVIP = (g: Guest) => !g.fromHost && g.ranking <= 4;