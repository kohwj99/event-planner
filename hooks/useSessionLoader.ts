import { useEffect, useCallback, useRef, useState } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { useColorModeStore } from '@/store/colorModeStore';
import { detectProximityViolations } from '@/utils/violationDetector';
import { StoredProximityViolation, SessionUISettings, DEFAULT_SESSION_UI_SETTINGS } from '@/types/Event';

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
 * 7. Loading and saving UI settings (zoom, connector gap, photo mode, etc.)
 * 8. Session lock state management
 * 
 * NOTE: All tracking functionality is now in eventStore.
 * No separate trackingStore import is needed.
 */
export const useSessionLoader = (sessionId: string | null) => {
  const lastSessionIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);
  
  // Track if component has mounted to prevent SSR issues
  const [isMounted, setIsMounted] = useState(false);
  
  // UI Settings state - will be passed to PlaygroundCanvas
  const [uiSettings, setUISettings] = useState<SessionUISettings>(DEFAULT_SESSION_UI_SETTINGS);
  const [isLocked, setIsLocked] = useState(false);
  
  // Track session context for saving UI settings
  const sessionContextRef = useRef<{ eventId: string; dayId: string } | null>(null);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hydration check - CRITICAL for preventing data loss on refresh
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
  const saveSessionViolations = useEventStore((state) => state.saveSessionViolations);
  const loadSessionViolations = useEventStore((state) => state.loadSessionViolations);
  
  // UI Settings methods
  const saveSessionUISettings = useEventStore((state) => state.saveSessionUISettings);
  
  // Lock methods
  const toggleSessionLockStore = useEventStore((state) => state.toggleSessionLock);
  
  // Tracking functions - now from eventStore
  const isSessionTracked = useEventStore((state) => state.isSessionTracked);
  const recordSessionAdjacency = useEventStore((state) => state.recordSessionAdjacency);
  const getSessionPlanningOrder = useEventStore((state) => state.getSessionPlanningOrder);

  // Seat Store - Direct setState for bulk operations
  const setSeatStoreState = useSeatStore.setState;
  const resetTables = useSeatStore((state) => state.resetTables);

  // Guest Store - now using setGuests for bulk sync
  const setGuests = useGuestStore((state) => state.setGuests);
  
  // Color Mode Store - for colorblind mode sync
  const setColorMode = useColorModeStore((state) => state.setColorMode);

  // Save current session before switching
  const saveCurrentSession = useCallback(() => {
    const currentSessionId = lastSessionIdRef.current;
    if (!currentSessionId) return;

    const sessionData = getSessionById(currentSessionId);
    if (!sessionData) return;

    const { tables, chunks, selectedMealPlanIndex, violations } = useSeatStore.getState();

    // Collect all assigned guest IDs from seats
    const activeGuestIds = new Set<string>();
    tables.forEach(table => {
      table.seats.forEach(seat => {
        if (seat.assignedGuestId) {
          activeGuestIds.add(seat.assignedGuestId);
        }
      });
    });

    console.log(`[useSessionLoader] Saving session: ${sessionData.session.name}`);
    console.log(`[useSessionLoader] Saving UI settings:`, uiSettings);
    
    // Save seat plan to event store (including uiSettings)
    saveSessionSeatPlan(sessionData.eventId, sessionData.dayId, currentSessionId, {
      tables,
      chunks,
      activeGuestIds: Array.from(activeGuestIds),
      selectedMealPlanIndex,
      uiSettings, // Include UI settings in seat plan
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
      console.log(`[useSessionLoader] Saved ${storedViolations.length} violations to session`);
    } else {
      // Clear violations if none exist
      saveSessionViolations(sessionData.eventId, sessionData.dayId, currentSessionId, []);
    }

    // Check if this session is tracked (using eventStore as source of truth)
    const tracked = isSessionTracked(sessionData.eventId, currentSessionId);
    
    if (tracked) {
      console.log(`[useSessionLoader] Recording adjacency data for tracked session`);
      
      // Record adjacency data (this also updates planning order)
      recordSessionAdjacency(
        sessionData.eventId,
        currentSessionId,
        sessionData.session.startTime,
        tables
      );
      
      // Log the planning order for debugging
      const planningOrder = getSessionPlanningOrder(sessionData.eventId, currentSessionId);
      console.log(`[useSessionLoader] Session planning order: ${planningOrder}`);
    }
  }, [
    getSessionById, 
    saveSessionSeatPlan, 
    saveSessionViolations,
    isSessionTracked, 
    recordSessionAdjacency,
    getSessionPlanningOrder,
    uiSettings, // Include uiSettings in dependencies
  ]);

  // Load session data
  const loadSession = useCallback((newSessionId: string) => {
    console.log(`[useSessionLoader] Loading session: ${newSessionId}`);

    const sessionData = getSessionById(newSessionId);
    if (!sessionData) {
      console.error('[useSessionLoader] Session not found');
      return;
    }

    // Store context for saving UI settings
    sessionContextRef.current = {
      eventId: sessionData.eventId,
      dayId: sessionData.dayId,
    };

    // Load seat plan
    const seatPlan = loadSessionSeatPlan(newSessionId);
    if (seatPlan && seatPlan.tables.length > 0) {
      // Existing session with data
      console.log('[useSessionLoader] Loading existing seat plan with', seatPlan.tables.length, 'tables');
      setSeatStoreState({
        tables: seatPlan.tables,
        chunks: seatPlan.chunks,
        selectedTableId: null,
        selectedSeatId: null,
        selectedMealPlanIndex: seatPlan.selectedMealPlanIndex ?? null,
      });
      
      // Load UI settings
      const loadedUISettings = seatPlan.uiSettings ?? DEFAULT_SESSION_UI_SETTINGS;
      console.log('[useSessionLoader] Loading UI settings:', loadedUISettings);
      setUISettings(loadedUISettings);
      
      // Apply colorblind mode to global store
      setColorMode(loadedUISettings.isColorblindMode ? 'colorblind' : 'standard');
      
      // Load lock state
      const locked = seatPlan.isLocked ?? false;
      setIsLocked(locked);
      console.log('[useSessionLoader] Session lock state:', locked);
      
    } else {
      // New session - initialize with proper chunk structure
      console.log('[useSessionLoader] Initializing new session with default chunk');
      resetTables();
      
      // Reset UI settings to defaults for new session
      setUISettings(DEFAULT_SESSION_UI_SETTINGS);
      setIsLocked(false);
      setColorMode('standard');
    }

    // CRITICAL FIX: Use the new setGuests function for bulk sync
    const sessionGuests = getSessionGuests(newSessionId);
    let allLoadedGuests: any[] = [];
    
    if (sessionGuests) {
      const { hostGuests, externalGuests } = sessionGuests;
      allLoadedGuests = [...hostGuests, ...externalGuests];
      
      console.log('[useSessionLoader] Syncing session guests to guestStore:', {
        hostCount: hostGuests.length,
        externalCount: externalGuests.length,
      });
      
      // Use setGuests for atomic bulk sync (preserves deleted status)
      setGuests(hostGuests, externalGuests);
    } else {
      console.log('[useSessionLoader] No session guests found, clearing guestStore');
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
      console.log('[useSessionLoader] Loading saved session rules');
      
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
      console.log(`[useSessionLoader] Loading ${storedViolations.length} stored violations`);
      useSeatStore.setState({ violations: storedViolations });
    } else if (savedRules?.proximityRules && seatPlan && seatPlan.tables.length > 0) {
      console.log('[useSessionLoader] Detecting violations based on saved rules');
      const detectedViolations = detectProximityViolations(
        seatPlan.tables,
        savedRules.proximityRules,
        guestLookup
      );
      useSeatStore.setState({ violations: detectedViolations });
      console.log(`[useSessionLoader] Detected ${detectedViolations.length} violations`);
    } else {
      useSeatStore.setState({ violations: [] });
    }
    
    console.log('[useSessionLoader] Session loaded with rules and violations');

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
    resetTables,
    setColorMode,
  ]);

  /**
   * Handle UI settings changes from PlaygroundCanvas
   * This is called when user changes connector gap, photo mode, etc.
   */
  const handleUISettingsChange = useCallback((newSettings: SessionUISettings) => {
    console.log('[useSessionLoader] UI settings changed:', newSettings);
    setUISettings(newSettings);
    
    // Apply colorblind mode immediately
    setColorMode(newSettings.isColorblindMode ? 'colorblind' : 'standard');
    
    // Save immediately if we have session context
    if (sessionId && sessionContextRef.current) {
      saveSessionUISettings(
        sessionContextRef.current.eventId,
        sessionContextRef.current.dayId,
        sessionId,
        newSettings
      );
      console.log('[useSessionLoader] Saved UI settings to store');
    }
  }, [sessionId, saveSessionUISettings, setColorMode]);
  
  /**
   * Toggle session lock state
   */
  const handleToggleLock = useCallback(() => {
    if (!sessionId || !sessionContextRef.current) return;
    
    toggleSessionLockStore(
      sessionContextRef.current.eventId, 
      sessionContextRef.current.dayId, 
      sessionId
    );
    
    setIsLocked(prev => !prev);
    console.log('[useSessionLoader] Toggled lock state');
  }, [sessionId, toggleSessionLockStore]);

  /**
   * Force re-sync guests from eventStore to guestStore.
   */
  const resyncGuests = useCallback(() => {
    if (!sessionId) return false;
    
    const sessionGuests = getSessionGuests(sessionId);
    if (!sessionGuests) return false;
    
    const { hostGuests, externalGuests } = sessionGuests;
    
    console.log('[useSessionLoader] Force syncing guests', {
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
      console.log('[useSessionLoader] Waiting for store hydration before loading session...');
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
    // UI Settings and Lock
    uiSettings,
    isLocked,
    handleUISettingsChange,
    handleToggleLock,
  };
};