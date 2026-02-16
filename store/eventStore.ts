import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  Event,
  EventDay,
  Session,
  EventType,
  SessionAdjacencyRecord,
  AdjacencyDetail,
  AdjacencyType,
  PlanningOrderTracker,
  DEFAULT_EVENT_TRACKING,
  ensureTrackingFields,
  // Import new types for session rules
  SessionRulesConfig,
  DEFAULT_SESSION_RULES,
  StoredProximityViolation,
  ProximityRules,
  SortRule,
  TableRules,
  GuestListSelection,
  // Import UI settings types
  SessionUISettings,
  DEFAULT_SESSION_UI_SETTINGS,
} from "@/types/Event";
import { Guest } from "@/store/guestStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";
import { calculateVIPExposure, AdjacencyMap } from "@/utils/eventStatisticHelper";
import { getEnhancedAdjacentSeats } from "@/utils/adjacencyHelper";

interface EventStoreState {
  /* -------------------- State -------------------- */
  events: Event[];
  activeEventId: string | null;
  activeSessionId: string | null;
  _hasHydrated: boolean;

  /* -------------------- Hydration -------------------- */
  setHasHydrated: (state: boolean) => void;

  /* -------------------- Event CRUD -------------------- */
  createEvent: (
    name: string,
    description: string,
    eventType: EventType,
    startDate: string
  ) => void;

  deleteEvent: (id: string) => void;
  updateEventDetails: (id: string, data: Partial<Event>) => void;
  setActiveEvent: (id: string | null) => void;
  setActiveSession: (sessionId: string | null) => void;

  /* -------------------- Master Guest List -------------------- */
  addMasterGuest: (eventId: string, guest: Guest) => void;

  /* -------------------- Day & Session Management -------------------- */
  addDay: (eventId: string, date: string) => void;
  deleteDay: (eventId: string, dayId: string) => void;

  addSession: (
    eventId: string,
    dayId: string,
    sessionData: {
      name: string;
      description: string;
      sessionType: EventType;
      startTime: string;
    }
  ) => void;

  updateSession: (
    eventId: string,
    dayId: string,
    sessionId: string,
    data: Partial<Session>
  ) => void;

  deleteSession: (eventId: string, dayId: string, sessionId: string) => void;

  /* -------------------- Session Guest Management -------------------- */
  setSessionGuests: (
    eventId: string,
    dayId: string,
    sessionId: string,
    hostGuestIds: string[],
    externalGuestIds: string[]
  ) => void;

  getSessionGuests: (sessionId: string) => {
    hostGuests: Guest[];
    externalGuests: Guest[];
  } | null;

  getEventIdForSession: (sessionId: string) => string | null;
  getSessionById: (sessionId: string) => { session: Session; dayId: string; eventId: string } | null;

  /* -------------------- Seat Plan Snapshot -------------------- */
  saveSessionSeatPlan: (
    eventId: string,
    dayId: string,
    sessionId: string,
    seatPlan: Session['seatPlan']
  ) => void;

  loadSessionSeatPlan: (sessionId: string) => {
    tables: Table[];
    chunks: Record<string, Chunk>;
    activeGuestIds: string[];
    selectedMealPlanIndex?: number | null;
    uiSettings?: SessionUISettings;
    isLocked?: boolean;
  } | null;

  /* -------------------- SESSION RULES MANAGEMENT -------------------- */
  
  /**
   * Save session rules configuration (sort order, proximity rules, table rules, guest selection)
   */
  saveSessionRules: (
    eventId: string,
    dayId: string,
    sessionId: string,
    rulesConfig: SessionRulesConfig
  ) => void;

  /**
   * Load session rules configuration
   */
  loadSessionRules: (sessionId: string) => SessionRulesConfig | null;

  /**
   * Save violations to session for persistence
   */
  saveSessionViolations: (
    eventId: string,
    dayId: string,
    sessionId: string,
    violations: StoredProximityViolation[]
  ) => void;

  /**
   * Load stored violations from session
   */
  loadSessionViolations: (sessionId: string) => StoredProximityViolation[];

  /**
   * Save complete session state (seat plan + rules + violations)
   */
  saveCompleteSessionState: (
    eventId: string,
    dayId: string,
    sessionId: string,
    seatPlan: Session['seatPlan'],
    rulesConfig: SessionRulesConfig,
    violations: StoredProximityViolation[]
  ) => void;

  /**
   * Load complete session state
   */
  loadCompleteSessionState: (sessionId: string) => {
    seatPlan: Session['seatPlan'] | null;
    rulesConfig: SessionRulesConfig;
    violations: StoredProximityViolation[];
  };

  /* -------------------- SESSION LOCK MANAGEMENT -------------------- */
  
  /**
   * Toggle session lock state
   * When locked, the session becomes view-only
   */
  toggleSessionLock: (eventId: string, dayId: string, sessionId: string) => void;
  
  /**
   * Set session lock state explicitly
   */
  setSessionLock: (eventId: string, dayId: string, sessionId: string, isLocked: boolean) => void;
  
  /**
   * Check if a session is locked
   */
  isSessionLocked: (sessionId: string) => boolean;

