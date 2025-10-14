import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface Guest {
  id: string;
  name: string;
  gender: "Male" | "Female" | "Other";
  salutation: string;
  country: string;
  company: string;
  title: string;
  ranking: number;      // 1–10 (1–4 are VIPs)
  fromHost: boolean;    // true = host company attendee
  deleted?: boolean;    // soft-delete flag
}

interface GuestStoreState {
  hostGuests: Guest[];
  externalGuests: Guest[];
  addGuest: (guest: Guest) => void;
  updateGuest: (id: string, guest: Partial<Guest>) => void;
  toggleDeleted: (id: string, fromHost: boolean) => void;
  resetGuests: () => void;
}

export const useGuestStore = create<GuestStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        hostGuests: [],
        externalGuests: [],

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
      }),
      { name: "guest-list-store" }
    ),
    { name: "GuestStore" }
  )
);
