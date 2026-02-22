let guestCounter = 0;

interface GuestOverrides {
  id?: string;
  name?: string;
  country?: string;
  company?: string;
  title?: string;
  ranking?: number;
  fromHost?: boolean;
  deleted?: boolean;
  mealPlans?: string[];
  tags?: string[];
}

export function createGuest(overrides: GuestOverrides = {}) {
  guestCounter++;
  return {
    id: overrides.id ?? `guest-${guestCounter}`,
    name: overrides.name ?? `Guest ${guestCounter}`,
    country: overrides.country ?? 'USA',
    company: overrides.company ?? 'Acme Corp',
    title: overrides.title ?? 'Director',
    ranking: overrides.ranking ?? 5,
    fromHost: overrides.fromHost ?? true,
    deleted: overrides.deleted ?? false,
    mealPlans: overrides.mealPlans ?? [],
    tags: overrides.tags ?? [],
  };
}

export function createHostGuest(overrides: GuestOverrides = {}) {
  return createGuest({ fromHost: true, ...overrides });
}

export function createExternalGuest(overrides: GuestOverrides = {}) {
  return createGuest({ fromHost: false, ...overrides });
}

export function createVIPGuest(overrides: GuestOverrides = {}) {
  return createGuest({ ranking: 1, ...overrides });
}

export function resetGuestCounter() {
  guestCounter = 0;
}
