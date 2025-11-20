import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { Event, EventDay, Session, EventType } from "@/types/Event";
import { Guest } from "@/store/guestStore";
import { calculateVIPExposure, AdjacencyMap } from "@/utils/eventStatisticHelper";

interface EventStoreState {
  /* -------------------- 📦 State -------------------- */
  events: Event[];
  activeEventId: string | null;

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

  /* -------------------- 📇 Master Guest List -------------------- */
  addMasterGuest: (eventId: string, guest: Guest) => void;

  /* -------------------- 📅 Day & Session Management -------------------- */
  addDay: (eventId: string, date: string) => void;
  
  // 🆕 Enhanced addSession to accept all form data
  addSession: (
    eventId: string, 
    dayId: string, 
    sessionData: {
      name: string;
      description: string;
      sessionType: EventType;
      startTime: string; // ISO
    }
  ) => void;

  updateSession: (
    eventId: string,
    dayId: string,
    sessionId: string,
    data: Partial<Session>
  ) => void;

  deleteSession: (eventId: string, dayId: string, sessionId: string) => void;

  /* -------------------- 🧠 Seat Plan Snapshot -------------------- */
  saveSessionSeatPlan: (
    eventId: string, 
    dayId: string, 
    sessionId: string, 
    seatPlan: Session['seatPlan']
  ) => void;

  /* -------------------- 📊 Statistics & Audit -------------------- */
  getPriorStats: (eventId: string, currentSessionId: string) => AdjacencyMap;
  checkSessionAuditStatus: (eventId: string, sessionId: string) => "clean" | "review_required";
  acknowledgeSessionWarnings: (eventId: string, sessionId: string) => void;

  /* -------------------- 💾 Import / Export -------------------- */
  exportEventJSON: (eventId: string) => string;
  importEventJSON: (jsonString: string) => boolean;
}

export const useEventStore = create<EventStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        events: [],
        activeEventId: null,

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
                startDate, // 🆕 Saved
                createdAt: new Date().toISOString(),
                masterHostGuests: [],
                masterExternalGuests: [],
                days: [],
              },
            ],
          })),

        deleteEvent: (id) =>
          set((state) => ({
            events: state.events.filter((e) => e.id !== id),
          })),

        updateEventDetails: (id, data) =>
          set((state) => ({
            events: state.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
          })),

        setActiveEvent: (id) => set({ activeEventId: id }),

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
                            startTime: sessionData.startTime,
                            // Default EndTime to start + 1 hour for now
                            endTime: new Date(new Date(sessionData.startTime).getTime() + 60*60*1000).toISOString(),
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
                      s.id !== sessionId ? s : { ...s, ...data }
                    ),
                  };
                }),
              };
            }),
          })),

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
                              lastModified: now, // 🚩 Audit Timestamp
                            }
                      ),
                    };
                  }),
                };
              }),
            };
          }),

        /* ---------- Statistics & Audit ---------- */
        getPriorStats: (eventId, currentSessionId) => {
          const event = get().events.find((e) => e.id === eventId);
          if (!event) return {};

          const allSessions = event.days.flatMap((d) => d.sessions);
          const currentSession = allSessions.find((s) => s.id === currentSessionId);
          if (!currentSession) return {};

          // Strict type filtering
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
        }
      }),
      { name: "event-master-store" }
    )
  )
);