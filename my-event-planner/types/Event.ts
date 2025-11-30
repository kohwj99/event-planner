import { Guest } from "@/store/guestStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";

// Shared list of types
export type EventType = 
  | "Executive meeting" 
  | "Bilateral Meeting" 
  | "Meal" 
  | "Phototaking";

/* -------------------- 📊 ADJACENCY TRACKING TYPES -------------------- */

/**
 * Record of which guests were adjacent to a tracked guest in a specific session
 */
export interface SessionAdjacencyRecord {
  sessionId: string;
  sessionStartTime: string;
  planningOrder: number;
  trackedGuestId: string;
  adjacentGuestIds: string[];
  needsReview?: boolean;
}

/**
 * Tracks the order in which sessions were planned (for adjacency analysis)
 */
export interface PlanningOrderTracker {
  sessionOrderMap: Record<string, number>;
  nextOrder: number;
}

/**
 * Default values for event tracking fields (for migration/initialization)
 */
export const DEFAULT_EVENT_TRACKING = {
  trackedGuestIds: [] as string[],
  trackingEnabled: false,
  adjacencyRecords: [] as SessionAdjacencyRecord[],
  planningOrderTracker: {
    sessionOrderMap: {},
    nextOrder: 1,
  } as PlanningOrderTracker,
};

/* -------------------- 📅 SESSION & DAY TYPES -------------------- */

export interface Session {
  id: string;
  name: string;
  description: string;
  sessionType: EventType; // Specific type for the session
  startTime: string;      // ISO string
  endTime: string;        // ISO string
  
  // 🆕 Session-level guest inheritance
  inheritedHostGuestIds: string[];     // IDs from masterHostGuests
  inheritedExternalGuestIds: string[]; // IDs from masterExternalGuests
  
  // Statistics Tracking
  lastModified?: string;    
  lastStatsCheck?: string;  

  // 🆕 Boss Adjacency Tracking Metadata
  isTrackedForAdjacency?: boolean;  // Whether this session is tracked
  planningOrder?: number;            // Order in which this was planned (1, 2, 3...)
  needsAdjacencyReview?: boolean;   // Flag if upstream session changed

  seatPlan: {
    tables: Table[];
    chunks: Record<string, Chunk>;
    activeGuestIds: string[];
  };
}

export interface EventDay {
  id: string;
  date: string; // ISO string (The column date)
  sessions: Session[];
}

/* -------------------- 🎯 EVENT TYPE -------------------- */

export interface Event {
  id: string;
  name: string;
  description: string;
  eventType: EventType; // The overall event category
  startDate: string;    // The starting date of the event
  createdAt: string;
  
  masterHostGuests: Guest[];
  masterExternalGuests: Guest[];
  
  // 🆕 Boss Adjacency Tracking Configuration (CONSOLIDATED)
  trackedGuestIds?: string[];                    // IDs of guests being tracked
  trackingEnabled?: boolean;                     // Whether tracking is enabled for this event
  adjacencyRecords?: SessionAdjacencyRecord[];   // All historical adjacency data
  planningOrderTracker?: PlanningOrderTracker;   // Session planning order management
  
  days: EventDay[];
}

/**
 * Helper to ensure an event has all tracking fields (for migration)
 */
export function ensureTrackingFields(event: Event): Event {
  return {
    ...event,
    trackedGuestIds: event.trackedGuestIds ?? DEFAULT_EVENT_TRACKING.trackedGuestIds,
    trackingEnabled: event.trackingEnabled ?? DEFAULT_EVENT_TRACKING.trackingEnabled,
    adjacencyRecords: event.adjacencyRecords ?? DEFAULT_EVENT_TRACKING.adjacencyRecords,
    planningOrderTracker: event.planningOrderTracker ?? DEFAULT_EVENT_TRACKING.planningOrderTracker,
  };
}