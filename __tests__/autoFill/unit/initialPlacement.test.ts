import { describe, it, expect, beforeEach } from 'vitest';
import { performInitialPlacement } from '@/utils/autoFill/initialPlacement';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import {
  createSortRule,
  createTableRules,
  createProximityRules,
  createSitAwayRule,
} from '../factories/rulesFactory';

beforeEach(() => {
  resetGuestCounter();
  resetTableCounter();
});

const defaultComparator = makeComparator([createSortRule()]);

describe('performInitialPlacement', () => {
  describe('default mode (no table rules)', () => {
    it('assigns guests sequentially by sorted order', () => {
      const table = createRoundTable({ seatCount: 4 });
      const h1 = createHostGuest({ id: 'h1', ranking: 1 });
      const h2 = createHostGuest({ id: 'h2', ranking: 2 });
      const h3 = createHostGuest({ id: 'h3', ranking: 3 });

      const result = performInitialPlacement(
        [table], [h1, h2, h3], [], new Set(), new Map()
      );

      expect(result.size).toBe(3);
      // First seat should get highest priority guest
      expect(result.get(table.seats[0].id)).toBe('h1');
      expect(result.get(table.seats[1].id)).toBe('h2');
      expect(result.get(table.seats[2].id)).toBe('h3');
    });

    it('skips locked seats', () => {
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: { 1: { locked: true, assignedGuestId: 'locked1' } },
      });
      const h1 = createHostGuest({ id: 'h1', ranking: 1 });
      const h2 = createHostGuest({ id: 'h2', ranking: 2 });

      const result = performInitialPlacement(
        [table], [h1, h2], [], new Set(['locked1']), new Map()
      );

      expect(result.has(table.seats[1].id)).toBe(false); // locked seat skipped
      expect(result.get(table.seats[0].id)).toBe('h1');
      expect(result.get(table.seats[2].id)).toBe('h2');
    });

    it('respects seat mode (host-only seats get host guests)', () => {
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { mode: 'host-only' } },
      });
      const ext1 = createExternalGuest({ id: 'e1', ranking: 1 });
      const h1 = createHostGuest({ id: 'h1', ranking: 2 });

      const result = performInitialPlacement(
        [table], [h1], [ext1], new Set(), new Map()
      );

      // Seat 0 is host-only, so h1 should go there even though e1 has higher ranking
      expect(result.get(table.seats[0].id)).toBe('h1');
    });

    it('assigns all guests when enough seats', () => {
      const table = createRoundTable({ seatCount: 6 });
      const guests = Array.from({ length: 4 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const result = performInitialPlacement(
        [table], guests, [], new Set(), new Map()
      );

      expect(result.size).toBe(4);
    });

    it('stops when seats are full with more guests than seats', () => {
      const table = createRoundTable({ seatCount: 2 });
      const guests = Array.from({ length: 5 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const result = performInitialPlacement(
        [table], guests, [], new Set(), new Map()
      );

      expect(result.size).toBe(2);
    });

    it('leaves seats empty when fewer guests than seats', () => {
      const table = createRoundTable({ seatCount: 8 });
      const h1 = createHostGuest({ id: 'h1' });

      const result = performInitialPlacement(
        [table], [h1], [], new Set(), new Map()
      );

      expect(result.size).toBe(1);
    });

    it('does not reassign already-locked guest IDs', () => {
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { locked: true, assignedGuestId: 'locked1' } },
      });
      const h1 = createHostGuest({ id: 'locked1', ranking: 1 });
      const h2 = createHostGuest({ id: 'h2', ranking: 2 });

      const result = performInitialPlacement(
        [table], [h1, h2], [], new Set(['locked1']), new Map()
      );

      // locked1 should not appear in the result map (already locked in seat)
      const assignedGuests = new Set(result.values());
      expect(assignedGuests.has('locked1')).toBe(false);
      expect(assignedGuests.has('h2')).toBe(true);
    });
  });

  describe('spacing rule mode', () => {
    it('alternates host and external guests with spacing=1', () => {
      const table = createRoundTable({ seatCount: 6 });
      const hosts = Array.from({ length: 3 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );
      const externals = Array.from({ length: 3 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const tableRules = createTableRules({
        spacingRule: { enabled: true, spacing: 1, startWithExternal: false },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      expect(result.size).toBe(6);

      // Check alternating pattern: host, ext, host, ext, ...
      const assignments = table.seats.map(s => {
        const guestId = result.get(s.id);
        return guestId?.startsWith('h') ? 'host' : 'ext';
      });
      // With spacing=1 and startWithExternal=false: host at pos 0, ext at pos 1
      expect(assignments[0]).toBe('host');
      expect(assignments[1]).toBe('ext');
    });

    it('starts with external when startWithExternal=true', () => {
      const table = createRoundTable({ seatCount: 4 });
      const hosts = [createHostGuest({ id: 'h1', ranking: 1 })];
      const externals = [
        createExternalGuest({ id: 'e1', ranking: 1 }),
        createExternalGuest({ id: 'e2', ranking: 2 }),
      ];

      const tableRules = createTableRules({
        spacingRule: { enabled: true, spacing: 1, startWithExternal: true },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      // First seat should be external
      const firstGuest = result.get(table.seats[0].id);
      expect(firstGuest?.startsWith('e')).toBe(true);
    });

    it('respects host-only seats within spacing pattern', () => {
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { mode: 'host-only' } },
      });
      const hosts = [createHostGuest({ id: 'h1', ranking: 1 })];
      const externals = [createExternalGuest({ id: 'e1', ranking: 1 })];

      const tableRules = createTableRules({
        spacingRule: { enabled: true, spacing: 1, startWithExternal: true },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      // Seat 0 is host-only, so it should get a host guest regardless of pattern
      expect(result.get(table.seats[0].id)).toBe('h1');
    });

    it('falls back to default fill when one type exhausted', () => {
      const table = createRoundTable({ seatCount: 4 });
      const hosts = [createHostGuest({ id: 'h1', ranking: 1 })];
      const externals = Array.from({ length: 5 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const tableRules = createTableRules({
        spacingRule: { enabled: true, spacing: 1, startWithExternal: false },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      // All 4 seats should be filled
      expect(result.size).toBe(4);
    });
  });

  describe('ratio rule mode', () => {
    it('places correct number of hosts and externals per ratio', () => {
      const table = createRoundTable({ seatCount: 8 });
      const hosts = Array.from({ length: 5 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );
      const externals = Array.from({ length: 5 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const tableRules = createTableRules({
        ratioRule: { enabled: true, hostRatio: 50, externalRatio: 50 },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      expect(result.size).toBe(8);
      const hostCount = Array.from(result.values()).filter(id => id.startsWith('h')).length;
      const extCount = Array.from(result.values()).filter(id => id.startsWith('e')).length;
      expect(hostCount).toBe(4);
      expect(extCount).toBe(4);
    });

    it('2:1 ratio on 9-seat table puts 6 host, 3 external', () => {
      const table = createRoundTable({ seatCount: 9 });
      const hosts = Array.from({ length: 8 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );
      const externals = Array.from({ length: 8 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const tableRules = createTableRules({
        ratioRule: { enabled: true, hostRatio: 2, externalRatio: 1 },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      const hostCount = Array.from(result.values()).filter(id => id.startsWith('h')).length;
      const extCount = Array.from(result.values()).filter(id => id.startsWith('e')).length;
      expect(hostCount).toBe(6);
      expect(extCount).toBe(3);
    });

    it('falls back to any guest when target count exhausted', () => {
      const table = createRoundTable({ seatCount: 6 });
      const hosts = [createHostGuest({ id: 'h1', ranking: 1 })];
      const externals = Array.from({ length: 8 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const tableRules = createTableRules({
        ratioRule: { enabled: true, hostRatio: 50, externalRatio: 50 },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      // Should fill all 6 seats: 1 host + 3 external from ratio + 2 more externals as fallback
      expect(result.size).toBe(6);
    });

    it('respects host-only and external-only seat modes', () => {
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: {
          0: { mode: 'host-only' },
          1: { mode: 'external-only' },
        },
      });
      const hosts = [createHostGuest({ id: 'h1', ranking: 1 })];
      const externals = [createExternalGuest({ id: 'e1', ranking: 1 })];

      const tableRules = createTableRules({
        ratioRule: { enabled: true, hostRatio: 50, externalRatio: 50 },
      });

      const result = performInitialPlacement(
        [table], hosts, externals, new Set(), new Map(), tableRules, defaultComparator
      );

      expect(result.get(table.seats[0].id)).toBe('h1');
      expect(result.get(table.seats[1].id)).toBe('e1');
    });
  });

  describe('table ordering', () => {
    it('processes tables in tableNumber order', () => {
      const t2 = createRoundTable({ seatCount: 2, tableNumber: 2 });
      const t1 = createRoundTable({ seatCount: 2, tableNumber: 1 });
      const h1 = createHostGuest({ id: 'h1', ranking: 1 });
      const h2 = createHostGuest({ id: 'h2', ranking: 2 });
      const h3 = createHostGuest({ id: 'h3', ranking: 3 });

      // Pass tables in reverse order
      const result = performInitialPlacement(
        [t2, t1], [h1, h2, h3], [], new Set(), new Map()
      );

      // t1 (tableNumber=1) should be filled first
      expect(result.get(t1.seats[0].id)).toBe('h1');
      expect(result.get(t1.seats[1].id)).toBe('h2');
      expect(result.get(t2.seats[0].id)).toBe('h3');
    });

    it('processes seats in seatNumber order within each table', () => {
      const table = createRoundTable({ seatCount: 4 });
      const guests = Array.from({ length: 4 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const result = performInitialPlacement(
        [table], guests, [], new Set(), new Map()
      );

      // Seats should be filled in seatNumber order
      expect(result.get(table.seats[0].id)).toBe('h0');
      expect(result.get(table.seats[1].id)).toBe('h1');
      expect(result.get(table.seats[2].id)).toBe('h2');
      expect(result.get(table.seats[3].id)).toBe('h3');
    });
  });

  describe('sit-away-with-locked avoidance', () => {
    it('skips first candidate and picks next if would violate sit-away with locked seat', () => {
      // Seat 0 locked with 'locked1', seat 1 is adjacent to seat 0
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { locked: true, assignedGuestId: 'locked1' } },
      });
      const h1 = createHostGuest({ id: 'h1', ranking: 1 });
      const h2 = createHostGuest({ id: 'h2', ranking: 2 });
      const proximityRules = createProximityRules({
        sitAway: [createSitAwayRule('h1', 'locked1')],
      });
      const lockedMap = new Map([['locked1', {
        guestId: 'locked1', tableId: table.id, seatId: table.seats[0].id,
        seat: table.seats[0], table,
      }]]);

      const result = performInitialPlacement(
        [table], [h1, h2], [], new Set(['locked1']), lockedMap,
        undefined, defaultComparator, proximityRules
      );

      // Seat 1 is adjacent to seat 0 (locked1). h1 should be moved away.
      // h2 should be placed in seat 1 instead, and h1 should go to a non-adjacent seat
      const seat1Guest = result.get(table.seats[1].id);
      expect(seat1Guest).toBe('h2');
    });
  });

  describe('randomization', () => {
    it('skips randomization when config is disabled', () => {
      const table = createRoundTable({ seatCount: 4 });
      const guests = Array.from({ length: 4 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const result1 = performInitialPlacement(
        [table], guests, [], new Set(), new Map(),
        undefined, defaultComparator, undefined, undefined, new Set()
      );

      // Without randomization, order should be deterministic
      expect(result1.get(table.seats[0].id)).toBe('h0');
      expect(result1.get(table.seats[1].id)).toBe('h1');
    });
  });
});