  /* -------------------- SESSION UI SETTINGS MANAGEMENT -------------------- */
  
  /**
   * Save session UI settings (zoom, connector gap, display modes, etc.)
   */
  saveSessionUISettings: (
    eventId: string,
    dayId: string,
    sessionId: string,
    uiSettings: SessionUISettings
  ) => void;
  
  /**
   * Load session UI settings
   */
  loadSessionUISettings: (sessionId: string) => SessionUISettings | null;

  /* -------------------- Statistics & Audit -------------------- */
  getPriorStats: (eventId: string, currentSessionId: string) => AdjacencyMap;
  checkSessionAuditStatus: (eventId: string, sessionId: string) => "clean" | "review_required";
  acknowledgeSessionWarnings: (eventId: string, sessionId: string) => void;

  /* -------------------- Import / Export -------------------- */
  exportEventJSON: (eventId: string) => string;
  importEventJSON: (jsonString: string) => boolean;

  /* ==================== CONSOLIDATED TRACKING ==================== */

  /* -------------------- Guest Tracking -------------------- */
  toggleGuestTracking: (eventId: string, guestId: string) => void;
  isGuestTracked: (eventId: string, guestId: string) => boolean;
  getTrackedGuests: (eventId: string) => string[];
  setTrackedGuests: (eventId: string, guestIds: string[]) => void;
  clearEventGuestTracking: (eventId: string) => void;

  /* -------------------- Session Tracking -------------------- */
  toggleSessionTracking: (eventId: string, sessionId: string) => void;
  setSessionTracking: (eventId: string, sessionId: string, tracked: boolean) => void;
  isSessionTracked: (eventId: string, sessionId: string) => boolean;
  getTrackedSessions: (eventId: string) => string[];
  clearEventSessionTracking: (eventId: string) => void;

  /* -------------------- Planning Order Management -------------------- */
  getSessionPlanningOrder: (eventId: string, sessionId: string) => number;
  resetSessionPlanningOrder: (eventId: string, sessionId: string) => void;
  /** Computes full datetime (ISO string) from day date + session start time for chronological ordering */
  getSessionDateTime: (sessionId: string) => string | null;

  /* -------------------- Adjacency Recording -------------------- */
  recordSessionAdjacency: (
    eventId: string,
    sessionId: string,
    sessionStartTime: string,
    tables: Table[]
  ) => void;
  removeSessionAdjacency: (eventId: string, sessionId: string) => void;
  getEventAdjacencyRecords: (eventId: string) => SessionAdjacencyRecord[];

  /* -------------------- Analysis Helpers -------------------- */
  getHistoricalAdjacencyCount: (
    eventId: string,
    currentSessionId: string,
    trackedGuestId: string
  ) => Record<string, number>;

  /**
   * Gets historical adjacency count filtered by opposite guest type.
   * If tracked guest is a host, returns only external guest adjacencies.
   * If tracked guest is external, returns only host guest adjacencies.
   * Also includes adjacency type breakdown (side/opposite/edge).
   */
  getFilteredHistoricalAdjacencyCount: (
    eventId: string,
    currentSessionId: string,
    trackedGuestId: string,
    trackedGuestFromHost: boolean
  ) => Record<string, { count: number; byType: Record<string, number> }>;

  getTrackedGuestHistory: (
    eventId: string,
    currentSessionId: string,
    trackedGuestId: string
  ) => Array<{ guestId: string; count: number }>;

  /**
   * Gets tracked guest history filtered by opposite guest type with adjacency type breakdown.
   */
  getFilteredTrackedGuestHistory: (
    eventId: string,
    currentSessionId: string,
    trackedGuestId: string,
    trackedGuestFromHost: boolean
  ) => Array<{ guestId: string; count: number; byType: Record<string, number> }>;

  getSessionsNeedingReview: (eventId: string) => string[];
  acknowledgeSessionReview: (eventId: string, sessionId: string) => void;

  /* -------------------- Cleanup -------------------- */
  clearEventTracking: (eventId: string) => void;

  /* -------------------- Legacy Sync (for backward compatibility) -------------------- */
  updateSessionTrackingStatus: (
    eventId: string,
    sessionId: string,
    isTracked: boolean,
    planningOrder?: number
  ) => void;
  updateEventTrackedGuests: (eventId: string, trackedGuestIds: string[]) => void;
  markSessionForReview: (eventId: string, sessionId: string, needsReview: boolean) => void;
}

