import { Guest } from "@/store/guestStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";

// Shared list of types
export type EventType = 
  | "Executive meeting" 
  | "Bilateral Meeting" 
  | "Meal" 
  | "Phototaking";

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

export interface Event {
  id: string;
  name: string;
  description: string;
  eventType: EventType; // The overall event category
  startDate: string;    // The starting date of the event
  createdAt: string;
  
  masterHostGuests: Guest[];
  masterExternalGuests: Guest[];
  
  // 🆕 Boss Adjacency Tracking Configuration
  trackedGuestIds?: string[];        // IDs of guests being tracked
  trackingEnabled?: boolean;         // Whether tracking is enabled for this event
  
  days: EventDay[];
}