import { describe, it, expect, beforeEach } from 'vitest';
import {
  canPlaceGuestInSeat,
  getNextCompatibleGuest,
  getNextCompatibleGuestOfType,
  getNextGuestFromUnifiedList,
  getNextGuestOfType,
} from '@/utils/autoFill/seatCompatibility';
import { createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createSeat, resetSeatCounter } from '../factories/seatFactory';

beforeEach(() => {
  resetGuestCounter();
  resetSeatCounter();
});

describe('canPlaceGuestInSeat', () => {
  it('allows any guest in default mode seat', () => {
    const host = createHostGuest();
    const ext = createExternalGuest();
    const seat = createSeat({ mode: 'default' });
    expect(canPlaceGuestInSeat(host, seat)).toBe(true);
    expect(canPlaceGuestInSeat(ext, seat)).toBe(true);
  });

  it('allows host guest in host-only seat', () => {
    const host = createHostGuest();
    const seat = createSeat({ mode: 'host-only' });
    expect(canPlaceGuestInSeat(host, seat)).toBe(true);
  });

  it('rejects external guest in host-only seat', () => {
    const ext = createExternalGuest();
    const seat = createSeat({ mode: 'host-only' });
    expect(canPlaceGuestInSeat(ext, seat)).toBe(false);
  });

  it('allows external guest in external-only seat', () => {
    const ext = createExternalGuest();
    const seat = createSeat({ mode: 'external-only' });
    expect(canPlaceGuestInSeat(ext, seat)).toBe(true);
  });

  it('rejects host guest in external-only seat', () => {
    const host = createHostGuest();
    const seat = createSeat({ mode: 'external-only' });
    expect(canPlaceGuestInSeat(host, seat)).toBe(false);
  });

  it('treats undefined mode as default', () => {
    const host = createHostGuest();
    const seat = { id: 's', mode: undefined };
    expect(canPlaceGuestInSeat(host, seat)).toBe(true);
  });
});

describe('getNextCompatibleGuest', () => {
  it('returns first unassigned compatible guest', () => {
    const g1 = createHostGuest({ id: 'g1' });
    const g2 = createHostGuest({ id: 'g2' });
    const seat = createSeat();
    const assigned = new Set<string>();

    const result = getNextCompatibleGuest([g1, g2], assigned, seat);
    expect(result?.id).toBe('g1');
  });

  it('skips already-assigned guests', () => {
    const g1 = createHostGuest({ id: 'g1' });
    const g2 = createHostGuest({ id: 'g2' });
    const seat = createSeat();
    const assigned = new Set(['g1']);

    const result = getNextCompatibleGuest([g1, g2], assigned, seat);
    expect(result?.id).toBe('g2');
  });

  it('skips guests incompatible with seat mode', () => {
    const ext = createExternalGuest({ id: 'e1' });
    const host = createHostGuest({ id: 'h1' });
    const seat = createSeat({ mode: 'host-only' });
    const assigned = new Set<string>();

    const result = getNextCompatibleGuest([ext, host], assigned, seat);
    expect(result?.id).toBe('h1');
  });

  it('returns null when no compatible guest available', () => {
    const ext = createExternalGuest({ id: 'e1' });
    const seat = createSeat({ mode: 'host-only' });
    const assigned = new Set<string>();

    const result = getNextCompatibleGuest([ext], assigned, seat);
    expect(result).toBeNull();
  });
});

describe('getNextCompatibleGuestOfType', () => {
  it('returns first unassigned host guest when isHost=true', () => {
    const ext = createExternalGuest({ id: 'e1' });
    const host = createHostGuest({ id: 'h1' });
    const seat = createSeat();
    const assigned = new Set<string>();

    const result = getNextCompatibleGuestOfType([ext, host], assigned, true, seat);
    expect(result?.id).toBe('h1');
  });

  it('returns first unassigned external guest when isHost=false', () => {
    const host = createHostGuest({ id: 'h1' });
    const ext = createExternalGuest({ id: 'e1' });
    const seat = createSeat();
    const assigned = new Set<string>();

    const result = getNextCompatibleGuestOfType([host, ext], assigned, false, seat);
    expect(result?.id).toBe('e1');
  });

  it('checks seat mode compatibility', () => {
    const ext = createExternalGuest({ id: 'e1' });
    const seat = createSeat({ mode: 'host-only' });
    const assigned = new Set<string>();

    const result = getNextCompatibleGuestOfType([ext], assigned, false, seat);
    expect(result).toBeNull();
  });

  it('returns null when no matching type available', () => {
    const ext = createExternalGuest({ id: 'e1' });
    const seat = createSeat();
    const assigned = new Set<string>();

    const result = getNextCompatibleGuestOfType([ext], assigned, true, seat);
    expect(result).toBeNull();
  });
});

describe('getNextGuestFromUnifiedList', () => {
  it('returns first unassigned guest regardless of type', () => {
    const ext = createExternalGuest({ id: 'e1' });
    const host = createHostGuest({ id: 'h1' });
    const assigned = new Set<string>();
    const cmp = () => 0;

    const result = getNextGuestFromUnifiedList([ext, host], assigned, cmp);
    expect(result?.id).toBe('e1');
  });

  it('returns null for empty candidates', () => {
    const result = getNextGuestFromUnifiedList([], new Set(), () => 0);
    expect(result).toBeNull();
  });
});

describe('getNextGuestOfType', () => {
  it('returns first unassigned guest of specified type', () => {
    const ext = createExternalGuest({ id: 'e1' });
    const host = createHostGuest({ id: 'h1' });
    const assigned = new Set<string>();

    expect(getNextGuestOfType([ext, host], assigned, true)?.id).toBe('h1');
    expect(getNextGuestOfType([ext, host], assigned, false)?.id).toBe('e1');
  });

  it('returns null when all of that type are assigned', () => {
    const host = createHostGuest({ id: 'h1' });
    const assigned = new Set(['h1']);

    expect(getNextGuestOfType([host], assigned, true)).toBeNull();
  });
});
