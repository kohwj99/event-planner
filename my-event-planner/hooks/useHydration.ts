'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useTrackingStore } from '@/store/trackingStore';

/**
 * Hook to manage store hydration and synchronization
 * 
 * This hook ensures that:
 * 1. Both eventStore and trackingStore have finished hydrating from localStorage
 * 2. Tracking data is properly synchronized between stores
 * 3. Components don't render with stale/empty data during hydration
 */
export const useStoreHydration = () => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const eventStoreHydrated = useEventStore((state) => state._hasHydrated);
  const trackingStoreHydrated = useTrackingStore((state) => state._hasHydrated);
  
  // Only report as hydrated after mounting to prevent SSR mismatch
  const isFullyHydrated = isMounted && eventStoreHydrated && trackingStoreHydrated;

  return {
    isFullyHydrated,
    eventStoreHydrated: isMounted && eventStoreHydrated,
    trackingStoreHydrated: isMounted && trackingStoreHydrated,
  };
};

/**
 * Hook to sync tracking data for a specific event after hydration
 * 
 * This should be used on event detail pages to ensure tracking data
 * is properly loaded after a page refresh
 */
export const useEventTrackingSync = (eventId: string | null) => {
  const { isFullyHydrated } = useStoreHydration();
  const [hasSynced, setHasSynced] = useState(false);
  
  // Get store actions
  const syncTrackingFromStore = useEventStore((state) => state.syncTrackingFromStore);
  const getTrackedGuests = useTrackingStore((state) => state.getTrackedGuests);
  const getTrackedSessions = useTrackingStore((state) => state.getTrackedSessions);

  useEffect(() => {
    // Only sync once after full hydration
    if (isFullyHydrated && eventId && !hasSynced) {
      console.log(`🔄 useEventTrackingSync: Syncing for event ${eventId}`);
      
      // Log current tracking state
      const trackedGuests = getTrackedGuests(eventId);
      const trackedSessions = getTrackedSessions(eventId);
      
      console.log(`📊 Current tracking state:`, {
        trackedGuests: trackedGuests.length,
        trackedSessions: trackedSessions.length,
      });

      // Sync from tracking store to event store
      syncTrackingFromStore(eventId);
      setHasSynced(true);
    }
  }, [isFullyHydrated, eventId, hasSynced, syncTrackingFromStore, getTrackedGuests, getTrackedSessions]);

  // Reset sync flag when eventId changes
  useEffect(() => {
    setHasSynced(false);
  }, [eventId]);

  return {
    isReady: isFullyHydrated && hasSynced,
    isHydrating: !isFullyHydrated,
  };
};

/**
 * Hook to ensure tracking store data persists correctly
 * 
 * This can be called when toggling tracking to force a sync
 */
export const useTrackingPersistence = (eventId: string) => {
  const toggleGuestTracking = useTrackingStore((state) => state.toggleGuestTracking);
  const toggleSessionTracking = useTrackingStore((state) => state.toggleSessionTracking);
  const getTrackedGuests = useTrackingStore((state) => state.getTrackedGuests);
  const getTrackedSessions = useTrackingStore((state) => state.getTrackedSessions);
  const updateEventTrackedGuests = useEventStore((state) => state.updateEventTrackedGuests);
  const updateSessionTrackingStatus = useEventStore((state) => state.updateSessionTrackingStatus);

  /**
   * Toggle guest tracking and sync to event store for backup persistence
   */
  const toggleGuestTrackingWithSync = useCallback((guestId: string) => {
    // Toggle in tracking store (primary)
    toggleGuestTracking(eventId, guestId);
    
    // After toggle, sync to event store (backup)
    // Use setTimeout to ensure the tracking store has updated
    setTimeout(() => {
      const trackedGuests = getTrackedGuests(eventId);
      updateEventTrackedGuests(eventId, trackedGuests);
      console.log(`🔄 Synced ${trackedGuests.length} tracked guests to event store`);
    }, 0);
  }, [eventId, toggleGuestTracking, getTrackedGuests, updateEventTrackedGuests]);

  /**
   * Toggle session tracking and sync to event store for backup persistence
   */
  const toggleSessionTrackingWithSync = useCallback((sessionId: string) => {
    // Toggle in tracking store (primary)
    toggleSessionTracking(eventId, sessionId);
    
    // After toggle, sync to event store (backup)
    setTimeout(() => {
      const trackedSessions = getTrackedSessions(eventId);
      const isNowTracked = trackedSessions.includes(sessionId);
      updateSessionTrackingStatus(eventId, sessionId, isNowTracked);
      console.log(`🔄 Synced session ${sessionId} tracking status: ${isNowTracked}`);
    }, 0);
  }, [eventId, toggleSessionTracking, getTrackedSessions, updateSessionTrackingStatus]);

  return {
    toggleGuestTracking: toggleGuestTrackingWithSync,
    toggleSessionTracking: toggleSessionTrackingWithSync,
  };
};