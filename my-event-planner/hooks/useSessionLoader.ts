import { useEffect, useCallback, useRef } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';

export const useSessionLoader = (sessionId: string | null) => {
  const lastSessionIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  // Event Store
  const getSessionById = useEventStore((state) => state.getSessionById);
  const loadSessionSeatPlan = useEventStore((state) => state.loadSessionSeatPlan);
  const saveSessionSeatPlan = useEventStore((state) => state.saveSessionSeatPlan);
  const getSessionGuests = useEventStore((state) => state.getSessionGuests);
  const setActiveSession = useEventStore((state) => state.setActiveSession);

  // Seat Store - Direct setState for bulk operations
  const setSeatStoreState = useSeatStore.setState;
  const resetTables = useSeatStore((state) => state.resetTables);

  // Guest Store
  const resetGuests = useGuestStore((state) => state.resetGuests);
  const addGuest = useGuestStore((state) => state.addGuest);

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
    saveSessionSeatPlan(sessionData.eventId, sessionData.dayId, currentSessionId, {
      tables,
      chunks,
      activeGuestIds: Array.from(activeGuestIds),
    });
  }, [getSessionById, saveSessionSeatPlan]);

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
      // Use resetTables which properly initializes the default chunk
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