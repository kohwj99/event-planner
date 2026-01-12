import { useEffect, useCallback, useRef, useState } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { detectProximityViolations } from '@/utils/violationDetector';
import { StoredProximityViolation } from '@/types/Event';

/**
 * Hook for loading and saving session data
 * 
 * This hook manages:
 * 1. Loading session seat plans when navigating to a session
 * 2. Saving seat plans when navigating away
 * 3. Recording adjacency data for tracked sessions
 * 4. Loading and saving session rules (proximity rules, sort order, table rules)
 * 5. Loading and saving violations
 * 6. CRITICAL: Syncing guestStore with eventStore session guests
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
  
  // Session rules methods
  const loadSessionRules = useEventStore((state) => state.loadSessionRules);
  const saveSessionRules = useEventStore((state) => state.saveSessionRules);
  const loadSessionViolations = useEventStore((state) => state.loadSessionViolations);
  const saveSessionViolations = useEventStore((state) => state.saveSessionViolations);
  
  // Tracking functions - now from eventStore
  const isSessionTracked = useEventStore((state) => state.isSessionTracked);
  const recordSessionAdjacency = useEventStore((state) => state.recordSessionAdjacency);
  const getSessionPlanningOrder = useEventStore((state) => state.getSessionPlanningOrder);

  // Seat Store - Direct setState for bulk operations
  const setSeatStoreState = useSeatStore.setState;
  const resetTables = useSeatStore((state) => state.resetTables);

  // Guest Store - now using setGuests for bulk sync
  const setGuests = useGuestStore((state) => state.setGuests);

  // Save current session before switching
  const saveCurrentSession = useCallback(() => {
    const currentSessionId = lastSessionIdRef.current;
    if (!currentSessionId) return;

    const sessionData = getSessionById(currentSessionId);
    if (!sessionData) return;

    const { tables, chunks, selectedMealPlanIndex, violations, proximityRules } = useSeatStore.getState();

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

    // Save violations to session
    if (violations && violations.length > 0) {
      const storedViolations: StoredProximityViolation[] = violations.map(v => ({
        type: v.type,
        guest1Id: v.guest1Id,
        guest2Id: v.guest2Id,
        guest1Name: v.guest1Name,
        guest2Name: v.guest2Name,
        tableId: v.tableId,
        tableLabel: v.tableLabel,
        seat1Id: v.seat1Id,
        seat2Id: v.seat2Id,
        reason: v.reason,
      }));
      saveSessionViolations(sessionData.eventId, sessionData.dayId, currentSessionId, storedViolations);
      console.log(`Saved ${storedViolations.length} violations to session`);
    } else {
      // Clear violations if none exist
      saveSessionViolations(sessionData.eventId, sessionData.dayId, currentSessionId, []);
    }

    // Note: Rules are saved in AutoFillModal when user confirms autofill
    // We don't overwrite rules here to preserve intentionally configured rules

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
    saveSessionViolations,
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

    // CRITICAL FIX: Use the new setGuests function for bulk sync
    // This ensures all guests from the session are properly synced to guestStore
    // and preserves the deleted status for existing guests
    const sessionGuests = getSessionGuests(newSessionId);
    let allLoadedGuests: any[] = [];
    
    if (sessionGuests) {
      const { hostGuests, externalGuests } = sessionGuests;
      allLoadedGuests = [...hostGuests, ...externalGuests];
      
      console.log('Syncing session guests to guestStore:', {
        hostCount: hostGuests.length,
        externalCount: externalGuests.length,
      });
      
      // Use setGuests for atomic bulk sync (preserves deleted status)
      setGuests(hostGuests, externalGuests);
    } else {
      console.log('No session guests found, clearing guestStore');
      setGuests([], []);
    }

    // Build guest lookup for violation detection
    const guestLookup: Record<string, any> = {};
    allLoadedGuests.forEach(g => {
      guestLookup[g.id] = g;
    });

    // Load session rules if they exist
    const savedRules = loadSessionRules(newSessionId);
    if (savedRules) {
      console.log('Loading saved session rules');
      
      // Set proximity rules in seatStore for violation detection
      if (savedRules.proximityRules) {
        const seatStore = useSeatStore.getState();
        seatStore.setProximityRules(savedRules.proximityRules);
      }
    }
    
    // Update the seatStore with guest lookup for violation detection
    const seatStoreState = useSeatStore.getState();
    seatStoreState.setGuestLookup(guestLookup);

    // Load stored violations OR detect new ones
    const storedViolations = loadSessionViolations(newSessionId);
    
    if (storedViolations && storedViolations.length > 0) {
      // Use stored violations - this shows violations that existed when user left
      console.log(`Loading ${storedViolations.length} stored violations`);
      useSeatStore.setState({ violations: storedViolations });
    } else if (savedRules?.proximityRules && seatPlan && seatPlan.tables.length > 0) {
      // No stored violations but we have rules - detect violations
      console.log('Detecting violations based on saved rules');
      const detectedViolations = detectProximityViolations(
        seatPlan.tables,
        savedRules.proximityRules,
        guestLookup
      );
      useSeatStore.setState({ violations: detectedViolations });
      console.log(`Detected ${detectedViolations.length} violations`);
    } else {
      // No rules or no tables - clear violations
      useSeatStore.setState({ violations: [] });
    }
    
    console.log('Session loaded with rules and violations');

    setActiveSession(newSessionId);
    lastSessionIdRef.current = newSessionId;
    hasLoadedRef.current = true;
  }, [
    getSessionById, 
    loadSessionSeatPlan, 
    loadSessionRules,
    loadSessionViolations,
    getSessionGuests, 
    setSeatStoreState, 
    setGuests, 
    setActiveSession, 
    resetTables
  ]);

  /**
   * Force re-sync guests from eventStore to guestStore.
   * This is useful when guests are added/modified in the master list
   * and need to be reflected in the current session without full reload.
   */
  const resyncGuests = useCallback(() => {
    if (!sessionId) return false;
    
    const sessionGuests = getSessionGuests(sessionId);
    if (!sessionGuests) return false;
    
    const { hostGuests, externalGuests } = sessionGuests;
    
    console.log('useSessionLoader.resyncGuests: Force syncing guests', {
      hostCount: hostGuests.length,
      externalCount: externalGuests.length,
    });
    
    setGuests(hostGuests, externalGuests);
    
    // Update guest lookup in seatStore
    const guestLookup: Record<string, any> = {};
    [...hostGuests, ...externalGuests].forEach(g => {
      guestLookup[g.id] = g;
    });
    useSeatStore.getState().setGuestLookup(guestLookup);
    
    return true;
  }, [sessionId, getSessionGuests, setGuests]);

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
    resyncGuests,
    isHydrated: isReady,
  };
};