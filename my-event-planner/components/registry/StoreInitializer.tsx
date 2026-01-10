'use client';

import { useEffect, useRef } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useColorModeStore } from '@/store/colorModeStore';
import { useTemplateStoreV2 } from '@/store/templateStoreV2';

/**
 * StoreInitializer component that handles Zustand persist rehydration.
 * 
 * This component should be placed in your layout.tsx inside ThemeRegistry.
 * It ensures that all Zustand stores with `skipHydration: true` are properly
 * rehydrated on the client side.
 * 
 * WHY THIS IS NEEDED:
 * When using `skipHydration: true` in Zustand persist, automatic hydration is disabled.
 * This means we need to manually trigger rehydration after the component mounts.
 * This approach prevents SSR/hydration mismatches because:
 * 1. Server renders with initial (empty) state
 * 2. Client first render also uses initial (empty) state (matches server!)
 * 3. After mount, rehydrate() loads data from localStorage
 * 4. Component re-renders with hydrated data
 * 
 * Usage in layout.tsx:
 * ```tsx
 * <ThemeRegistry>
 *   <StoreInitializer />
 *   {children}
 * </ThemeRegistry>
 * ```
 */
export default function StoreInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return;
    initialized.current = true;

    // Rehydrate all stores that use skipHydration: true
    const rehydrateStores = async () => {
      console.log('🔄 StoreInitializer: Starting rehydration...');
      
      try {
        // Rehydrate all persisted stores in parallel
        await Promise.all([
          useEventStore.persist.rehydrate(),
          useColorModeStore.persist.rehydrate(),
          useTemplateStoreV2.persist.rehydrate(),
        ]);
        
        console.log('✅ StoreInitializer: All stores rehydrated');
        
      } catch (error) {
        console.error('❌ StoreInitializer: Rehydration failed', error);
      }
    };

    rehydrateStores();
  }, []);

  // This component doesn't render anything
  return null;
}