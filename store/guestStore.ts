import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface Guest {
  id: string;
  name: string;
  country: string;
  company: string;
  title: string;
  ranking: number;      // 1–10 (1–4 are VIPs)
  fromHost: boolean;    // true = host company attendee
  deleted?: boolean;    // soft-delete flag
  mealPlans?: string[]; // Variable meal plans (Meal Plan 1, 2, 3, etc.)
  tags?: string[];      // Tags for grouping (e.g., "Cybersecurity", "Bahasa"), stored in UpperCamelCase
}

interface GuestStoreState {
  hostGuests: Guest[];
  externalGuests: Guest[];
  selectedMealPlanIndex: number | null; // null = None, 0 = Meal Plan 1, 1 = Meal Plan 2, etc.
  addGuest: (guest: Guest) => void;
  updateGuest: (id: string, guest: Partial<Guest>) => void;
  toggleDeleted: (id: string, fromHost: boolean) => void;
  resetGuests: () => void;
  setSelectedMealPlanIndex: (index: number | null) => void;
  getMaxMealPlanCount: () => number;
  getMaxTagCount: () => number;
  /** 
   * Bulk set guests - used for syncing with eventStore session guests.
   * Preserves 'deleted' status for existing guests to maintain user's hide/show choices.
   */
  setGuests: (hostGuests: Guest[], externalGuests: Guest[]) => void;
}

export const useGuestStore = create<GuestStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        hostGuests: [],
        externalGuests: [],
        selectedMealPlanIndex: null,

        addGuest: (guest) =>
          set((state) => {
            const list = guest.fromHost ? state.hostGuests : state.externalGuests;
            const key = guest.fromHost ? "hostGuests" : "externalGuests";
            return { [key]: [...list, guest] } as any;
          }),

        updateGuest: (id, guest) =>
          set((state) => ({
            hostGuests: state.hostGuests.map((g) =>
              g.id === id ? { ...g, ...guest } : g
            ),
            externalGuests: state.externalGuests.map((g) =>
              g.id === id ? { ...g, ...guest } : g
            ),
          })),

        toggleDeleted: (id, fromHost) =>
          set((state) => {
            const key = fromHost ? "hostGuests" : "externalGuests";
            const list = fromHost ? state.hostGuests : state.externalGuests;
            return {
              [key]: list.map((g) =>
                g.id === id ? { ...g, deleted: !g.deleted } : g
              ),
            } as any;
          }),

        resetGuests: () => set({ hostGuests: [], externalGuests: [] }),

        setSelectedMealPlanIndex: (index) => set({ selectedMealPlanIndex: index }),

        getMaxMealPlanCount: () => {
          const state = get();
          const allGuests = [...state.hostGuests, ...state.externalGuests];
          let max = 0;
          allGuests.forEach((g) => {
            if (g.mealPlans && g.mealPlans.length > max) {
              max = g.mealPlans.length;
            }
          });
          return max;
        },

        getMaxTagCount: () => {
          const state = get();
          const allGuests = [...state.hostGuests, ...state.externalGuests];
          let max = 0;
          allGuests.forEach((g) => {
            if (g.tags && g.tags.length > max) {
              max = g.tags.length;
            }
          });
          return max;
        },

        /**
         * Bulk set guests from eventStore session.
         * This preserves the 'deleted' flag for guests that already exist,
         * so users don't lose their hide/show preferences.
         */
        setGuests: (newHostGuests, newExternalGuests) =>
          set((state) => {
            // Build lookup of existing deleted states
            const existingDeletedMap = new Map<string, boolean>();
            state.hostGuests.forEach(g => {
              if (g.deleted !== undefined) {
                existingDeletedMap.set(g.id, g.deleted);
              }
            });
            state.externalGuests.forEach(g => {
              if (g.deleted !== undefined) {
                existingDeletedMap.set(g.id, g.deleted);
              }
            });

            // Merge new guests with preserved deleted status
            const mergedHostGuests = newHostGuests.map(g => ({
              ...g,
              deleted: existingDeletedMap.has(g.id) ? existingDeletedMap.get(g.id) : g.deleted,
            }));

            const mergedExternalGuests = newExternalGuests.map(g => ({
              ...g,
              deleted: existingDeletedMap.has(g.id) ? existingDeletedMap.get(g.id) : g.deleted,
            }));

            return {
              hostGuests: mergedHostGuests,
              externalGuests: mergedExternalGuests,
            };
          }),
      }),
      { name: "guest-list-store" }
    ),
    { name: "GuestStore" }
  )
);