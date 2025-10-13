import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Guest, hostGuests, externalGuests } from '@/data/guestData';

interface GuestStoreState {
  hostGuests: Guest[];
  externalGuests: Guest[];
  setHostGuests: (guests: Guest[]) => void;
  setExternalGuests: (guests: Guest[]) => void;
  addHostGuest: (guest: Guest) => void;
  addExternalGuest: (guest: Guest) => void;
  resetGuests: () => void;
}

export const useGuestStore = create<GuestStoreState>()(
  devtools(
    persist(
      (set) => ({
        hostGuests,
        externalGuests,
        setHostGuests: (guests) => set({ hostGuests: guests }),
        setExternalGuests: (guests) => set({ externalGuests: guests }),
        addHostGuest: (guest) =>
          set((state) => ({ hostGuests: [...state.hostGuests, guest] })),
        addExternalGuest: (guest) =>
          set((state) => ({ externalGuests: [...state.externalGuests, guest] })),
        resetGuests: () => set({ hostGuests, externalGuests }),
      }),
      {
        name: 'guest-storage', // localStorage key
      }
    ),
    { name: 'GuestStore' } // <-- name to identify in DevTools
  )
);
