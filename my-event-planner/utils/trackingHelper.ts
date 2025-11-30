/**
 * Tracking Helper Functions
 * 
 * Provides utilities for analyzing Boss Adjacency tracking data
 * 
 * NOTE: All tracking data is now stored in eventStore.
 * These helpers use eventStore directly for better consistency.
 */

import { useEventStore } from "@/store/eventStore";
import { Guest } from "@/store/guestStore";

/* -------------------- 📊 ANALYSIS FUNCTIONS -------------------- */

/**
 * Gets a summary of historical adjacencies for a tracked guest
 * Includes guest details and formatted counts
 */
export function getTrackedGuestAdjacencySummary(
  eventId: string,
  upToSessionId: string,
  trackedGuestId: string,
  allGuests: Guest[]
): Array<{
  guest: Guest;
  count: number;
  percentage: number;
}> {
  const store = useEventStore.getState();
  const history = store.getTrackedGuestHistory(eventId, upToSessionId, trackedGuestId);
  
  if (history.length === 0) return [];

  // Calculate total adjacencies for percentage
  const totalAdjacencies = history.reduce((sum, h) => sum + h.count, 0);

  // Map guest IDs to guest objects
  const guestMap = new Map(allGuests.map(g => [g.id, g]));

  return history
    .map(h => {
      const guest = guestMap.get(h.guestId);
      if (!guest) return null;

      return {
        guest,
        count: h.count,
        percentage: Math.round((h.count / totalAdjacencies) * 100),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * Checks if a tracked guest has exceeded adjacency threshold with any guest
 */
export function checkAdjacencyThreshold(
  eventId: string,
  upToSessionId: string,
  trackedGuestId: string,
  threshold: number = 2
): Array<{ guestId: string; count: number; exceeded: boolean }> {
  const store = useEventStore.getState();
  const adjacencyCount = store.getHistoricalAdjacencyCount(eventId, upToSessionId, trackedGuestId);

  return Object.entries(adjacencyCount).map(([guestId, count]) => ({
    guestId,
    count,
    exceeded: count >= threshold,
  }));
}

/**
 * Gets guests who should be avoided for a tracked guest in the next session
 * (those who have sat adjacent >= threshold times)
 */
export function getGuestsToAvoid(
  eventId: string,
  upToSessionId: string,
  trackedGuestId: string,
  threshold: number = 2
): string[] {
  const checks = checkAdjacencyThreshold(eventId, upToSessionId, trackedGuestId, threshold);
  return checks.filter(c => c.exceeded).map(c => c.guestId);
}

/**
 * Gets all tracked guests with their adjacency warnings for a session
 */
export function getAllTrackedGuestsWarnings(
  eventId: string,
  upToSessionId: string,
  threshold: number = 2
): Map<string, string[]> {
  const store = useEventStore.getState();
  const trackedGuests = store.getTrackedGuests(eventId);
  
  const warnings = new Map<string, string[]>();

  trackedGuests.forEach(trackedGuestId => {
    const guestsToAvoid = getGuestsToAvoid(eventId, upToSessionId, trackedGuestId, threshold);
    if (guestsToAvoid.length > 0) {
      warnings.set(trackedGuestId, guestsToAvoid);
    }
  });

  return warnings;
}

/**
 * Validates a proposed seating arrangement against adjacency rules
 * Returns warnings for tracked guests sitting next to guests they've sat with too many times
 */
export function validateSeatingAgainstHistory(
  eventId: string,
  currentSessionId: string,
  proposedAdjacencies: Map<string, string[]>, // trackedGuestId -> adjacent guest IDs
  threshold: number = 2
): Array<{
  trackedGuestId: string;
  adjacentGuestId: string;
  historicalCount: number;
  violation: boolean;
}> {
  const store = useEventStore.getState();
  const warnings: Array<{
    trackedGuestId: string;
    adjacentGuestId: string;
    historicalCount: number;
    violation: boolean;
  }> = [];

  proposedAdjacencies.forEach((adjacentGuestIds, trackedGuestId) => {
    const historicalCounts = store.getHistoricalAdjacencyCount(
      eventId,
      currentSessionId,
      trackedGuestId
    );

    adjacentGuestIds.forEach(adjacentGuestId => {
      const count = historicalCounts[adjacentGuestId] || 0;
      const violation = count >= threshold;

      if (count > 0) {
        warnings.push({
          trackedGuestId,
          adjacentGuestId,
          historicalCount: count,
          violation,
        });
      }
    });
  });

  return warnings.sort((a, b) => b.historicalCount - a.historicalCount);
}

/**
 * Gets a report of all adjacencies in the event so far
 */
export function getEventAdjacencyReport(eventId: string): {
  totalSessions: number;
  trackedSessionCount: number;
  guestReports: Array<{
    trackedGuestId: string;
    totalAdjacencies: number;
    uniqueGuests: number;
    topAdjacencies: Array<{ guestId: string; count: number }>;
  }>;
} {
  const store = useEventStore.getState();
  const allRecords = store.getEventAdjacencyRecords(eventId);
  const trackedGuests = store.getTrackedGuests(eventId);

  // Count unique sessions
  const uniqueSessions = new Set(allRecords.map(r => r.sessionId));

  const guestReports = trackedGuests.map(trackedGuestId => {
    const guestRecords = allRecords.filter(r => r.trackedGuestId === trackedGuestId);
    
    const adjacencyCount: Record<string, number> = {};
    let totalAdjacencies = 0;

    guestRecords.forEach(record => {
      record.adjacentGuestIds.forEach(guestId => {
        adjacencyCount[guestId] = (adjacencyCount[guestId] || 0) + 1;
        totalAdjacencies++;
      });
    });

    const topAdjacencies = Object.entries(adjacencyCount)
      .map(([guestId, count]) => ({ guestId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    return {
      trackedGuestId,
      totalAdjacencies,
      uniqueGuests: Object.keys(adjacencyCount).length,
      topAdjacencies,
    };
  });

  return {
    totalSessions: uniqueSessions.size,
    trackedSessionCount: uniqueSessions.size,
    guestReports,
  };
}

/**
 * Exports adjacency data to a format suitable for CSV/Excel export
 */
export function exportAdjacencyDataForEvent(
  eventId: string,
  allGuests: Guest[]
): Array<{
  sessionId: string;
  sessionStartTime: string;
  trackedGuestName: string;
  trackedGuestCompany: string;
  adjacentGuestName: string;
  adjacentGuestCompany: string;
}> {
  const store = useEventStore.getState();
  const allRecords = store.getEventAdjacencyRecords(eventId);
  const guestMap = new Map(allGuests.map(g => [g.id, g]));

  const exportData: Array<{
    sessionId: string;
    sessionStartTime: string;
    trackedGuestName: string;
    trackedGuestCompany: string;
    adjacentGuestName: string;
    adjacentGuestCompany: string;
  }> = [];

  allRecords.forEach(record => {
    const trackedGuest = guestMap.get(record.trackedGuestId);
    if (!trackedGuest) return;

    record.adjacentGuestIds.forEach(adjacentGuestId => {
      const adjacentGuest = guestMap.get(adjacentGuestId);
      if (!adjacentGuest) return;

      exportData.push({
        sessionId: record.sessionId,
        sessionStartTime: record.sessionStartTime,
        trackedGuestName: trackedGuest.name,
        trackedGuestCompany: trackedGuest.company,
        adjacentGuestName: adjacentGuest.name,
        adjacentGuestCompany: adjacentGuest.company,
      });
    });
  });

  return exportData;
}