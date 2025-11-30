import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { Table } from "@/types/Table";

/* -------------------- 📊 TYPES -------------------- */

interface SessionAdjacencyRecord {
    sessionId: string;
    sessionStartTime: string;
    planningOrder: number;
    trackedGuestId: string;
    adjacentGuestIds: string[];
    needsReview?: boolean;
}

type EventAdjacencyMap = Record<string, SessionAdjacencyRecord[]>;

interface PlanningOrderTracker {
    sessionOrderMap: Record<string, number>;
    nextOrder: number;
}

/* -------------------- 🔄 STORAGE ADAPTER -------------------- */

interface PersistedState {
    trackedGuestsByEvent: Record<string, string[]>;
    trackedSessionsByEvent: Record<string, string[]>;
    adjacencyRecordsByEvent: EventAdjacencyMap;
    planningOrderByEvent: Record<string, PlanningOrderTracker>;
}

interface StoreState {
    trackedGuestsByEvent: Record<string, Set<string>>;
    trackedSessionsByEvent: Record<string, Set<string>>;
    adjacencyRecordsByEvent: EventAdjacencyMap;
    planningOrderByEvent: Record<string, PlanningOrderTracker>;
}

import { StateStorage } from "zustand/middleware"

const customStorage: StateStorage = {
    getItem: (name: string): string | null => {
        if (typeof window === "undefined") return null

        const str = localStorage.getItem(name)
        if (!str) return null

        try {
            const parsed: PersistedState = JSON.parse(str)

            const converted: StoreState = {
                trackedGuestsByEvent: Object.fromEntries(
                    Object.entries(parsed.trackedGuestsByEvent || {}).map(
                        ([k, v]) => [k, new Set(Array.isArray(v) ? v : [])]
                    )
                ),
                trackedSessionsByEvent: Object.fromEntries(
                    Object.entries(parsed.trackedSessionsByEvent || {}).map(
                        ([k, v]) => [k, new Set(Array.isArray(v) ? v : [])]
                    )
                ),
                adjacencyRecordsByEvent: parsed.adjacencyRecordsByEvent || {},
                planningOrderByEvent: parsed.planningOrderByEvent || {},
            }

            return JSON.stringify({
                state: converted,
                version: 0,
            })
        } catch (e) {
            console.error("TrackingStore getItem error:", e)
            return null
        }
    },

    setItem: (name: string, value: string) => {
        try {
            const parsed = JSON.parse(value)
            const state: StoreState = parsed.state

            const toStore: PersistedState = {
                trackedGuestsByEvent: Object.fromEntries(
                    Object.entries(state.trackedGuestsByEvent || {}).map(
                        ([k, v]) => [k, v instanceof Set ? Array.from(v) : []]
                    )
                ),
                trackedSessionsByEvent: Object.fromEntries(
                    Object.entries(state.trackedSessionsByEvent || {}).map(
                        ([k, v]) => [k, v instanceof Set ? Array.from(v) : []]
                    )
                ),
                adjacencyRecordsByEvent: state.adjacencyRecordsByEvent || {},
                planningOrderByEvent: state.planningOrderByEvent || {},
            }

            localStorage.setItem(name, JSON.stringify(toStore))
        } catch (e) {
            console.error("TrackingStore setItem error:", e)
        }
    },

    removeItem: (name: string) => {
        localStorage.removeItem(name)
    },
}

/* -------------------- 🏪 STORE INTERFACE -------------------- */

interface TrackingStoreState {
    trackedGuestsByEvent: Record<string, Set<string>>;
    trackedSessionsByEvent: Record<string, Set<string>>;
    adjacencyRecordsByEvent: EventAdjacencyMap;
    planningOrderByEvent: Record<string, PlanningOrderTracker>;

    /* -------------------- GUEST TRACKING -------------------- */
    toggleGuestTracking: (eventId: string, guestId: string) => void;
    isGuestTracked: (eventId: string, guestId: string) => boolean;
    getTrackedGuests: (eventId: string) => string[];
    clearEventGuestTracking: (eventId: string) => void;

