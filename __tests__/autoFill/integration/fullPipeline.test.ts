import { describe, it, expect, beforeEach } from 'vitest';
import { makeComparator } from '@/utils/autoFill/guestSorting';
import { buildLockedGuestMap } from '@/utils/autoFill/lockedGuestHelpers';
import { buildPrioritizedGuestPools } from '@/utils/autoFill/guestPoolBuilder';
import { performInitialPlacement } from '@/utils/autoFill/initialPlacement';
import { applySitTogetherOptimization } from '@/utils/autoFill/sitTogetherOptimization';
import { applySitAwayOptimization } from '@/utils/autoFill/sitAwayOptimization';
import { performFinalViolationCheck } from '@/utils/autoFill/violationChecker';
import { createHostGuest, createExternalGuest, resetGuestCounter } from '../factories/guestFactory';
import { createRoundTable, resetTableCounter } from '../factories/tableFactory';
import {
  createSortRule,
  createTableRules,
  createProximityRules,
  createSitTogetherRule,
  createSitAwayRule,
  resetRuleIdCounter,
} from '../factories/rulesFactory';
import { writeSeatAssignments, expectGuestsAdjacent, expectGuestsNotAdjacent } from '../helpers/assertions';

/**
 * Runs the full autofill pipeline in the exact same order as the orchestrator,
 * but without Zustand stores. Returns the seatToGuest map and violations.
 */
function runPipeline(opts: {
  tables: ReturnType<typeof createRoundTable>[];
  hostGuests: ReturnType<typeof createHostGuest>[];
  externalGuests: ReturnType<typeof createExternalGuest>[];
  sortRules?: ReturnType<typeof createSortRule>[];
  tableRules?: ReturnType<typeof createTableRules>;
  proximityRules?: ReturnType<typeof createProximityRules>;
}) {
  const {
    tables,
    hostGuests,
    externalGuests,
    sortRules = [createSortRule()],
    tableRules,
    proximityRules = createProximityRules(),
  } = opts;

  const allGuests = [...hostGuests, ...externalGuests];
  const guestLookup: Record<string, (typeof allGuests)[number]> = {};
  allGuests.forEach(g => (guestLookup[g.id] = g));

  const comparator = makeComparator(sortRules);
  const lockedGuestMap = buildLockedGuestMap(tables);

  const lockedGuestIds = new Set<string>();
  for (const table of tables) {
    for (const seat of table.seats) {
      if (seat.locked && seat.assignedGuestId) {
        lockedGuestIds.add(seat.assignedGuestId);
      }
    }
  }

  const hostCandidates = hostGuests.filter(g => !lockedGuestIds.has(g.id));
  const externalCandidates = externalGuests.filter(g => !lockedGuestIds.has(g.id));

  const totalAvailableSeats = tables.reduce(
    (sum, t) => sum + t.seats.filter(s => !s.locked).length, 0
  );

  const { prioritizedHost, prioritizedExternal, guestsInProximityRules } =
    buildPrioritizedGuestPools(hostCandidates, externalCandidates, proximityRules, comparator, totalAvailableSeats);

  const seatToGuest = performInitialPlacement(
    tables, prioritizedHost, prioritizedExternal,
    lockedGuestIds, lockedGuestMap,
    tableRules, comparator, proximityRules,
    undefined, guestsInProximityRules
  );

  applySitTogetherOptimization(seatToGuest, tables, proximityRules, allGuests, comparator, lockedGuestMap);
  applySitAwayOptimization(seatToGuest, tables, proximityRules, allGuests, comparator, lockedGuestMap);

  // Write assignments back to seat objects for violation checker
  writeSeatAssignments(tables, seatToGuest);

  const violations = performFinalViolationCheck(tables, proximityRules, guestLookup);

  return { seatToGuest, violations, tables };
}

beforeEach(() => {
  resetGuestCounter();
  resetTableCounter();
  resetRuleIdCounter();
});

