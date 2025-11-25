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
  
  days: EventDay[];
}