    /* -------------------- SESSION TRACKING -------------------- */
    toggleSessionTracking: (eventId: string, sessionId: string) => void;
    setSessionTracking: (eventId: string, sessionId: string, tracked: boolean) => void;
    isSessionTracked: (eventId: string, sessionId: string) => boolean;
    getTrackedSessions: (eventId: string) => string[];
    clearEventSessionTracking: (eventId: string) => void;

    /* -------------------- PLANNING ORDER MANAGEMENT -------------------- */
    getSessionPlanningOrder: (eventId: string, sessionId: string) => number;
    resetSessionPlanningOrder: (eventId: string, sessionId: string) => void;

    /* -------------------- ADJACENCY RECORDING -------------------- */
    recordSessionAdjacency: (
        eventId: string,
        sessionId: string,
        sessionStartTime: string,
        tables: Table[]
    ) => void;

    removeSessionAdjacency: (eventId: string, sessionId: string) => void;
    getEventAdjacencyRecords: (eventId: string) => SessionAdjacencyRecord[];

    /* -------------------- ANALYSIS HELPERS -------------------- */
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

    /* -------------------- CLEANUP -------------------- */
    clearEventTracking: (eventId: string) => void;
}

/* -------------------- 🏗️ STORE IMPLEMENTATION -------------------- */

