// types/Event.ts
// Updated with Drawing Layer Support

import { Guest } from "@/store/guestStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";
import { DrawingLayerState, DEFAULT_DRAWING_LAYER_STATE } from "@/types/DrawingShape";

// Shared list of types
export type EventType = 
  | "Executive meeting" 
  | "Bilateral Meeting" 
  | "Meal" 
  | "Phototaking";

/* -------------------- SESSION UI SETTINGS -------------------- */

/**
 * UI Settings that are persisted per session
 * These control the canvas display preferences
 */
export interface SessionUISettings {
  /** Gap between table and connector lines */
  connectorGap: number;
  /** Whether to hide table body shapes */
  hideTableBodies: boolean;
  /** Photo mode - cleaner export view */
  isPhotoMode: boolean;
  /** Colorblind-friendly color scheme */
  isColorblindMode: boolean;
  /** Canvas zoom level */
  zoomLevel: number;
  /** Canvas pan X position */
  panX?: number;
  /** Canvas pan Y position */
  panY?: number;
}

/**
 * Default UI settings for new sessions
 */
export const DEFAULT_SESSION_UI_SETTINGS: SessionUISettings = {
  connectorGap: 8,
  hideTableBodies: false,
  isPhotoMode: false,
  isColorblindMode: false,
  zoomLevel: 1,
  panX: 0,
  panY: 0,
};

/* -------------------- ADJACENCY TRACKING TYPES -------------------- */

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

/* -------------------- AUTOFILL RULES TYPES -------------------- */

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

/* -------------------- RANDOMIZE ORDER TYPES -------------------- */

/**
 * Randomize partition for shuffling guests within rank ranges
 */
export interface RandomizePartition {
  id: string;
  minRank: number;
  maxRank: number;
}

/**
 * Randomize order configuration
 */
export interface RandomizeOrderConfig {
  enabled: boolean;
  partitions: RandomizePartition[];
}

/**
 * Default randomize order configuration
 */
export const DEFAULT_RANDOMIZE_ORDER: RandomizeOrderConfig = {
  enabled: false,
  partitions: [],
};

/**
 * Complete session rules configuration
 */
export interface SessionRulesConfig {
  guestListSelection: GuestListSelection;
  sortRules: SortRule[];
  tableRules: TableRules;
  proximityRules: ProximityRules;
  randomizeOrder?: RandomizeOrderConfig;
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
  randomizeOrder: {
    enabled: false,
    partitions: [],
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

/* -------------------- SESSION & DAY TYPES -------------------- */

export interface Session {
  id: string;
  name: string;
  description: string;
  sessionType: EventType;
  startTime: string;
  endTime: string;
  
  // Session-level guest inheritance
  inheritedHostGuestIds: string[];
  inheritedExternalGuestIds: string[];
  
  // Statistics Tracking
  lastModified?: string;    
  lastStatsCheck?: string;  

  // Boss Adjacency Tracking Metadata
  isTrackedForAdjacency?: boolean;
  planningOrder?: number;
  needsAdjacencyReview?: boolean;

  // Session Lock State
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;

  seatPlan: {
    tables: Table[];
    chunks: Record<string, Chunk>;
    activeGuestIds: string[];
    selectedMealPlanIndex?: number | null;
    uiSettings?: SessionUISettings;
    isLocked?: boolean;
    /** NEW: Drawing layer data */
    drawingLayer?: DrawingLayerState;
  };
  
  // Session Rules Configuration
  rulesConfig?: SessionRulesConfig;
  
  // Stored violations
  storedViolations?: StoredProximityViolation[];
  
  /** NEW: Separate drawing layer storage for easy access */
  drawingLayerState?: DrawingLayerState;
}

export interface EventDay {
  id: string;
  date: string;
  sessions: Session[];
}

/* -------------------- EVENT TYPE -------------------- */

export interface Event {
  id: string;
  name: string;
  description: string;
  eventType: EventType;
  startDate: string;
  createdAt: string;
  
  masterHostGuests: Guest[];
  masterExternalGuests: Guest[];
  
  // Boss Adjacency Tracking Configuration
  trackedGuestIds?: string[];
  trackingEnabled?: boolean;
  adjacencyRecords?: SessionAdjacencyRecord[];
  planningOrderTracker?: PlanningOrderTracker;
  
  days: EventDay[];
}

/**
 * Helper to ensure an event has all tracking fields
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
 * Helper to ensure a session has rules config
 */
export function ensureSessionRulesConfig(session: Session): Session {
  return {
    ...session,
    rulesConfig: session.rulesConfig ?? { ...DEFAULT_SESSION_RULES },
    storedViolations: session.storedViolations ?? [],
    drawingLayerState: session.drawingLayerState ?? DEFAULT_DRAWING_LAYER_STATE,
  };
}

/**
 * Helper to migrate all sessions in an event
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

/**
 * Helper to ensure a session has drawing layer data
 */
export function ensureDrawingLayer(session: Session): Session {
  return {
    ...session,
    seatPlan: {
      ...session.seatPlan,
      drawingLayer: session.seatPlan.drawingLayer ?? DEFAULT_DRAWING_LAYER_STATE,
    },
    drawingLayerState: session.drawingLayerState ?? DEFAULT_DRAWING_LAYER_STATE,
  };
}