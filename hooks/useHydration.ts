'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEventStore } from '@/store/eventStore';

/**
 * Hook to manage store hydration
 * 
 * This hook ensures that:
 * 1. The eventStore has finished hydrating from localStorage
 * 2. Components don't render with stale/empty data during hydration
 * 
 * NOTE: All tracking data is now consolidated in eventStore.
 * No separate trackingStore hydration is needed.
 */
export const useStoreHydration = () => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const eventStoreHydrated = useEventStore((state) => state._hasHydrated);
  
  // Only report as hydrated after mounting to prevent SSR mismatch
  const isFullyHydrated = isMounted && eventStoreHydrated;

  return {
    isFullyHydrated,
    eventStoreHydrated: isMounted && eventStoreHydrated,
    // Keep this for backward compatibility - now just returns eventStoreHydrated
    trackingStoreHydrated: isMounted && eventStoreHydrated,
  };
};

/**
 * Hook to ensure tracking data is ready for a specific event after hydration
 * 
 * This should be used on event detail pages to ensure tracking data
 * is properly loaded after a page refresh
 * 
 * NOTE: Since all tracking data is now in eventStore, this hook simply
 * waits for hydration - no sync is needed.
 */
export const useEventTrackingSync = (eventId: string | null) => {
  const { isFullyHydrated } = useStoreHydration();
  const [hasSynced, setHasSynced] = useState(false);
  
  // Get tracked data for logging
  const getTrackedGuests = useEventStore((state) => state.getTrackedGuests);
  const getTrackedSessions = useEventStore((state) => state.getTrackedSessions);

  useEffect(() => {
    // Since all data is in eventStore now, we just need to wait for hydration
    if (isFullyHydrated && eventId && !hasSynced) {
      console.log(`🔄 useEventTrackingSync: Event ${eventId} ready`);
      
      // Log current tracking state for debugging
      const trackedGuests = getTrackedGuests(eventId);
      const trackedSessions = getTrackedSessions(eventId);
      
      console.log(`📊 Tracking state:`, {
        trackedGuests: trackedGuests.length,
        trackedSessions: trackedSessions.length,
      });

      setHasSynced(true);
    }
  }, [isFullyHydrated, eventId, hasSynced, getTrackedGuests, getTrackedSessions]);

  // Reset sync flag when eventId changes
  useEffect(() => {
    setHasSynced(false);
  }, [eventId]);

  return {
    isReady: isFullyHydrated && (hasSynced || !eventId),
    isHydrating: !isFullyHydrated,
  };
};

/**
 * Hook to manage tracking operations for an event
 * 
 * This provides convenience methods for toggling tracking
 * with automatic persistence to eventStore.
 * 
 * NOTE: All operations now go directly to eventStore.
 * No sync between stores is needed.
 */
export const useTrackingPersistence = (eventId: string) => {
  const toggleGuestTracking = useEventStore((state) => state.toggleGuestTracking);
  const toggleSessionTracking = useEventStore((state) => state.toggleSessionTracking);
  const getTrackedGuests = useEventStore((state) => state.getTrackedGuests);
  const getTrackedSessions = useEventStore((state) => state.getTrackedSessions);

  /**
   * Toggle guest tracking - directly updates eventStore
   */
  const toggleGuestTrackingWithSync = useCallback((guestId: string) => {
    toggleGuestTracking(eventId, guestId);
    
    // Log for debugging
    setTimeout(() => {
      const trackedGuests = getTrackedGuests(eventId);
      console.log(`👤 Guest tracking updated: ${trackedGuests.length} tracked guests`);
    }, 0);
  }, [eventId, toggleGuestTracking, getTrackedGuests]);

  /**
   * Toggle session tracking - directly updates eventStore
   */
  const toggleSessionTrackingWithSync = useCallback((sessionId: string) => {
    toggleSessionTracking(eventId, sessionId);
    
    // Log for debugging
    setTimeout(() => {
      const trackedSessions = getTrackedSessions(eventId);
      const isNowTracked = trackedSessions.includes(sessionId);
      console.log(`📋 Session ${sessionId} tracking: ${isNowTracked}`);
    }, 0);
  }, [eventId, toggleSessionTracking, getTrackedSessions]);

  return {
    toggleGuestTracking: toggleGuestTrackingWithSync,
    toggleSessionTracking: toggleSessionTrackingWithSync,
  };
};