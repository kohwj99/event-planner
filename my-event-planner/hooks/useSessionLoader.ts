import { useEffect, useCallback, useState } from 'react';
import { useEventStore } from '@/store/eventStore';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { Session } from '@/types/Event';

export const useSessionLoader = (eventId: string, dayId: string, sessionId: string) => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Access Stores
  const event = useEventStore((state) => state.events.find((e) => e.id === eventId));
  const saveSessionSeatPlan = useEventStore((state) => state.saveSessionSeatPlan);
  
  // We use the direct setState methods for bulk loading to avoid creating 
  // excessive actions in your existing stores just for hydration.
  const setSeatStoreState = useSeatStore.setState; 
  const resetGuests = useGuestStore((state) => state.resetGuests);
  const addGuest = useGuestStore((state) => state.addGuest);

  // 1. LOAD: Hydrate the editor when the ID changes
  useEffect(() => {
    if (!eventId || !dayId || !sessionId || !event) return;

    const day = event.days.find((d) => d.id === dayId);
    const session = day?.sessions.find((s: Session) => s.id === sessionId);

    if (session) {
      console.log(`Loading Session: ${session.name}`);

      // A. Load Tables & Chunks (Direct Zustand State Set)
      // We overwrite the current transient state with the saved session state
      setSeatStoreState({ 
        tables: session.seatPlan.tables || [], 
        chunks: session.seatPlan.chunks || {} 
      });

      // B. Load Guests
      resetGuests();
      
      // Combine master lists
      const allMasterGuests = [...event.masterHostGuests, ...event.masterExternalGuests];

      // Determine which guests to load:
      // If activeGuestIds exists and is not empty, load specific guests.
      // Otherwise (new session), load everyone.
      const activeIds = session.seatPlan.activeGuestIds || [];
      
      const guestsToLoad = activeIds.length > 0
        ? allMasterGuests.filter((g) => activeIds.includes(g.id))
        : allMasterGuests;

      guestsToLoad.forEach((g) => addGuest(g));

      setIsLoaded(true);
    }
  }, [eventId, dayId, sessionId, event, setSeatStoreState, resetGuests, addGuest]);

  // 2. SAVE: Function to call manually or on unmount
  const saveCurrentSession = useCallback(() => {
    if (!eventId || !dayId || !sessionId) return;

    // Get snapshots of current editor state
    const { tables, chunks } = useSeatStore.getState();
    const { hostGuests, externalGuests } = useGuestStore.getState();

    // Extract IDs for the "Active" list
    const activeGuestIds = [...hostGuests, ...externalGuests].map((g) => g.id);

    saveSessionSeatPlan(eventId, dayId, sessionId, {
      tables,
      chunks,
      activeGuestIds
    });

    console.log('Session Saved');
  }, [eventId, dayId, sessionId, saveSessionSeatPlan]);

  return { isLoaded, saveCurrentSession };
};