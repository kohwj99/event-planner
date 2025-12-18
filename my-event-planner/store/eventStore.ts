import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  Event,
  EventDay,
  Session,
  EventType,
  SessionAdjacencyRecord,
  PlanningOrderTracker,
  DEFAULT_EVENT_TRACKING,
  ensureTrackingFields
} from "@/types/Event";
import { Guest } from "@/store/guestStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";
import { calculateVIPExposure, AdjacencyMap } from "@/utils/eventStatisticHelper";

interface EventStoreState {
  /* -------------------- ðŸ“¦ State -------------------- */
  events: Event[];
  activeEventId: string | null;
  activeSessionId: string | null;
  _hasHydrated: boolean;

  /* -------------------- ðŸ”„ Hydration -------------------- */
  setHasHydrated: (state: boolean) => void;

  /* -------------------- ðŸ“ Event CRUD -------------------- */
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

  /* -------------------- ðŸ“‡ Master Guest List -------------------- */
  addMasterGuest: (eventId: string, guest: Guest) => void;

  /* -------------------- ðŸ“… Day & Session Management -------------------- */
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

  /* -------------------- ðŸ‘¥ Session Guest Management -------------------- */
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

  /* -------------------- ðŸ§  Seat Plan Snapshot -------------------- */
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
  } | null;

  /* -------------------- ðŸ“Š Statistics & Audit -------------------- */
  getPriorStats: (eventId: string, currentSessionId: string) => AdjacencyMap;
  checkSessionAuditStatus: (eventId: string, sessionId: string) => "clean" | "review_required";
  acknowledgeSessionWarnings: (eventId: string, sessionId: string) => void;

  /* -------------------- ðŸ’¾ Import / Export -------------------- */
  exportEventJSON: (eventId: string) => string;
  importEventJSON: (jsonString: string) => boolean;

  /* ==================== ðŸŽ¯ CONSOLIDATED TRACKING ==================== */

  /* -------------------- ðŸ‘¤ Guest Tracking -------------------- */
  toggleGuestTracking: (eventId: string, guestId: string) => void;
  isGuestTracked: (eventId: string, guestId: string) => boolean;
  getTrackedGuests: (eventId: string) => string[];
  setTrackedGuests: (eventId: string, guestIds: string[]) => void;
  clearEventGuestTracking: (eventId: string) => void;

  /* -------------------- ðŸ“‹ Session Tracking -------------------- */
  toggleSessionTracking: (eventId: string, sessionId: string) => void;
  setSessionTracking: (eventId: string, sessionId: string, tracked: boolean) => void;
  isSessionTracked: (eventId: string, sessionId: string) => boolean;
  getTrackedSessions: (eventId: string) => string[];
  clearEventSessionTracking: (eventId: string) => void;

  /* -------------------- ðŸ“ˆ Planning Order Management -------------------- */
  getSessionPlanningOrder: (eventId: string, sessionId: string) => number;
  resetSessionPlanningOrder: (eventId: string, sessionId: string) => void;

  /* -------------------- ðŸ”— Adjacency Recording -------------------- */
  recordSessionAdjacency: (
    eventId: string,
    sessionId: string,
    sessionStartTime: string,
    tables: Table[]
  ) => void;
  removeSessionAdjacency: (eventId: string, sessionId: string) => void;
  getEventAdjacencyRecords: (eventId: string) => SessionAdjacencyRecord[];

  /* -------------------- ðŸ“Š Analysis Helpers -------------------- */
  getHistoricalAdjacencyCount: (
    eventId: string,
    currentSessionId: string,
    trackedGuestId: string
  ) => Record<string, number>;

  getTrackedGuestHistory: (
    eventId: string,
    currentSessionId: string,
    trackedGuestId: string
  ) => Array<{ guestId: string; count: number }>;

  getSessionsNeedingReview: (eventId: string) => string[];
  acknowledgeSessionReview: (eventId: string, sessionId: string) => void;

  /* -------------------- ðŸ§¹ Cleanup -------------------- */
  clearEventTracking: (eventId: string) => void;

  /* -------------------- ðŸ”„ Legacy Sync (for backward compatibility) -------------------- */
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

        // deleteDay: (eventId, dayId) =>
        //   set((state) => ({
        //     events: state.events.map((e) =>
        //       e.id !== eventId
        //         ? e
        //         : {
        //             ...e,
        //             days: e.days.filter((d) => d.id !== dayId),
        //           }
        //     ),
        //   })),
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
                };
              }
            }
          }

          return null;
        },

        /* ==================== STATISTICS & AUDIT ==================== */
        getPriorStats: (eventId, currentSessionId) => {
          const event = get().events.find((e) => e.id === eventId);
          if (!event) return {};

          const allSessions = event.days.flatMap((d) => d.sessions);
          const currentSession = allSessions.find((s) => s.id === currentSessionId);
          if (!currentSession) return {};

          const previousSessions = allSessions.filter((s: Session) =>
            s.startTime < currentSession.startTime && s.id !== currentSessionId
          );

          const guestMap: Record<string, Guest> = {};
          [...event.masterHostGuests, ...event.masterExternalGuests].forEach(
            (g) => (guestMap[g.id] = g)
          );

          return calculateVIPExposure(previousSessions, guestMap);
        },

        checkSessionAuditStatus: (eventId, sessionId) => {
          const event = get().events.find((e) => e.id === eventId);
          if (!event) return "clean";

          const allSessions = event.days.flatMap((d) => d.sessions);
          const currentSession = allSessions.find((s) => s.id === sessionId);

          if (!currentSession || !currentSession.lastStatsCheck) return "clean";

          const previousSessions = allSessions.filter((s: Session) =>
            s.startTime < currentSession.startTime && s.id !== sessionId
          );

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

        /* ==================== ðŸŽ¯ GUEST TRACKING ==================== */
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

        /* ==================== ðŸ“‹ SESSION TRACKING ==================== */
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

        /* ==================== ðŸ“ˆ PLANNING ORDER MANAGEMENT ==================== */
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

              const updatedMap = { ...e.planningOrderTracker.sessionOrderMap };
              delete updatedMap[sessionId];

              return {
                ...e,
                planningOrderTracker: {
                  ...e.planningOrderTracker,
                  sessionOrderMap: updatedMap,
                },
              };
            }),
          })),

        /* ==================== ðŸ”— ADJACENCY RECORDING ==================== */
        recordSessionAdjacency: (eventId, sessionId, sessionStartTime, tables) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event) {
            console.warn(`recordSessionAdjacency: Event ${eventId} not found`);
            return;
          }

          const trackedGuests = event.trackedGuestIds || [];
          if (trackedGuests.length === 0) {
            console.warn(`No tracked guests for event ${eventId}`);
            return;
          }

          let tracker = event.planningOrderTracker || DEFAULT_EVENT_TRACKING.planningOrderTracker;

          const currentOrder = tracker.sessionOrderMap[sessionId];
          const isReplanning = currentOrder !== undefined;
          const planningOrder = isReplanning ? currentOrder : tracker.nextOrder;

          const existingRecords = event.adjacencyRecords || [];
          const filteredRecords = existingRecords.filter(r => r.sessionId !== sessionId);

          const newRecords: SessionAdjacencyRecord[] = [];

          // Build guest-to-seat mapping
          const guestSeatMap = new Map<string, { tableId: string; seatId: string; seat: any }>();

          tables.forEach(table => {
            table.seats.forEach(seat => {
              if (seat.assignedGuestId) {
                guestSeatMap.set(seat.assignedGuestId, {
                  tableId: table.id,
                  seatId: seat.id,
                  seat: seat,
                });
              }
            });
          });

          // For each tracked guest, find adjacent guests
          trackedGuests.forEach(trackedGuestId => {
            const guestSeatData = guestSeatMap.get(trackedGuestId);

            if (!guestSeatData) return;

            const { seat } = guestSeatData;
            const adjacentSeatIds = seat.adjacentSeats || [];

            if (adjacentSeatIds.length === 0) return;

            const adjacentGuestIds: string[] = [];

            adjacentSeatIds.forEach((adjacentSeatId: string) => {
              for (const table of tables) {
                const adjacentSeat = table.seats.find(s => s.id === adjacentSeatId);

                if (adjacentSeat) {
                  if (adjacentSeat.assignedGuestId && !adjacentSeat.locked) {
                    adjacentGuestIds.push(adjacentSeat.assignedGuestId);
                  }
                  break;
                }
              }
            });

            if (adjacentGuestIds.length > 0) {
              newRecords.push({
                sessionId,
                sessionStartTime,
                planningOrder,
                trackedGuestId,
                adjacentGuestIds,
                needsReview: false,
              });
            }
          });

          // Mark downstream sessions for review if replanning
          const updatedRecords = filteredRecords.map(record => {
            if (isReplanning && record.planningOrder > planningOrder) {
              return { ...record, needsReview: true };
            }
            return record;
          });

          const allRecords = [...updatedRecords, ...newRecords].sort(
            (a, b) => a.planningOrder - b.planningOrder
          );

          const updatedTracker: PlanningOrderTracker = {
            sessionOrderMap: {
              ...tracker.sessionOrderMap,
              [sessionId]: planningOrder,
            },
            nextOrder: isReplanning ? tracker.nextOrder : tracker.nextOrder + 1,
          };

          // Also update session's planningOrder field
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                adjacencyRecords: allRecords,
                planningOrderTracker: updatedTracker,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id !== sessionId
                      ? s
                      : {
                        ...s,
                        planningOrder: planningOrder,
                      }
                  ),
                })),
              };
            }),
          }));

          console.log(`âœ… Recorded adjacency for session ${sessionId}`, {
            planningOrder,
            isReplanning,
            newRecordsCount: newRecords.length,
            downstreamSessionsMarked: isReplanning
              ? updatedRecords.filter(r => r.needsReview).length
              : 0
          });
        },

        removeSessionAdjacency: (eventId, sessionId) =>
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;

              const existingRecords = e.adjacencyRecords || [];
              const filteredRecords = existingRecords.filter(r => r.sessionId !== sessionId);

              const tracker = e.planningOrderTracker;
              if (tracker) {
                const updatedMap = { ...tracker.sessionOrderMap };
                delete updatedMap[sessionId];

                return {
                  ...e,
                  adjacencyRecords: filteredRecords,
                  planningOrderTracker: {
                    ...tracker,
                    sessionOrderMap: updatedMap,
                  },
                };
              }

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

        /* ==================== ðŸ“Š ANALYSIS HELPERS ==================== */
        getHistoricalAdjacencyCount: (eventId, currentSessionId, trackedGuestId) => {
          const state = get();
          const event = state.events.find(e => e.id === eventId);

          if (!event || !event.planningOrderTracker) return {};

          const tracker = event.planningOrderTracker;
          const currentOrder = tracker.sessionOrderMap[currentSessionId];

          if (currentOrder === undefined) {
            return {};
          }

          const allRecords = event.adjacencyRecords || [];
          const relevantRecords = allRecords.filter(
            r => r.planningOrder < currentOrder && r.trackedGuestId === trackedGuestId
          );

          const adjacencyCount: Record<string, number> = {};

          relevantRecords.forEach(record => {
            record.adjacentGuestIds.forEach(guestId => {
              adjacencyCount[guestId] = (adjacencyCount[guestId] || 0) + 1;
            });
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

        /* ==================== ðŸ§¹ CLEANUP ==================== */
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

        /* ==================== ðŸ”„ LEGACY SYNC (backward compatibility) ==================== */
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
        onRehydrateStorage: () => (state) => {
          console.log('ðŸ”„ EventStore: Hydration complete');
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