describe('Full Autofill Pipeline (no Zustand)', () => {
  describe('basic placement', () => {
    it('assigns all guests to seats with default options', () => {
      const table = createRoundTable({ seatCount: 6 });
      const hosts = Array.from({ length: 3 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );
      const externals = Array.from({ length: 3 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const { seatToGuest } = runPipeline({ tables: [table], hostGuests: hosts, externalGuests: externals });

      expect(seatToGuest.size).toBe(6);
    });

    it('assigns only host guests when external list is empty', () => {
      const table = createRoundTable({ seatCount: 4 });
      const hosts = Array.from({ length: 3 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const { seatToGuest } = runPipeline({ tables: [table], hostGuests: hosts, externalGuests: [] });

      expect(seatToGuest.size).toBe(3);
      for (const guestId of seatToGuest.values()) {
        expect(guestId.startsWith('h')).toBe(true);
      }
    });

    it('assigns only external guests when host list is empty', () => {
      const table = createRoundTable({ seatCount: 4 });
      const externals = Array.from({ length: 3 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const { seatToGuest } = runPipeline({ tables: [table], hostGuests: [], externalGuests: externals });

      expect(seatToGuest.size).toBe(3);
      for (const guestId of seatToGuest.values()) {
        expect(guestId.startsWith('e')).toBe(true);
      }
    });
  });

  describe('sorting integration', () => {
    it('places higher-ranked guests in earlier seats with ranking asc', () => {
      const table = createRoundTable({ seatCount: 4 });
      const h1 = createHostGuest({ id: 'h1', ranking: 10, name: 'Low' });
      const h2 = createHostGuest({ id: 'h2', ranking: 1, name: 'High' });
      const h3 = createHostGuest({ id: 'h3', ranking: 5, name: 'Mid' });

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: [h1, h2, h3],
        externalGuests: [],
        sortRules: [createSortRule({ field: 'ranking', direction: 'asc' })],
      });

      // First seat should get ranking 1 guest
      expect(seatToGuest.get(table.seats[0].id)).toBe('h2');
      expect(seatToGuest.get(table.seats[1].id)).toBe('h3');
      expect(seatToGuest.get(table.seats[2].id)).toBe('h1');
    });

    it('places guests sorted by name when sort rule is name asc', () => {
      const table = createRoundTable({ seatCount: 3 });
      const h1 = createHostGuest({ id: 'h1', name: 'Charlie', ranking: 5 });
      const h2 = createHostGuest({ id: 'h2', name: 'Alice', ranking: 5 });
      const h3 = createHostGuest({ id: 'h3', name: 'Bob', ranking: 5 });

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: [h1, h2, h3],
        externalGuests: [],
        sortRules: [createSortRule({ field: 'name', direction: 'asc' })],
      });

      expect(seatToGuest.get(table.seats[0].id)).toBe('h2'); // Alice
      expect(seatToGuest.get(table.seats[1].id)).toBe('h3'); // Bob
      expect(seatToGuest.get(table.seats[2].id)).toBe('h1'); // Charlie
    });
  });

  describe('table rules integration', () => {
    it('alternates host/external with spacing rule enabled', () => {
      const table = createRoundTable({ seatCount: 6 });
      const hosts = Array.from({ length: 3 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );
      const externals = Array.from({ length: 3 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: externals,
        tableRules: createTableRules({
          spacingRule: { enabled: true, spacing: 1, startWithExternal: false },
        }),
      });

      expect(seatToGuest.size).toBe(6);

      // Verify alternating pattern
      const types = table.seats.map(s => {
        const gId = seatToGuest.get(s.id);
        return gId?.startsWith('h') ? 'H' : 'E';
      });
      // Should alternate: H, E, H, E, H, E
      for (let i = 0; i < types.length; i++) {
        expect(types[i]).toBe(i % 2 === 0 ? 'H' : 'E');
      }
    });

    it('distributes by ratio with ratio rule enabled', () => {
      const table = createRoundTable({ seatCount: 9 });
      const hosts = Array.from({ length: 8 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );
      const externals = Array.from({ length: 8 }, (_, i) =>
        createExternalGuest({ id: `e${i}`, ranking: i + 1 })
      );

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: externals,
        tableRules: createTableRules({
          ratioRule: { enabled: true, hostRatio: 2, externalRatio: 1 },
        }),
      });

      const hostCount = Array.from(seatToGuest.values()).filter(id => id.startsWith('h')).length;
      const extCount = Array.from(seatToGuest.values()).filter(id => id.startsWith('e')).length;
      expect(hostCount).toBe(6); // 2/(2+1) * 9 = 6
      expect(extCount).toBe(3);
    });
  });

  describe('proximity rules integration', () => {
    it('sit-together pair ends up adjacent after full pipeline', () => {
      const table = createRoundTable({ seatCount: 8 });
      const hosts = Array.from({ length: 8 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const { seatToGuest, violations } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: [],
        proximityRules: createProximityRules({
          sitTogether: [createSitTogetherRule('h0', 'h5')],
        }),
      });

      expectGuestsAdjacent('h0', 'h5', [table], seatToGuest);
      const sitTogetherViolations = violations.filter(v => v.type === 'sit-together');
      expect(sitTogetherViolations).toHaveLength(0);
    });

    it('sit-away pair ends up non-adjacent after full pipeline', () => {
      const table = createRoundTable({ seatCount: 8 });
      const hosts = Array.from({ length: 8 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const { seatToGuest, violations } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: [],
        proximityRules: createProximityRules({
          sitAway: [createSitAwayRule('h0', 'h1')],
        }),
      });

      expectGuestsNotAdjacent('h0', 'h1', [table], seatToGuest);
      const sitAwayViolations = violations.filter(v => v.type === 'sit-away');
      expect(sitAwayViolations).toHaveLength(0);
    });

    it('handles 3-guest sit-together cluster', () => {
      const table = createRoundTable({ seatCount: 8 });
      const hosts = Array.from({ length: 8 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const { seatToGuest, violations } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: [],
        proximityRules: createProximityRules({
          sitTogether: [
            createSitTogetherRule('h0', 'h3'),
            createSitTogetherRule('h3', 'h6'),
          ],
        }),
      });

      // All three should be on the same table and at least pairwise adjacent
      expectGuestsAdjacent('h0', 'h3', [table], seatToGuest);
      expectGuestsAdjacent('h3', 'h6', [table], seatToGuest);

      const sitTogetherViolations = violations.filter(v => v.type === 'sit-together');
      expect(sitTogetherViolations).toHaveLength(0);
    });

    it('sit-together across two tables consolidates onto one', () => {
      const t1 = createRoundTable({ seatCount: 4 });
      const t2 = createRoundTable({ seatCount: 4 });
      const hosts = Array.from({ length: 8 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const { seatToGuest, violations } = runPipeline({
        tables: [t1, t2],
        hostGuests: hosts,
        externalGuests: [],
        proximityRules: createProximityRules({
          sitTogether: [createSitTogetherRule('h0', 'h5')],
        }),
      });

      // h0 and h5 should end up on the same table
      let h0Table: string | null = null;
      let h5Table: string | null = null;
      for (const table of [t1, t2]) {
        for (const seat of table.seats) {
          const g = seatToGuest.get(seat.id);
          if (g === 'h0') h0Table = table.id;
          if (g === 'h5') h5Table = table.id;
        }
      }
      expect(h0Table).toBe(h5Table);
    });
  });

  describe('locked seats integration', () => {
    it('preserves locked guest assignments through entire pipeline', () => {
      const table = createRoundTable({
        seatCount: 6,
        seatOverrides: { 2: { locked: true, assignedGuestId: 'locked1' } },
      });
      const hosts = Array.from({ length: 5 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );
      // Also create the locked guest in the host list (it will be excluded as candidate)
      const lockedGuest = createHostGuest({ id: 'locked1', ranking: 0 });

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: [...hosts, lockedGuest],
        externalGuests: [],
      });

      // Locked seat should NOT be in seatToGuest (locked seats are handled separately)
      expect(seatToGuest.has(table.seats[2].id)).toBe(false);
      // Other seats should be assigned
      expect(seatToGuest.size).toBe(5);
      // Locked guest should not appear as a candidate
      const assignedIds = new Set(seatToGuest.values());
      expect(assignedIds.has('locked1')).toBe(false);
    });
  });

  describe('seat modes integration', () => {
    it('host-only seats only get host guests', () => {
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { mode: 'host-only' }, 1: { mode: 'host-only' } },
      });
      const hosts = [
        createHostGuest({ id: 'h1', ranking: 1 }),
        createHostGuest({ id: 'h2', ranking: 2 }),
      ];
      const externals = [
        createExternalGuest({ id: 'e1', ranking: 1 }),
        createExternalGuest({ id: 'e2', ranking: 2 }),
      ];

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: externals,
      });

      // Seats 0 and 1 are host-only
      const seat0Guest = seatToGuest.get(table.seats[0].id);
      const seat1Guest = seatToGuest.get(table.seats[1].id);
      expect(seat0Guest?.startsWith('h')).toBe(true);
      expect(seat1Guest?.startsWith('h')).toBe(true);
    });

    it('external-only seats only get external guests', () => {
      const table = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { mode: 'external-only' } },
      });
      const hosts = [createHostGuest({ id: 'h1', ranking: 1 })];
      const externals = [createExternalGuest({ id: 'e1', ranking: 1 })];

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: externals,
      });

      expect(seatToGuest.get(table.seats[0].id)).toBe('e1');
    });
  });

  describe('violation reporting', () => {
    it('reports violations for unsatisfiable sit-together constraints', () => {
      // Lock two guests on different tables - they can never sit together
      const t1 = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { locked: true, assignedGuestId: 'g1' } },
      });
      const t2 = createRoundTable({
        seatCount: 4,
        seatOverrides: { 0: { locked: true, assignedGuestId: 'g2' } },
      });
      const g1 = createHostGuest({ id: 'g1', ranking: 1 });
      const g2 = createHostGuest({ id: 'g2', ranking: 2 });

      const { violations } = runPipeline({
        tables: [t1, t2],
        hostGuests: [g1, g2],
        externalGuests: [],
        proximityRules: createProximityRules({
          sitTogether: [createSitTogetherRule('g1', 'g2')],
        }),
      });

      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations.some(v => v.type === 'sit-together')).toBe(true);
    });

    it('reports zero violations when all constraints satisfied', () => {
      const table = createRoundTable({ seatCount: 4 });
      const h1 = createHostGuest({ id: 'h1', ranking: 1 });
      const h2 = createHostGuest({ id: 'h2', ranking: 2 });
      const h3 = createHostGuest({ id: 'h3', ranking: 3 });
      const h4 = createHostGuest({ id: 'h4', ranking: 4 });

      const { violations } = runPipeline({
        tables: [table],
        hostGuests: [h1, h2, h3, h4],
        externalGuests: [],
        // No proximity rules = no violations possible
      });

      expect(violations).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles zero guests gracefully', () => {
      const table = createRoundTable({ seatCount: 4 });

      const { seatToGuest, violations } = runPipeline({
        tables: [table],
        hostGuests: [],
        externalGuests: [],
      });

      expect(seatToGuest.size).toBe(0);
      expect(violations).toHaveLength(0);
    });

    it('handles zero tables gracefully', () => {
      const hosts = [createHostGuest({ id: 'h1' })];

      const { seatToGuest, violations } = runPipeline({
        tables: [],
        hostGuests: hosts,
        externalGuests: [],
      });

      expect(seatToGuest.size).toBe(0);
      expect(violations).toHaveLength(0);
    });

    it('handles more guests than seats (excess guests not assigned)', () => {
      const table = createRoundTable({ seatCount: 3 });
      const hosts = Array.from({ length: 10 }, (_, i) =>
        createHostGuest({ id: `h${i}`, ranking: i + 1 })
      );

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: [],
      });

      expect(seatToGuest.size).toBe(3);
      // Highest priority guests should be seated
      const seated = new Set(seatToGuest.values());
      expect(seated.has('h0')).toBe(true);
      expect(seated.has('h1')).toBe(true);
      expect(seated.has('h2')).toBe(true);
    });

    it('handles all seats locked (no assignments made)', () => {
      const table = createRoundTable({
        seatCount: 3,
        seatOverrides: {
          0: { locked: true, assignedGuestId: 'l1' },
          1: { locked: true, assignedGuestId: 'l2' },
          2: { locked: true, assignedGuestId: 'l3' },
        },
      });
      const hosts = [
        createHostGuest({ id: 'l1', ranking: 1 }),
        createHostGuest({ id: 'l2', ranking: 2 }),
        createHostGuest({ id: 'l3', ranking: 3 }),
        createHostGuest({ id: 'h4', ranking: 4 }),
      ];

      const { seatToGuest } = runPipeline({
        tables: [table],
        hostGuests: hosts,
        externalGuests: [],
      });

      // No unlocked seats, so no placements
      expect(seatToGuest.size).toBe(0);
    });
  });
});