export const useTrackingStore = create<TrackingStoreState>()(
    devtools(
        persist(
            (set, get) => ({
                trackedGuestsByEvent: {},
                trackedSessionsByEvent: {},
                adjacencyRecordsByEvent: {},
                planningOrderByEvent: {},

                /* -------------------- GUEST TRACKING -------------------- */
                toggleGuestTracking: (eventId, guestId) =>
                    set((state) => {
                        const currentSet = state.trackedGuestsByEvent[eventId];
                        const eventGuests = new Set(currentSet instanceof Set ? currentSet : []);

                        if (eventGuests.has(guestId)) {
                            eventGuests.delete(guestId);
                        } else {
                            eventGuests.add(guestId);
                        }

                        return {
                            trackedGuestsByEvent: {
                                ...state.trackedGuestsByEvent,
                                [eventId]: eventGuests,
                            },
                        };
                    }),

                isGuestTracked: (eventId, guestId) => {
                    const state = get();
                    const eventSet = state.trackedGuestsByEvent[eventId];
                    
                    if (!eventSet) return false;
                    if (!(eventSet instanceof Set)) {
                        // Recover from corrupted state
                        console.warn('Recovering corrupted guest tracking state');
                        return false;
                    }
                    
                    return eventSet.has(guestId);
                },

                getTrackedGuests: (eventId) => {
                    const state = get();
                    const eventSet = state.trackedGuestsByEvent[eventId];
                    
                    if (!eventSet) return [];
                    if (!(eventSet instanceof Set)) return [];
                    
                    return Array.from(eventSet);
                },

                clearEventGuestTracking: (eventId) =>
                    set((state) => {
                        const updated = { ...state.trackedGuestsByEvent };
                        delete updated[eventId];
                        return { trackedGuestsByEvent: updated };
                    }),

                /* -------------------- SESSION TRACKING -------------------- */
                toggleSessionTracking: (eventId, sessionId) =>
                    set((state) => {
                        const currentSet = state.trackedSessionsByEvent[eventId];
                        const eventSessions = new Set(currentSet instanceof Set ? currentSet : []);

                        if (eventSessions.has(sessionId)) {
                            eventSessions.delete(sessionId);
                        } else {
                            eventSessions.add(sessionId);
                        }

                        return {
                            trackedSessionsByEvent: {
                                ...state.trackedSessionsByEvent,
                                [eventId]: eventSessions,
                            },
                        };
                    }),

                setSessionTracking: (eventId, sessionId, tracked) =>
                    set((state) => {
                        const currentSet = state.trackedSessionsByEvent[eventId];
                        const eventSessions = new Set(currentSet instanceof Set ? currentSet : []);

                        if (tracked) {
                            eventSessions.add(sessionId);
                        } else {
                            eventSessions.delete(sessionId);
                        }

                        return {
                            trackedSessionsByEvent: {
                                ...state.trackedSessionsByEvent,
                                [eventId]: eventSessions,
                            },
                        };
                    }),

                isSessionTracked: (eventId, sessionId) => {
                    const state = get();
                    const eventSet = state.trackedSessionsByEvent[eventId];
                    
                    if (!eventSet) return false;
                    if (!(eventSet instanceof Set)) {
                        // Recover from corrupted state
                        console.warn('Recovering corrupted session tracking state');
                        return false;
                    }
                    
                    return eventSet.has(sessionId);
                },

                getTrackedSessions: (eventId) => {
                    const state = get();
                    const eventSet = state.trackedSessionsByEvent[eventId];
                    
                    if (!eventSet) return [];
                    if (!(eventSet instanceof Set)) return [];
                    
                    return Array.from(eventSet);
                },

                clearEventSessionTracking: (eventId) =>
                    set((state) => {
                        const updated = { ...state.trackedSessionsByEvent };
                        delete updated[eventId];
                        return { trackedSessionsByEvent: updated };
                    }),

                /* -------------------- PLANNING ORDER MANAGEMENT -------------------- */
                getSessionPlanningOrder: (eventId, sessionId) => {
                    const state = get();
                    const tracker = state.planningOrderByEvent[eventId];
                    
                    if (!tracker) return -1;
                    return tracker.sessionOrderMap[sessionId] ?? -1;
                },

                resetSessionPlanningOrder: (eventId, sessionId) =>
                    set((state) => {
                        const tracker = state.planningOrderByEvent[eventId];
                        if (!tracker) return state;

                        const updatedMap = { ...tracker.sessionOrderMap };
                        delete updatedMap[sessionId];

                        return {
                            planningOrderByEvent: {
                                ...state.planningOrderByEvent,
                                [eventId]: {
                                    ...tracker,
                                    sessionOrderMap: updatedMap,
                                },
                            },
                        };
                    }),

                /* -------------------- ADJACENCY RECORDING -------------------- */
                recordSessionAdjacency: (eventId, sessionId, sessionStartTime, tables) => {
                    const state = get();
                    const trackedGuests = state.trackedGuestsByEvent[eventId];

                    if (!trackedGuests || !(trackedGuests instanceof Set) || trackedGuests.size === 0) {
                        console.warn(`No tracked guests for event ${eventId}`);
                        return;
                    }

                    let tracker = state.planningOrderByEvent[eventId];
                    if (!tracker) {
                        tracker = {
                            sessionOrderMap: {},
                            nextOrder: 1,
                        };
                    }

                    const currentOrder = tracker.sessionOrderMap[sessionId];
                    const isReplanning = currentOrder !== undefined;
                    const planningOrder = isReplanning ? currentOrder : tracker.nextOrder;

                    const existingRecords = state.adjacencyRecordsByEvent[eventId] || [];
                    const filteredRecords = existingRecords.filter(r => r.sessionId !== sessionId);

                    const newRecords: SessionAdjacencyRecord[] = [];

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

                    set((state) => ({
                        adjacencyRecordsByEvent: {
                            ...state.adjacencyRecordsByEvent,
                            [eventId]: allRecords,
                        },
                        planningOrderByEvent: {
                            ...state.planningOrderByEvent,
                            [eventId]: updatedTracker,
                        },
                    }));

                    console.log(`✅ Recorded adjacency for session ${sessionId}`, {
                        planningOrder,
                        isReplanning,
                        newRecordsCount: newRecords.length,
                        downstreamSessionsMarked: isReplanning ? 
                            updatedRecords.filter(r => r.needsReview).length : 0
                    });
                },

                removeSessionAdjacency: (eventId, sessionId) =>
                    set((state) => {
                        const existingRecords = state.adjacencyRecordsByEvent[eventId] || [];
                        const filteredRecords = existingRecords.filter(r => r.sessionId !== sessionId);

                        const tracker = state.planningOrderByEvent[eventId];
                        if (tracker) {
                            const updatedMap = { ...tracker.sessionOrderMap };
                            delete updatedMap[sessionId];

                            return {
                                adjacencyRecordsByEvent: {
                                    ...state.adjacencyRecordsByEvent,
                                    [eventId]: filteredRecords,
                                },
                                planningOrderByEvent: {
                                    ...state.planningOrderByEvent,
                                    [eventId]: {
                                        ...tracker,
                                        sessionOrderMap: updatedMap,
                                    },
                                },
                            };
                        }

                        return {
                            adjacencyRecordsByEvent: {
                                ...state.adjacencyRecordsByEvent,
                                [eventId]: filteredRecords,
                            },
                        };
                    }),

                getEventAdjacencyRecords: (eventId) => {
                    const state = get();
                    return state.adjacencyRecordsByEvent[eventId] || [];
                },

                /* -------------------- ANALYSIS HELPERS -------------------- */
                getHistoricalAdjacencyCount: (eventId, currentSessionId, trackedGuestId) => {
                    const state = get();
                    const allRecords = state.adjacencyRecordsByEvent[eventId] || [];
                    const tracker = state.planningOrderByEvent[eventId];

                    if (!tracker) return {};

                    const currentOrder = tracker.sessionOrderMap[currentSessionId];
                    if (currentOrder === undefined) {
                        return {};
                    }

                    const relevantRecords = allRecords.filter(
                        r => r.planningOrder < currentOrder && 
                             r.trackedGuestId === trackedGuestId
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
                    const state = get();
                    const adjacencyCount = state.getHistoricalAdjacencyCount(
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
                    const allRecords = state.adjacencyRecordsByEvent[eventId] || [];
                    
                    const sessionsNeedingReview = new Set<string>();
                    allRecords.forEach(record => {
                        if (record.needsReview) {
                            sessionsNeedingReview.add(record.sessionId);
                        }
                    });

                    return Array.from(sessionsNeedingReview);
                },

                acknowledgeSessionReview: (eventId, sessionId) =>
                    set((state) => {
                        const allRecords = state.adjacencyRecordsByEvent[eventId] || [];
                        
                        const updatedRecords = allRecords.map(record => {
                            if (record.sessionId === sessionId) {
                                return { ...record, needsReview: false };
                            }
                            return record;
                        });

                        return {
                            adjacencyRecordsByEvent: {
                                ...state.adjacencyRecordsByEvent,
                                [eventId]: updatedRecords,
                            },
                        };
                    }),

                /* -------------------- CLEANUP -------------------- */
                clearEventTracking: (eventId) =>
                    set((state) => {
                        const updatedGuests = { ...state.trackedGuestsByEvent };
                        const updatedSessions = { ...state.trackedSessionsByEvent };
                        const updatedAdjacency = { ...state.adjacencyRecordsByEvent };
                        const updatedPlanning = { ...state.planningOrderByEvent };

                        delete updatedGuests[eventId];
                        delete updatedSessions[eventId];
                        delete updatedAdjacency[eventId];
                        delete updatedPlanning[eventId];

                        return {
                            trackedGuestsByEvent: updatedGuests,
                            trackedSessionsByEvent: updatedSessions,
                            adjacencyRecordsByEvent: updatedAdjacency,
                            planningOrderByEvent: updatedPlanning,
                        };
                    }),
            }),
            {
                name: "boss-adjacency-tracking-store",
                storage: createJSONStorage(() => customStorage),
            }
        ),
        { name: "TrackingStore" }
    )
);