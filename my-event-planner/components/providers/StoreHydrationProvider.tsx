'use client';

import React, { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { useEventStore } from '@/store/eventStore';

interface HydrationContextValue {
  isHydrated: boolean;
  eventStoreReady: boolean;
}

const HydrationContext = createContext<HydrationContextValue>({
  isHydrated: false,
  eventStoreReady: false,
});

export const useHydrationContext = () => useContext(HydrationContext);

interface StoreHydrationProviderProps {
  children: ReactNode;
}

/**
 * Provider component that ensures Zustand stores are properly hydrated
 * before rendering children.
 */
export function StoreHydrationProvider({ children }: StoreHydrationProviderProps) {
  // Start with false to match server-side render
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Mark as mounted after first client render
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Subscribe to hydration state from store
  // Only access store state after mounting to avoid SSR mismatch
  const eventStoreHydrated = useEventStore((state) => state._hasHydrated);

  useEffect(() => {
    // Only check hydration after component has mounted on client
    if (!isMounted) return;
    
    // Check if store has hydrated
    if (eventStoreHydrated) {
      console.log('All stores hydrated successfully');
      setIsHydrated(true);
    }
  }, [isMounted, eventStoreHydrated]);

  // Also listen to Zustand's persist API for immediate hydration check
  useEffect(() => {
    if (!isMounted) return;
    
    const unsubscribeEvent = useEventStore.persist.onFinishHydration(() => {
      console.log('EventStore: onFinishHydration triggered');
    });

    // Check if already hydrated (for hot reloads)
    const eventReady = useEventStore.persist.hasHydrated();
    
    if (eventReady) {
      console.log('Stores already hydrated (hot reload or fast load)');
      
      // Manually trigger our hydration flag if the persist API says we're ready
      // but our state flag hasn't been set yet
      if (!useEventStore.getState()._hasHydrated) {
        useEventStore.getState().setHasHydrated(true);
      }
      
      setIsHydrated(true);
    }

    return () => {
      unsubscribeEvent();
    };
  }, [isMounted]);

  const contextValue: HydrationContextValue = {
    isHydrated,
    eventStoreReady: isMounted && eventStoreHydrated,
  };

  return (
    <HydrationContext.Provider value={contextValue}>
      {children}
    </HydrationContext.Provider>
  );
}

/**
 * Simple loading component shown while stores are hydrating
 */
export function HydrationLoading(): React.ReactElement {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e0e0e0',
        borderTop: '3px solid #1976d2',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{ color: '#666', fontSize: '14px' }}>Loading...</p>
    </div>
  );
}

/**
 * Component wrapper that waits for hydration before rendering children
 * Useful for wrapping pages that depend on persisted state
 */
interface HydrationGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function HydrationGuard({ children, fallback = null }: HydrationGuardProps) {
  const { isHydrated } = useHydrationContext();
  
  if (!isHydrated) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}