export const useEventStore = create<EventStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        events: [],
        activeEventId: null,
        activeSessionId: null,
        _hasHydrated: false,

        /* ==================== HYDRATION ==================== */
        setHasHydrated: (state) => {
          set({ _hasHydrated: state });
        },

        /* ==================== EVENT CRUD ==================== */
        createEvent: (name, description, eventType, startDate) =>
          set((state) => ({
            events: [
              ...state.events,
              {
                id: uuidv4(),
                name,
                description,
                eventType,
                startDate,
                createdAt: new Date().toISOString(),
                masterHostGuests: [],
                masterExternalGuests: [],
                days: [],
                // Initialize with tracking fields
                ...DEFAULT_EVENT_TRACKING,
              },
            ],
          })),

        deleteEvent: (id) => {
          set((state) => ({
            events: state.events.filter((e) => e.id !== id),
            activeEventId: state.activeEventId === id ? null : state.activeEventId,
          }));
        },

        updateEventDetails: (id, data) =>
          set((state) => ({
            events: state.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
          })),

        setActiveEvent: (id) => set({ activeEventId: id }),
        setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

        /* ==================== MASTER GUEST LIST ==================== */
        addMasterGuest: (eventId, guest) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              const listKey = guest.fromHost ? "masterHostGuests" : "masterExternalGuests";
              return {
                ...e,
                [listKey]: [...e[listKey], guest],
              };
            }),
          })),

        /* ==================== DAY MANAGEMENT ==================== */
        addDay: (eventId, date) =>
          set((state) => ({
            events: state.events.map((e) =>
              e.id !== eventId
                ? e
                : {
                  ...e,
                  days: [...e.days, { id: uuidv4(), date, sessions: [] }],
                }
            ),
          })),

        deleteDay: (eventId, dayId) => {
          const state = get()

          // 1. Find the target day
          const targetDay = state.events
            .find((e) => e.id === eventId)
            ?.days.find((d) => d.id === dayId)

          // 2. Delete ALL sessions in that day using your existing method
          if (targetDay?.sessions?.length) {
            targetDay.sessions.forEach((session) => {
              state.deleteSession(eventId, dayId, session.id)
            })
          }

          // 3. Now safely delete the day itself
          set((state) => ({
            events: state.events.map((e) =>
              e.id !== eventId
                ? e
                : {
                  ...e,
                  days: e.days.filter((d) => d.id !== dayId),
                }
            ),
          }))
        },

        /* ==================== SESSION MANAGEMENT ==================== */
        addSession: (eventId, dayId, sessionData) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) =>
                  d.id !== dayId
                    ? d
                    : {
                      ...d,
                      sessions: [
                        ...d.sessions,
                        {
                          id: uuidv4(),
                          name: sessionData.name,
                          description: sessionData.description,
                          sessionType: sessionData.sessionType,
                          startTime: new Date(sessionData.startTime).toISOString(),
                          endTime: new Date(new Date(sessionData.startTime).getTime() + 60 * 60 * 1000).toISOString(),
                          inheritedHostGuestIds: [],
                          inheritedExternalGuestIds: [],
                          seatPlan: {
                            tables: [],
                            chunks: {},
                            activeGuestIds: [],
                          },
                          // Initialize with default rules
                          rulesConfig: { ...DEFAULT_SESSION_RULES },
                          storedViolations: [],
                        },
                      ],
                    }
                ),
              };
            }),
          })),

        updateSession: (eventId, dayId, sessionId, data) =>
          set((state) => {
            // Defensive normalization
            const normalizedData = { ...data };
            if (data && data.startTime) {
              const parsed = new Date(data.startTime);
              if (!isNaN(parsed.getTime())) {
                normalizedData.startTime = parsed.toISOString();
              } else {
                normalizedData.startTime = data.startTime;
              }
            }

            return {
              events: state.events.map((e) => {
                if (e.id !== eventId) return e;
                return {
                  ...e,
                  days: e.days.map((d) => {
                    if (d.id !== dayId) return d;
                    return {
                      ...d,
                      sessions: d.sessions.map((s) =>
                        s.id !== sessionId ? s : { ...s, ...normalizedData }
                      ),
                    };
                  }),
                };
              }),
            };
          }),

        deleteSession: (eventId, dayId, sessionId) => {
          // Also remove adjacency records for this session
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (event) {
            const filteredRecords = (event.adjacencyRecords || []).filter(
              r => r.sessionId !== sessionId
            );

            const updatedTracker = event.planningOrderTracker
              ? {
                ...event.planningOrderTracker,
                sessionOrderMap: Object.fromEntries(
                  Object.entries(event.planningOrderTracker.sessionOrderMap)
                    .filter(([sid]) => sid !== sessionId)
                ),
              }
              : DEFAULT_EVENT_TRACKING.planningOrderTracker;

            set((state) => ({
              events: state.events.map((e) => {
                if (e.id !== eventId) return e;
                return {
                  ...e,
                  adjacencyRecords: filteredRecords,
                  planningOrderTracker: updatedTracker,
                  days: e.days.map((d) => {
                    if (d.id !== dayId) return d;
                    return {
                      ...d,
                      sessions: d.sessions.filter(s => s.id !== sessionId)
                    };
                  }),
                };
              }),
            }));
          } else {
            set((state) => ({
              events: state.events.map((e) => {
                if (e.id !== eventId) return e;
                return {
                  ...e,
                  days: e.days.map((d) => {
                    if (d.id !== dayId) return d;
                    return {
                      ...d,
                      sessions: d.sessions.filter(s => s.id !== sessionId)
                    };
                  }),
                };
              }),
            }));
          }
        },

        /* ==================== SESSION GUEST MANAGEMENT ==================== */
        setSessionGuests: (eventId, dayId, sessionId, hostGuestIds, externalGuestIds) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => {
                  if (d.id !== dayId) return d;
                  return {
                    ...d,
                    sessions: d.sessions.map((s) =>
                      s.id !== sessionId
                        ? s
                        : {
                          ...s,
                          inheritedHostGuestIds: hostGuestIds,
                          inheritedExternalGuestIds: externalGuestIds,
                        }
                    ),
                  };
                }),
              };
            }),
          })),

        getSessionGuests: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                const hostGuests = event.masterHostGuests.filter(g =>
                  session.inheritedHostGuestIds?.includes(g.id)
                );
                const externalGuests = event.masterExternalGuests.filter(g =>
                  session.inheritedExternalGuestIds?.includes(g.id)
                );

                return { hostGuests, externalGuests };
              }
            }
          }

          return null;
        },

        getEventIdForSession: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              if (day.sessions.some(s => s.id === sessionId)) {
                return event.id;
              }
            }
          }

          return null;
        },

        getSessionById: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                return { session, dayId: day.id, eventId: event.id };
              }
            }
          }

          return null;
        },

        /* ==================== SEAT PLAN SNAPSHOT ==================== */
        saveSessionSeatPlan: (eventId, dayId, sessionId, seatPlan) =>
          set((state) => {
            const now = new Date().toISOString();

            return {
              events: state.events.map((e) => {
                if (e.id !== eventId) return e;
                return {
                  ...e,
                  days: e.days.map((d) => {
                    if (d.id !== dayId) return d;
                    return {
                      ...d,
                      sessions: d.sessions.map((s) =>
                        s.id !== sessionId
                          ? s
                          : {
                            ...s,
                            seatPlan,
                            lastModified: now,
                          }
                      ),
                    };
                  }),
                };
              }),
            };
          }),

        loadSessionSeatPlan: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                return {
                  tables: session.seatPlan.tables || [],
                  chunks: session.seatPlan.chunks || {},
                  activeGuestIds: session.seatPlan.activeGuestIds || [],
                  selectedMealPlanIndex: session.seatPlan.selectedMealPlanIndex ?? null,
                  uiSettings: session.seatPlan.uiSettings ?? { ...DEFAULT_SESSION_UI_SETTINGS },
                  isLocked: session.isLocked ?? false,
                };
              }
            }
          }

          return null;
        },

        /* ==================== SESSION RULES MANAGEMENT ==================== */
        
        saveSessionRules: (eventId, dayId, sessionId, rulesConfig) =>
          set((state) => {
            const now = new Date().toISOString();

            return {
              events: state.events.map((e) => {
                if (e.id !== eventId) return e;
                return {
                  ...e,
                  days: e.days.map((d) => {
                    if (d.id !== dayId) return d;
                    return {
                      ...d,
                      sessions: d.sessions.map((s) =>
                        s.id !== sessionId
                          ? s
                          : {
                            ...s,
                            rulesConfig: {
                              ...rulesConfig,
                              lastModified: now,
                            },
                          }
                      ),
                    };
                  }),
                };
              }),
            };
          }),

        loadSessionRules: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                // Return stored rules or default if not present
                return session.rulesConfig ?? { ...DEFAULT_SESSION_RULES };
              }
            }
          }

          return null;
        },

        saveSessionViolations: (eventId, dayId, sessionId, violations) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => {
                  if (d.id !== dayId) return d;
                  return {
                    ...d,
                    sessions: d.sessions.map((s) =>
                      s.id !== sessionId
                        ? s
                        : {
                          ...s,
                          storedViolations: violations,
                        }
                    ),
                  };
                }),
              };
            }),
          })),

        loadSessionViolations: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                return session.storedViolations ?? [];
              }
            }
          }

          return [];
        },

        saveCompleteSessionState: (eventId, dayId, sessionId, seatPlan, rulesConfig, violations) =>
          set((state) => {
            const now = new Date().toISOString();

            return {
              events: state.events.map((e) => {
                if (e.id !== eventId) return e;
                return {
                  ...e,
                  days: e.days.map((d) => {
                    if (d.id !== dayId) return d;
                    return {
                      ...d,
                      sessions: d.sessions.map((s) =>
                        s.id !== sessionId
                          ? s
                          : {
                            ...s,
                            seatPlan,
                            rulesConfig: {
                              ...rulesConfig,
                              lastModified: now,
                            },
                            storedViolations: violations,
                            lastModified: now,
                          }
                      ),
                    };
                  }),
                };
              }),
            };
          }),

        loadCompleteSessionState: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                return {
                  seatPlan: session.seatPlan ? {
                    tables: session.seatPlan.tables || [],
                    chunks: session.seatPlan.chunks || {},
                    activeGuestIds: session.seatPlan.activeGuestIds || [],
                    selectedMealPlanIndex: session.seatPlan.selectedMealPlanIndex ?? null,
                  } : null,
                  rulesConfig: session.rulesConfig ?? { ...DEFAULT_SESSION_RULES },
                  violations: session.storedViolations ?? [],
                };
              }
            }
          }

          return {
            seatPlan: null,
            rulesConfig: { ...DEFAULT_SESSION_RULES },
            violations: [],
          };
        },

        /* ==================== SESSION LOCK MANAGEMENT ==================== */
        
        toggleSessionLock: (eventId, dayId, sessionId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => {
                  if (d.id !== dayId) return d;
                  return {
                    ...d,
                    sessions: d.sessions.map((s) =>
                      s.id !== sessionId
                        ? s
                        : {
                          ...s,
                          isLocked: !s.isLocked,
                          lockedAt: !s.isLocked ? new Date().toISOString() : undefined,
                        }
                    ),
                  };
                }),
              };
            }),
          })),

        setSessionLock: (eventId, dayId, sessionId, isLocked) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => {
                  if (d.id !== dayId) return d;
                  return {
                    ...d,
                    sessions: d.sessions.map((s) =>
                      s.id !== sessionId
                        ? s
                        : {
                          ...s,
                          isLocked,
                          lockedAt: isLocked ? new Date().toISOString() : undefined,
                        }
                    ),
                  };
                }),
              };
            }),
          })),

        isSessionLocked: (sessionId) => {
          const state = get();
          
          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                return session.isLocked ?? false;
              }
            }
          }
          
          return false;
        },

        /* ==================== SESSION UI SETTINGS MANAGEMENT ==================== */
        
        saveSessionUISettings: (eventId, dayId, sessionId, uiSettings) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => {
                  if (d.id !== dayId) return d;
                  return {
                    ...d,
                    sessions: d.sessions.map((s) =>
                      s.id !== sessionId
                        ? s
                        : {
                          ...s,
                          seatPlan: {
                            ...s.seatPlan,
                            uiSettings,
                          },
                        }
                    ),
                  };
                }),
              };
            }),
          })),

        loadSessionUISettings: (sessionId) => {
          const state = get();
          
          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                return session.seatPlan?.uiSettings ?? { ...DEFAULT_SESSION_UI_SETTINGS };
              }
            }
          }
          
          return null;
        },

        /* ==================== STATISTICS & AUDIT ==================== */
        getPriorStats: (eventId, currentSessionId) => {
          const state = get();
          const event = state.events.find((e) => e.id === eventId);
          if (!event) return {};

          // Get the current session's full datetime for proper chronological comparison
          const currentSessionDateTime = state.getSessionDateTime(currentSessionId);
          if (!currentSessionDateTime) return {};

          // Build a list of sessions with their full datetimes
          const sessionsWithDateTime: Array<{ session: Session; dateTime: string }> = [];
          event.days.forEach(day => {
            day.sessions.forEach(session => {
              const sessionDateTime = state.getSessionDateTime(session.id);
              if (sessionDateTime) {
                sessionsWithDateTime.push({ session, dateTime: sessionDateTime });
              }
            });
          });

          // Filter sessions that are chronologically before the current session
          const previousSessions = sessionsWithDateTime
            .filter(({ session, dateTime }) => 
              session.id !== currentSessionId && 
              new Date(dateTime).getTime() < new Date(currentSessionDateTime).getTime()
            )
            .map(({ session }) => session);

          const guestMap: Record<string, Guest> = {};
          [...event.masterHostGuests, ...event.masterExternalGuests].forEach(
            (g) => (guestMap[g.id] = g)
          );

          return calculateVIPExposure(previousSessions, guestMap);
        },

        checkSessionAuditStatus: (eventId, sessionId) => {
          const state = get();
          const event = state.events.find((e) => e.id === eventId);
          if (!event) return "clean";

          // Get the current session's full datetime
          const currentSessionDateTime = state.getSessionDateTime(sessionId);
          if (!currentSessionDateTime) return "clean";

          const allSessions = event.days.flatMap((d) => d.sessions);
          const currentSession = allSessions.find((s) => s.id === sessionId);
          if (!currentSession || !currentSession.lastStatsCheck) return "clean";

          // Build sessions with their full datetimes for proper comparison
          const sessionsWithDateTime: Array<{ session: Session; dateTime: string }> = [];
          event.days.forEach(day => {
            day.sessions.forEach(session => {
              const sessionDateTime = state.getSessionDateTime(session.id);
              if (sessionDateTime) {
                sessionsWithDateTime.push({ session, dateTime: sessionDateTime });
              }
            });
          });

          // Filter sessions chronologically before the current session
          const previousSessions = sessionsWithDateTime
            .filter(({ session, dateTime }) => 
              session.id !== sessionId && 
              new Date(dateTime).getTime() < new Date(currentSessionDateTime).getTime()
            )
            .map(({ session }) => session);

          let maxPrevModified = "";
          previousSessions.forEach((s: Session) => {
            if (s.lastModified && s.lastModified > maxPrevModified) {
              maxPrevModified = s.lastModified;
            }
          });

          if (maxPrevModified > currentSession.lastStatsCheck) {
            return "review_required";
          }

          return "clean";
        },

        acknowledgeSessionWarnings: (eventId, sessionId) => {
          const now = new Date().toISOString();
          set((state) => ({
            events: state.events.map(e => e.id !== eventId ? e : {
              ...e,
              days: e.days.map(d => ({
                ...d,
                sessions: d.sessions.map(s => s.id !== sessionId ? s : {
                  ...s,
                  lastStatsCheck: now
                })
              }))
            })
          }))
        },

        /* ==================== IMPORT / EXPORT ==================== */
        exportEventJSON: (eventId) => {
          const event = get().events.find((e) => e.id === eventId);
          return event ? JSON.stringify(event, null, 2) : "";
        },

        importEventJSON: (jsonString) => {
          try {
            const eventData: Event = JSON.parse(jsonString);
            if (!eventData.id || !eventData.days) return false;

            // Ensure tracking fields exist
            const eventWithTracking = ensureTrackingFields(eventData);

            set((state) => {
              const exists = state.events.some(e => e.id === eventData.id);
              if (exists) {
                return { events: state.events.map(e => e.id === eventData.id ? eventWithTracking : e) };
              }
              return { events: [...state.events, eventWithTracking] };
            });
            return true;
          } catch (e) {
            console.error("JSON Parse Error", e);
            return false;
          }
        },

        /* ==================== GUEST TRACKING ==================== */
        toggleGuestTracking: (eventId, guestId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;

              const currentTracked = e.trackedGuestIds || [];
              const isCurrentlyTracked = currentTracked.includes(guestId);

              const newTracked = isCurrentlyTracked
                ? currentTracked.filter(id => id !== guestId)
                : [...currentTracked, guestId];

              return {
                ...e,
                trackedGuestIds: newTracked,
                trackingEnabled: newTracked.length > 0,
              };
            }),
          })),

        isGuestTracked: (eventId, guestId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event || !event.trackedGuestIds) return false;
          return event.trackedGuestIds.includes(guestId);
        },

        getTrackedGuests: (eventId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          return event?.trackedGuestIds || [];
        },

        setTrackedGuests: (eventId, guestIds) =>
          set((state) => ({
            events: state.events.map((e) =>
              e.id !== eventId
                ? e
                : {
                  ...e,
                  trackedGuestIds: guestIds,
                  trackingEnabled: guestIds.length > 0,
                }
            ),
          })),

        clearEventGuestTracking: (eventId) =>
          set((state) => ({
            events: state.events.map((e) =>
              e.id !== eventId
                ? e
                : {
                  ...e,
                  trackedGuestIds: [],
                  trackingEnabled: false,
                }
            ),
          })),

        /* ==================== SESSION TRACKING ==================== */
        toggleSessionTracking: (eventId, sessionId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id !== sessionId
                      ? s
                      : {
                        ...s,
                        isTrackedForAdjacency: !s.isTrackedForAdjacency,
                      }
                  ),
                })),
              };
            }),
          })),

        setSessionTracking: (eventId, sessionId, tracked) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id !== sessionId
                      ? s
                      : {
                        ...s,
                        isTrackedForAdjacency: tracked,
                      }
                  ),
                })),
              };
            }),
          })),

        isSessionTracked: (eventId, sessionId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event) return false;

          for (const day of event.days) {
            const session = day.sessions.find(s => s.id === sessionId);
            if (session) {
              return session.isTrackedForAdjacency === true;
            }
          }

          return false;
        },

        getTrackedSessions: (eventId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event) return [];

          const trackedSessions: string[] = [];
          event.days.forEach(day => {
            day.sessions.forEach(session => {
              if (session.isTrackedForAdjacency) {
                trackedSessions.push(session.id);
              }
            });
          });

          return trackedSessions;
        },

        clearEventSessionTracking: (eventId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) => ({
                    ...s,
                    isTrackedForAdjacency: false,
                    planningOrder: undefined,
                    needsAdjacencyReview: false,
                  })),
                })),
              };
            }),
          })),

        /* ==================== PLANNING ORDER MANAGEMENT ==================== */
        getSessionPlanningOrder: (eventId, sessionId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event || !event.planningOrderTracker) return -1;
          return event.planningOrderTracker.sessionOrderMap[sessionId] ?? -1;
        },

        resetSessionPlanningOrder: (eventId, sessionId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId || !e.planningOrderTracker) return e;

              const newOrderMap = { ...e.planningOrderTracker.sessionOrderMap };
              delete newOrderMap[sessionId];

              return {
                ...e,
                planningOrderTracker: {
                  ...e.planningOrderTracker,
                  sessionOrderMap: newOrderMap,
                },
              };
            }),
          })),

        getSessionDateTime: (sessionId) => {
          const state = get();

          for (const event of state.events) {
            for (const day of event.days) {
              const session = day.sessions.find(s => s.id === sessionId);
              if (session) {
                // Combine the day's date with the session's start time
                const dayDate = new Date(day.date);
                const sessionTime = new Date(session.startTime);

                // Create a new date with the day's date and session's time
                const combinedDateTime = new Date(
                  dayDate.getFullYear(),
                  dayDate.getMonth(),
                  dayDate.getDate(),
                  sessionTime.getHours(),
                  sessionTime.getMinutes(),
                  sessionTime.getSeconds()
                );

                return combinedDateTime.toISOString();
              }
            }
          }

          return null;
        },

        /* ==================== ADJACENCY RECORDING ==================== */
        recordSessionAdjacency: (eventId, sessionId, sessionStartTime, tables) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;

              const trackedGuestIds = e.trackedGuestIds || [];
              if (trackedGuestIds.length === 0) return e;

              // Get or create planning order
              const tracker = e.planningOrderTracker || DEFAULT_EVENT_TRACKING.planningOrderTracker;
              let planningOrder = tracker.sessionOrderMap[sessionId];
              let newNextOrder = tracker.nextOrder;

              if (planningOrder === undefined) {
                planningOrder = tracker.nextOrder;
                newNextOrder = tracker.nextOrder + 1;
              }

              // Compute full session datetime
              const sessionDateTime = get().getSessionDateTime(sessionId) || sessionStartTime;

              // Build seat-to-guest mapping
              const seatToGuest = new Map<string, string>();
              const guestToSeat = new Map<string, { tableId: string; seatId: string; table: any }>();

              for (const table of tables) {
                for (const seat of table.seats || []) {
                  if (seat.assignedGuestId) {
                    seatToGuest.set(seat.id, seat.assignedGuestId);
                    guestToSeat.set(seat.assignedGuestId, {
                      tableId: table.id,
                      seatId: seat.id,
                      table,
                    });
                  }
                }
              }

              // Remove old records for this session
              const existingRecords = (e.adjacencyRecords || []).filter(
                r => r.sessionId !== sessionId
              );

              // Create new adjacency records with enhanced type information
              const newRecords: SessionAdjacencyRecord[] = [];

              for (const trackedGuestId of trackedGuestIds) {
                const seatInfo = guestToSeat.get(trackedGuestId);
                if (!seatInfo) continue;

                const { table, seatId } = seatInfo;

                // Use enhanced adjacency to get all adjacent guests with type info
                const enhancedAdjacencies = getEnhancedAdjacentSeats(table, seatId);

                // Build adjacentGuestDetails with type information
                const adjacentGuestDetails: AdjacencyDetail[] = enhancedAdjacencies.map(adj => ({
                  guestId: adj.guestId,
                  adjacencyType: adj.adjacencyType,
                }));

                // Also maintain backward-compatible adjacentGuestIds
                const adjacentGuestIds = enhancedAdjacencies.map(adj => adj.guestId);

                newRecords.push({
                  sessionId,
                  sessionStartTime,
                  sessionDateTime,
                  planningOrder,
                  trackedGuestId,
                  adjacentGuestIds,
                  adjacentGuestDetails,
                  needsReview: false,
                });
              }

              return {
                ...e,
                adjacencyRecords: [...existingRecords, ...newRecords],
                planningOrderTracker: {
                  sessionOrderMap: {
                    ...tracker.sessionOrderMap,
                    [sessionId]: planningOrder,
                  },
                  nextOrder: newNextOrder,
                },
              };
            }),
          })),

        removeSessionAdjacency: (eventId, sessionId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;

              const filteredRecords = (e.adjacencyRecords || []).filter(
                r => r.sessionId !== sessionId
              );

              return {
                ...e,
                adjacencyRecords: filteredRecords,
              };
            }),
          })),

        getEventAdjacencyRecords: (eventId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          return event?.adjacencyRecords || [];
        },

        /* ==================== ANALYSIS HELPERS ==================== */
        getHistoricalAdjacencyCount: (eventId, currentSessionId, trackedGuestId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event) return {};

          // Get current session's datetime for comparison
          const currentSessionDateTime = state.getSessionDateTime(currentSessionId);
          if (!currentSessionDateTime) return {};

          const allRecords = event.adjacencyRecords || [];
          
          // Filter records to only include those chronologically before current session
          const relevantRecords = allRecords.filter(record => {
            if (record.trackedGuestId !== trackedGuestId) return false;
            if (record.sessionId === currentSessionId) return false;
            
            const recordDateTime = record.sessionDateTime || record.sessionStartTime;
            return new Date(recordDateTime).getTime() < new Date(currentSessionDateTime).getTime();
          });

          const adjacencyCount: Record<string, number> = {};

          relevantRecords.forEach(record => {
            record.adjacentGuestIds.forEach(guestId => {
              adjacencyCount[guestId] = (adjacencyCount[guestId] || 0) + 1;
            });
          });

          return adjacencyCount;
        },

        getFilteredHistoricalAdjacencyCount: (eventId, currentSessionId, trackedGuestId, trackedGuestFromHost) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event) return {};

          // Get current session's datetime for comparison
          const currentSessionDateTime = state.getSessionDateTime(currentSessionId);
          if (!currentSessionDateTime) return {};

          // Build set of opposite-type guest IDs
          const oppositeGuestIds = new Set<string>();
          const guestList = trackedGuestFromHost 
            ? event.masterExternalGuests 
            : event.masterHostGuests;
          
          guestList.forEach(g => {
            if (!g.deleted) {
              oppositeGuestIds.add(g.id);
            }
          });

          const allRecords = event.adjacencyRecords || [];
          
          // Filter records chronologically and by tracked guest
          const relevantRecords = allRecords.filter(record => {
            if (record.trackedGuestId !== trackedGuestId) return false;
            if (record.sessionId === currentSessionId) return false;
            
            const recordDateTime = record.sessionDateTime || record.sessionStartTime;
            return new Date(recordDateTime).getTime() < new Date(currentSessionDateTime).getTime();
          });

          const adjacencyCount: Record<string, { count: number; byType: Record<string, number> }> = {};

          relevantRecords.forEach(record => {
            // Use enhanced details if available, otherwise fall back to simple adjacentGuestIds
            if (record.adjacentGuestDetails && record.adjacentGuestDetails.length > 0) {
              record.adjacentGuestDetails.forEach(detail => {
                // Filter to only opposite type guests
                if (!oppositeGuestIds.has(detail.guestId)) return;
                
                if (!adjacencyCount[detail.guestId]) {
                  adjacencyCount[detail.guestId] = { count: 0, byType: {} };
                }
                adjacencyCount[detail.guestId].count += 1;
                
                const adjType = detail.adjacencyType || 'side';
                adjacencyCount[detail.guestId].byType[adjType] = 
                  (adjacencyCount[detail.guestId].byType[adjType] || 0) + 1;
              });
            } else {
              // Fallback for old records without adjacentGuestDetails
              record.adjacentGuestIds.forEach(guestId => {
                // Filter to only opposite type guests
                if (!oppositeGuestIds.has(guestId)) return;
                
                if (!adjacencyCount[guestId]) {
                  adjacencyCount[guestId] = { count: 0, byType: {} };
                }
                adjacencyCount[guestId].count += 1;
                adjacencyCount[guestId].byType['side'] = 
                  (adjacencyCount[guestId].byType['side'] || 0) + 1;
              });
            }
          });

          return adjacencyCount;
        },

        getTrackedGuestHistory: (eventId, currentSessionId, trackedGuestId) => {
          const adjacencyCount = get().getHistoricalAdjacencyCount(
            eventId,
            currentSessionId,
            trackedGuestId
          );

          return Object.entries(adjacencyCount)
            .map(([guestId, count]) => ({ guestId, count }))
            .sort((a, b) => b.count - a.count);
        },

        /**
         * Gets tracked guest history filtered by opposite guest type with adjacency type breakdown.
         */
        getFilteredTrackedGuestHistory: (eventId, currentSessionId, trackedGuestId, trackedGuestFromHost) => {
          const adjacencyCount = get().getFilteredHistoricalAdjacencyCount(
            eventId,
            currentSessionId,
            trackedGuestId,
            trackedGuestFromHost
          );

          return Object.entries(adjacencyCount)
            .map(([guestId, data]) => ({ 
              guestId, 
              count: data.count, 
              byType: data.byType 
            }))
            .sort((a, b) => b.count - a.count);
        },

        getSessionsNeedingReview: (eventId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event) return [];

          const allRecords = event.adjacencyRecords || [];
          const sessionsNeedingReview = new Set<string>();

          allRecords.forEach(record => {
            if (record.needsReview) {
              sessionsNeedingReview.add(record.sessionId);
            }
          });

          return Array.from(sessionsNeedingReview);
        },

        acknowledgeSessionReview: (eventId, sessionId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;

              const allRecords = e.adjacencyRecords || [];
              const updatedRecords = allRecords.map(record => {
                if (record.sessionId === sessionId) {
                  return { ...record, needsReview: false };
                }
                return record;
              });

              return {
                ...e,
                adjacencyRecords: updatedRecords,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id !== sessionId
                      ? s
                      : {
                        ...s,
                        needsAdjacencyReview: false,
                      }
                  ),
                })),
              };
            }),
          })),

        /* ==================== CLEANUP ==================== */
        clearEventTracking: (eventId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                trackedGuestIds: [],
                trackingEnabled: false,
                adjacencyRecords: [],
                planningOrderTracker: DEFAULT_EVENT_TRACKING.planningOrderTracker,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) => ({
                    ...s,
                    isTrackedForAdjacency: false,
                    planningOrder: undefined,
                    needsAdjacencyReview: false,
                  })),
                })),
              };
            }),
          })),

        /* ==================== LEGACY SYNC (backward compatibility) ==================== */
        updateSessionTrackingStatus: (eventId, sessionId, isTracked, planningOrder) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id !== sessionId
                      ? s
                      : {
                        ...s,
                        isTrackedForAdjacency: isTracked,
                        planningOrder: planningOrder ?? s.planningOrder,
                      }
                  ),
                })),
              };
            }),
          })),

        updateEventTrackedGuests: (eventId, trackedGuestIds) =>
          set((state) => ({
            events: state.events.map((e) =>
              e.id !== eventId
                ? e
                : {
                  ...e,
                  trackedGuestIds,
                  trackingEnabled: trackedGuestIds.length > 0,
                }
            ),
          })),

        markSessionForReview: (eventId, sessionId, needsReview) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id !== sessionId
                      ? s
                      : {
                        ...s,
                        needsAdjacencyReview: needsReview,
                      }
                  ),
                })),
              };
            }),
          })),
      }),

      {
        name: "event-master-store",
        skipHydration: true,
        onRehydrateStorage: () => (state) => {
          console.log('EventStore: Hydration complete');
          state?.setHasHydrated(true);
        },
      }
    )
  )
);

// Helper hook to wait for hydration
export const useEventStoreHydration = () => {
  return useEventStore((state) => state._hasHydrated);
};