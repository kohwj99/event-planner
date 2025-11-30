import { useEffect, useCallback, useRef } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { useTrackingStore } from '@/store/trackingStore';

export const useSessionLoader = (sessionId: string | null) => {
  const lastSessionIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  // Event Store
  const getSessionById = useEventStore((state) => state.getSessionById);
  const loadSessionSeatPlan = useEventStore((state) => state.loadSessionSeatPlan);
  const saveSessionSeatPlan = useEventStore((state) => state.saveSessionSeatPlan);
  const getSessionGuests = useEventStore((state) => state.getSessionGuests);
  const setActiveSession = useEventStore((state) => state.setActiveSession);
  const updateSessionTrackingStatus = useEventStore((state) => state.updateSessionTrackingStatus);

  // Seat Store - Direct setState for bulk operations
  const setSeatStoreState = useSeatStore.setState;
  const resetTables = useSeatStore((state) => state.resetTables);

  // Guest Store
  const resetGuests = useGuestStore((state) => state.resetGuests);
  const addGuest = useGuestStore((state) => state.addGuest);

  // Tracking Store
  const isSessionTracked = useTrackingStore((state) => state.isSessionTracked);
  const recordSessionAdjacency = useTrackingStore((state) => state.recordSessionAdjacency);
  const getSessionPlanningOrder = useTrackingStore((state) => state.getSessionPlanningOrder);

  // Save current session before switching
  const saveCurrentSession = useCallback(() => {
    const currentSessionId = lastSessionIdRef.current;
    if (!currentSessionId) return;

    const sessionData = getSessionById(currentSessionId);
    if (!sessionData) return;

    const { tables, chunks } = useSeatStore.getState();

    // Collect all assigned guest IDs from seats
    const activeGuestIds = new Set<string>();
    tables.forEach(table => {
      table.seats.forEach(seat => {
        if (seat.assignedGuestId) {
          activeGuestIds.add(seat.assignedGuestId);
        }
      });
    });

    console.log(`💾 Saving session: ${sessionData.session.name}`);
    
    // Save seat plan to event store
    saveSessionSeatPlan(sessionData.eventId, sessionData.dayId, currentSessionId, {
      tables,
      chunks,
      activeGuestIds: Array.from(activeGuestIds),
    });

    // 🆕 Check if this session is tracked
    const tracked = isSessionTracked(sessionData.eventId, currentSessionId);
    
    if (tracked) {
      console.log(`👁️ Recording adjacency data for tracked session`);
      
      // Record adjacency data (this also updates planning order in tracking store)
      recordSessionAdjacency(
        sessionData.eventId,
        currentSessionId,
        sessionData.session.startTime,
        tables
      );
      
      // 🆕 CRITICAL: Sync planning order back to event store for persistence
      const planningOrder = getSessionPlanningOrder(sessionData.eventId, currentSessionId);
      
      if (planningOrder > 0) {
        console.log(`📝 Syncing planning order ${planningOrder} to event store`);
        updateSessionTrackingStatus(
          sessionData.eventId,
          currentSessionId,
          true,
          planningOrder
        );
      }
    }
  }, [
    getSessionById, 
    saveSessionSeatPlan, 
    isSessionTracked, 
    recordSessionAdjacency,
    getSessionPlanningOrder,
    updateSessionTrackingStatus
  ]);

  // Load session data
  const loadSession = useCallback((newSessionId: string) => {
    console.log(`📂 Loading session: ${newSessionId}`);

    const sessionData = getSessionById(newSessionId);
    if (!sessionData) {
      console.error('Session not found');
      return;
    }

    // Load seat plan
    const seatPlan = loadSessionSeatPlan(newSessionId);
    if (seatPlan && seatPlan.tables.length > 0) {
      // Existing session with data
      console.log('Loading existing seat plan with', seatPlan.tables.length, 'tables');
      setSeatStoreState({
        tables: seatPlan.tables,
        chunks: seatPlan.chunks,
        selectedTableId: null,
        selectedSeatId: null,
      });
    } else {
      // New session - initialize with proper chunk structure
      console.log('Initializing new session with default chunk');
      resetTables();
    }

    // Load guests
    resetGuests();
    const sessionGuests = getSessionGuests(newSessionId);
    if (sessionGuests) {
      [...sessionGuests.hostGuests, ...sessionGuests.externalGuests].forEach(guest => {
        addGuest(guest);
      });
    }

    setActiveSession(newSessionId);
    lastSessionIdRef.current = newSessionId;
    hasLoadedRef.current = true;
  }, [getSessionById, loadSessionSeatPlan, getSessionGuests, setSeatStoreState, resetGuests, addGuest, setActiveSession, resetTables]);

  // Handle session changes
  useEffect(() => {
    if (!sessionId) {
      // Cleanup when navigating away
      if (lastSessionIdRef.current) {
        saveCurrentSession();
        lastSessionIdRef.current = null;
        hasLoadedRef.current = false;
      }
      return;
    }

    // Save previous session if switching
    if (lastSessionIdRef.current && lastSessionIdRef.current !== sessionId) {
      saveCurrentSession();
      hasLoadedRef.current = false;
    }

    // Load new session
    if (lastSessionIdRef.current !== sessionId || !hasLoadedRef.current) {
      loadSession(sessionId);
    }
  }, [sessionId, saveCurrentSession, loadSession, setActiveSession]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (lastSessionIdRef.current) {
        saveCurrentSession();
      }
    };
  }, [saveCurrentSession]);

  return {
    saveCurrentSession,
  };
};