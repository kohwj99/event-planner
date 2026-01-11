import { Guest } from "@/store/guestStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";

// Shared list of types
export type EventType = 
  | "Executive meeting" 
  | "Bilateral Meeting" 
  | "Meal" 
  | "Phototaking";

/* -------------------- 📜 ADJACENCY TRACKING TYPES -------------------- */

/**
 * Type of adjacency relationship for Boss Tracking
 */
export type AdjacencyType = "side" | "opposite" | "edge";

/**
 * Detailed adjacency info for a single guest
 */
export interface AdjacencyDetail {
  guestId: string;
  adjacencyType: AdjacencyType;
}

/**
 * Record of which guests were adjacent to a tracked guest in a specific session
 */
export interface SessionAdjacencyRecord {
  sessionId: string;
  sessionStartTime: string;
  /** Full datetime combining day date + session start time for chronological ordering (ISO string) */
  sessionDateTime: string;
  planningOrder: number;
  trackedGuestId: string;
  /** @deprecated Use adjacentGuestDetails instead for type information */
  adjacentGuestIds: string[];
  /** Enhanced adjacency with type information (side/opposite/edge) */
  adjacentGuestDetails?: AdjacencyDetail[];
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

/* -------------------- 🎯 AUTOFILL RULES TYPES -------------------- */

/**
 * Sort field options for guest ordering
 */
export type SortField = "name" | "country" | "organization" | "ranking";

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";

/**
 * A single sorting rule
 */
export interface SortRule {
  field: SortField;
  direction: SortDirection;
}

/**
 * Table ratio rule configuration
 */
export interface RatioRule {
  enabled: boolean;
  hostRatio: number;
  externalRatio: number;
}

/**
 * Table spacing rule configuration
 */
export interface SpacingRule {
  enabled: boolean;
  spacing: number;
  startWithExternal: boolean;
}

/**
 * Combined table assignment rules
 */
export interface TableRules {
  ratioRule: RatioRule;
  spacingRule: SpacingRule;
}

/**
 * Sit together proximity rule
 */
export interface SitTogetherRule {
  id: string;
  guest1Id: string;
  guest2Id: string;
  isFromRecommendation?: boolean;
}

/**
 * Sit away proximity rule
 */
export interface SitAwayRule {
  id: string;
  guest1Id: string;
  guest2Id: string;
}

/**
 * Combined proximity rules
 */
export interface ProximityRules {
  sitTogether: SitTogetherRule[];
  sitAway: SitAwayRule[];
}

/**
 * Guest list selection configuration
 */
export interface GuestListSelection {
  includeHost: boolean;
  includeExternal: boolean;
}

/**
 * Complete session rules configuration - stored with each session
 * This allows rules to persist when navigating between sessions
 */
export interface SessionRulesConfig {
  /** Which guest lists to include in autofill */
  guestListSelection: GuestListSelection;
  
  /** Sorting rules for guest ordering */
  sortRules: SortRule[];
  
  /** Table assignment rules (ratio, spacing) */
  tableRules: TableRules;
  
  /** Proximity rules (sit together, sit away) */
  proximityRules: ProximityRules;
  
  /** Timestamp when rules were last modified */
  lastModified?: string;
}

/**
 * Default session rules configuration
 */
export const DEFAULT_SESSION_RULES: SessionRulesConfig = {
  guestListSelection: {
    includeHost: true,
    includeExternal: true,
  },
  sortRules: [
    { field: 'ranking', direction: 'asc' },
  ],
  tableRules: {
    ratioRule: {
      enabled: false,
      hostRatio: 50,
      externalRatio: 50,
    },
    spacingRule: {
      enabled: false,
      spacing: 1,
      startWithExternal: false,
    },
  },
  proximityRules: {
    sitTogether: [],
    sitAway: [],
  },
};

/**
 * Proximity violation stored with session
 */
export interface StoredProximityViolation {
  type: 'sit-together' | 'sit-away';
  guest1Id: string;
  guest2Id: string;
  guest1Name: string;
  guest2Name: string;
  tableId: string;
  tableLabel: string;
  seat1Id?: string;
  seat2Id?: string;
  reason?: string;
}

/* -------------------- 📅 SESSION & DAY TYPES -------------------- */

export interface Session {
  id: string;
  name: string;
  description: string;
  sessionType: EventType; // Specific type for the session
  startTime: string;      // ISO string
  endTime: string;        // ISO string
  
  // 🎯 Session-level guest inheritance
  inheritedHostGuestIds: string[];     // IDs from masterHostGuests
  inheritedExternalGuestIds: string[]; // IDs from masterExternalGuests
  
  // Statistics Tracking
  lastModified?: string;    
  lastStatsCheck?: string;  

  // 🎯 Boss Adjacency Tracking Metadata
  isTrackedForAdjacency?: boolean;  // Whether this session is tracked
  planningOrder?: number;            // Order in which this was planned (1, 2, 3...)
  needsAdjacencyReview?: boolean;   // Flag if upstream session changed

  seatPlan: {
    tables: Table[];
    chunks: Record<string, Chunk>;
    activeGuestIds: string[];
    selectedMealPlanIndex?: number | null; // null = None, 0 = Meal Plan 1, etc.
  };
  
  // 🆕 Session Rules Configuration - persists autofill settings
  rulesConfig?: SessionRulesConfig;
  
  // 🆕 Stored violations - persists violations for display on session load
  storedViolations?: StoredProximityViolation[];
}

export interface EventDay {
  id: string;
  date: string; // ISO string (The column date)
  sessions: Session[];
}

/* -------------------- 🏯 EVENT TYPE -------------------- */

export interface Event {
  id: string;
  name: string;
  description: string;
  eventType: EventType; // The overall event category
  startDate: string;    // The starting date of the event
  createdAt: string;
  
  masterHostGuests: Guest[];
  masterExternalGuests: Guest[];
  
  // 🎯 Boss Adjacency Tracking Configuration (CONSOLIDATED)
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

/**
 * Helper to ensure a session has rules config (for migration)
 */
export function ensureSessionRulesConfig(session: Session): Session {
  return {
    ...session,
    rulesConfig: session.rulesConfig ?? { ...DEFAULT_SESSION_RULES },
    storedViolations: session.storedViolations ?? [],
  };
}

/**
 * Helper to migrate all sessions in an event to have rules config
 */
export function migrateEventSessionRules(event: Event): Event {
  return {
    ...event,
    days: event.days.map(day => ({
      ...day,
      sessions: day.sessions.map(session => ensureSessionRulesConfig(session)),
    })),
  };
}