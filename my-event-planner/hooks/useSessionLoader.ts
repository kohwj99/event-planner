import { useEffect, useCallback, useRef, useState } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';

/**
 * Hook for loading and saving session data
 * 
 * This hook manages:
 * 1. Loading session seat plans when navigating to a session
 * 2. Saving seat plans when navigating away
 * 3. Recording adjacency data for tracked sessions
 * 
 * NOTE: All tracking functionality is now in eventStore.
 * No separate trackingStore import is needed.
 */
export const useSessionLoader = (sessionId: string | null) => {
  const lastSessionIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);
  
  // Track if component has mounted to prevent SSR issues
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hydration check - CRITICAL for preventing data loss on refresh
  // Now using eventStore's hydration state directly
  const hasHydrated = useEventStore((state) => state._hasHydrated);
  
  // Combined check: mounted AND hydrated
  const isReady = isMounted && hasHydrated;

  // Event Store - includes all tracking functionality
  const getSessionById = useEventStore((state) => state.getSessionById);
  const loadSessionSeatPlan = useEventStore((state) => state.loadSessionSeatPlan);
  const saveSessionSeatPlan = useEventStore((state) => state.saveSessionSeatPlan);
  const getSessionGuests = useEventStore((state) => state.getSessionGuests);
  const setActiveSession = useEventStore((state) => state.setActiveSession);
  
  // Tracking functions - now from eventStore
  const isSessionTracked = useEventStore((state) => state.isSessionTracked);
  const recordSessionAdjacency = useEventStore((state) => state.recordSessionAdjacency);
  const getSessionPlanningOrder = useEventStore((state) => state.getSessionPlanningOrder);

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

    const { tables, chunks, selectedMealPlanIndex } = useSeatStore.getState();

    // Collect all assigned guest IDs from seats
    const activeGuestIds = new Set<string>();
    tables.forEach(table => {
      table.seats.forEach(seat => {
        if (seat.assignedGuestId) {
          activeGuestIds.add(seat.assignedGuestId);
        }
      });
    });

    console.log(`Saving session: ${sessionData.session.name}`);
    
    // Save seat plan to event store (including selectedMealPlanIndex)
    saveSessionSeatPlan(sessionData.eventId, sessionData.dayId, currentSessionId, {
      tables,
      chunks,
      activeGuestIds: Array.from(activeGuestIds),
      selectedMealPlanIndex,
    });

    // Check if this session is tracked (using eventStore as source of truth)
    const tracked = isSessionTracked(sessionData.eventId, currentSessionId);
    
    if (tracked) {
      console.log(`Recording adjacency data for tracked session`);
      
      // Record adjacency data (this also updates planning order)
      recordSessionAdjacency(
        sessionData.eventId,
        currentSessionId,
        sessionData.session.startTime,
        tables
      );
      
      // Log the planning order for debugging
      const planningOrder = getSessionPlanningOrder(sessionData.eventId, currentSessionId);
      console.log(`Session planning order: ${planningOrder}`);
    }
  }, [
    getSessionById, 
    saveSessionSeatPlan, 
    isSessionTracked, 
    recordSessionAdjacency,
    getSessionPlanningOrder,
  ]);

  // Load session data
  const loadSession = useCallback((newSessionId: string) => {
    console.log(`Loading session: ${newSessionId}`);

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
        selectedMealPlanIndex: seatPlan.selectedMealPlanIndex ?? null,
      });
    } else {
      // New session - initialize with proper chunk structure
      console.log('Initializing new session with default chunk');
      resetTables();
    }

    // Load guests
    resetGuests();
    const sessionGuests = getSessionGuests(newSessionId);
    let allLoadedGuests: any[] = [];
    if (sessionGuests) {
      allLoadedGuests = [...sessionGuests.hostGuests, ...sessionGuests.externalGuests];
      allLoadedGuests.forEach(guest => {
        addGuest(guest);
      });
    }

    // Build guest lookup and trigger violation detection
    const guestLookup: Record<string, any> = {};
    allLoadedGuests.forEach(g => {
      guestLookup[g.id] = g;
    });
    
    // Update the seatStore with guest lookup for violation detection
    const seatStoreState = useSeatStore.getState();
    seatStoreState.setGuestLookup(guestLookup);
    
    // Trigger violation detection (will use existing proximityRules if any)
    seatStoreState.detectViolations();
    console.log('Session loaded, violation detection triggered');

    setActiveSession(newSessionId);
    lastSessionIdRef.current = newSessionId;
    hasLoadedRef.current = true;
  }, [getSessionById, loadSessionSeatPlan, getSessionGuests, setSeatStoreState, resetGuests, addGuest, setActiveSession, resetTables]);

  // Handle session changes - ONLY after hydration is complete
  useEffect(() => {
    // CRITICAL: Don't do anything until mounted and stores are hydrated
    if (!isReady) {
      console.log('Waiting for store hydration before loading session...');
      return;
    }

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
  }, [sessionId, isReady, saveCurrentSession, loadSession, setActiveSession]);

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
    isHydrated: isReady,
  };
};