import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { Event, EventDay, Session, EventType } from "@/types/Event";
import { Guest } from "@/store/guestStore";
import { Table } from "@/types/Table";
import { Chunk } from "@/types/Chunk";
import { calculateVIPExposure, AdjacencyMap } from "@/utils/eventStatisticHelper";
import { useTrackingStore } from "@/store/trackingStore";

interface EventStoreState {
  /* -------------------- 📦 State -------------------- */
  events: Event[];
  activeEventId: string | null;
  activeSessionId: string | null;
  _hasHydrated: boolean;

  /* -------------------- 🔄 Hydration -------------------- */
  setHasHydrated: (state: boolean) => void;

  /* -------------------- 📝 Event CRUD -------------------- */
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

  /* -------------------- 📇 Master Guest List -------------------- */
  addMasterGuest: (eventId: string, guest: Guest) => void;

  /* -------------------- 📅 Day & Session Management -------------------- */
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

  /* -------------------- 👥 Session Guest Management -------------------- */
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

  /* -------------------- 🧠 Seat Plan Snapshot -------------------- */
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
  } | null;

  /* -------------------- 📊 Statistics & Audit -------------------- */
  getPriorStats: (eventId: string, currentSessionId: string) => AdjacencyMap;
  checkSessionAuditStatus: (eventId: string, sessionId: string) => "clean" | "review_required";
  acknowledgeSessionWarnings: (eventId: string, sessionId: string) => void;

  /* -------------------- 💾 Import / Export -------------------- */
  exportEventJSON: (eventId: string) => string;
  importEventJSON: (jsonString: string) => boolean;

  /* -------------------- 🎯 TRACKING METADATA SYNC -------------------- */
  updateSessionTrackingStatus: (
    eventId: string,
    sessionId: string,
    isTracked: boolean,
    planningOrder?: number
  ) => void;

  updateEventTrackedGuests: (eventId: string, trackedGuestIds: string[]) => void;

  markSessionForReview: (eventId: string, sessionId: string, needsReview: boolean) => void;

  syncTrackingFromStore: (eventId: string) => void;
}

export const useEventStore = create<EventStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        events: [],
        activeEventId: null,
        activeSessionId: null,
        _hasHydrated: false,

        /* ---------- Hydration ---------- */
        setHasHydrated: (state) => {
          set({ _hasHydrated: state });
        },

        /* ---------- Event CRUD ---------- */
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
              },
            ],
          })),

        deleteEvent: (id) => {
          set((state) => {
            // Clean up tracking data for this event
            useTrackingStore.getState().clearEventTracking(id);

            return {
              events: state.events.filter((e) => e.id !== id),
              activeEventId: state.activeEventId === id ? null : state.activeEventId,
            };
          });
        },

        updateEventDetails: (id, data) =>
          set((state) => ({
            events: state.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
          })),

        setActiveEvent: (id) => set({ activeEventId: id }),
        setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

        /* ---------- Master Guest List ---------- */
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

        /* ---------- Day Management ---------- */
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

        deleteDay: (eventId, dayId) =>
          set((state) => ({
            events: state.events.map((e) =>
              e.id !== eventId
                ? e
                : {
                  ...e,
                  days: e.days.filter((d) => d.id !== dayId),
                }
            ),
          })),

        /* ---------- Session Management ---------- */
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
              // If it's already a Date object, use it; otherwise parse string to Date and toISOString
              const parsed = new Date(data.startTime);
              if (!isNaN(parsed.getTime())) {
                normalizedData.startTime = parsed.toISOString();
              } else {
                // fallback: leave as-is (but this should not happen)
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


        deleteSession: (eventId, dayId, sessionId) =>
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
          })),

        /* ---------- Session Guest Management ---------- */
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

        /* ---------- Seat Plan Snapshot ---------- */
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
                };
              }
            }
          }

          return null;
        },

        /* ---------- Statistics & Audit ---------- */
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

        /* ---------- Import / Export ---------- */
        exportEventJSON: (eventId) => {
          const event = get().events.find((e) => e.id === eventId);
          return event ? JSON.stringify(event, null, 2) : "";
        },

        importEventJSON: (jsonString) => {
          try {
            const eventData: Event = JSON.parse(jsonString);
            if (!eventData.id || !eventData.days) return false;

            set((state) => {
              const exists = state.events.some(e => e.id === eventData.id);
              if (exists) {
                return { events: state.events.map(e => e.id === eventData.id ? eventData : e) };
              }
              return { events: [...state.events, eventData] };
            });
            return true;
          } catch (e) {
            console.error("JSON Parse Error", e);
            return false;
          }
        },

        /* ---------- Tracking Metadata Sync ---------- */
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

        /**
         * Sync tracking data FROM the trackingStore TO the eventStore
         * This should be called after both stores have hydrated
         */
        syncTrackingFromStore: (eventId) => {
          const trackingStore = useTrackingStore.getState();
          const eventStore = get();
          
          const event = eventStore.events.find(e => e.id === eventId);
          if (!event) {
            console.warn(`syncTrackingFromStore: Event ${eventId} not found`);
            return;
          }

          // Get tracked data from tracking store
          const trackedGuestIds = trackingStore.getTrackedGuests(eventId);
          const trackedSessionIds = trackingStore.getTrackedSessions(eventId);

          console.log(`🔄 Syncing tracking data for event ${event.name}:`, {
            trackedGuests: trackedGuestIds.length,
            trackedSessions: trackedSessionIds.length,
          });

          // Update event's tracked guests
          if (trackedGuestIds.length > 0) {
            set((state) => ({
              events: state.events.map((e) =>
                e.id !== eventId
                  ? e
                  : {
                    ...e,
                    trackedGuestIds,
                    trackingEnabled: true,
                  }
              ),
            }));
          }

          // Update each session's tracking status
          const trackedSessionSet = new Set(trackedSessionIds);
          set((state) => ({
            events: state.events.map((e) => {
              if (e.id !== eventId) return e;
              return {
                ...e,
                days: e.days.map((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) => ({
                    ...s,
                    isTrackedForAdjacency: trackedSessionSet.has(s.id),
                  })),
                })),
              };
            }),
          }));

          console.log(`✅ Tracking sync complete for event ${event.name}`);
        },
      }),

      { 
        name: "event-master-store",
        onRehydrateStorage: () => (state) => {
          console.log('🔄 EventStore: Hydration complete');
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