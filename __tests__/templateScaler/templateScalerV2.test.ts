import { describe, it, expect } from 'vitest';
import {
  scaleTemplateV2,
  scaleConfigV2,
  getScaleRangeV2,
  generateOrdering,
  ScaleOptionsV2,
} from '@/utils/templateScalerV2';
import {
  CircleTableConfigV2,
  RectangleTableConfigV2,
  TableTemplateV2,
  ScaledCircleResultV2,
  ScaledRectangleResultV2,
  SeatMode,
  isCircleResultV2,
  isRectangleResultV2,
} from '@/types/TemplateV2';

// ============================================================================
// TEST HELPERS
// ============================================================================

function makeCircleTemplate(
  config: CircleTableConfigV2,
  name = 'Test Circle'
): TableTemplateV2 {
  return {
    id: 'test-circle',
    name,
    description: '',
    sessionTypes: ['Meal'],
    isBuiltIn: false,
    isUserCreated: true,
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeRectangleTemplate(
  config: RectangleTableConfigV2,
  name = 'Test Rectangle'
): TableTemplateV2 {
  return {
    id: 'test-rect',
    name,
    description: '',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: false,
    isUserCreated: true,
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function countModes(modes: SeatMode[]): Record<SeatMode, number> {
  const counts: Record<string, number> = { 'default': 0, 'host-only': 0, 'external-only': 0 };
  for (const m of modes) counts[m] = (counts[m] || 0) + 1;
  return counts as Record<SeatMode, number>;
}

function isAlternating(modes: SeatMode[], patternLength = 2): boolean {
  if (modes.length < patternLength) return true;
  const pattern = modes.slice(0, patternLength);
  return modes.every((m, i) => m === pattern[i % patternLength]);
}

// ============================================================================
// BUILT-IN TEMPLATE CONFIGS (from store/templateStoreV2.ts)
// ============================================================================

const FAREWELL_DINNER_CONFIG: CircleTableConfigV2 = {
  type: 'circle',
  baseSeatCount: 10,
  orderingPattern: {
    type: 'manual',
    direction: 'clockwise',
    startPosition: 0,
    manualOrdering: [1, 5, 7, 3, 9, 10, 8, 2, 6, 4],
  },
  modePattern: {
    type: 'manual',
    defaultMode: 'default',
    manualModes: [
      'host-only', 'external-only', 'external-only', 'host-only', 'external-only',
      'external-only', 'external-only', 'host-only', 'external-only', 'external-only',
    ],
  },
};

const MEAL_ROUND_EVEN_CONFIG: CircleTableConfigV2 = {
  type: 'circle',
  baseSeatCount: 12,
  orderingPattern: {
    type: 'manual',
    direction: 'clockwise',
    startPosition: 0,
    manualOrdering: [1, 8, 3, 10, 5, 12, 6, 11, 4, 9, 2, 7],
  },
  modePattern: {
    type: 'manual',
    defaultMode: 'default',
    manualModes: [
      'host-only', 'external-only', 'host-only', 'external-only',
      'host-only', 'external-only', 'host-only', 'external-only',
      'host-only', 'external-only', 'host-only', 'external-only',
    ],
  },
};

const BOARDROOM_CONFIG: RectangleTableConfigV2 = {
  type: 'rectangle',
  sides: {
    top: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 0 },
    right: { seatCount: 1, scalable: false, enabled: false, allocationPriority: 2 },
    bottom: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 1 },
    left: { seatCount: 1, scalable: false, enabled: false, allocationPriority: 3 },
  },
  scalingConfig: {
    allocationStrategy: 'round-robin',
    alternateOppositeSides: true,
    insertionOrder: [
      { side: 'top', edge: 'start' },
      { side: 'bottom', edge: 'end' },
      { side: 'top', edge: 'end' },
      { side: 'bottom', edge: 'start' },
    ],
  },
  orderingPattern: {
    type: 'manual',
    direction: 'clockwise',
    startPosition: 0,
    manualOrdering: [7, 3, 1, 5, 9, 8, 4, 2, 6, 10],
  },
  modePattern: {
    type: 'manual',
    defaultMode: 'default',
    manualModes: [
      'host-only', 'host-only', 'host-only', 'host-only', 'host-only',
      'external-only', 'external-only', 'external-only', 'external-only', 'external-only',
    ],
  },
};

const LONG_TABLE_GOH_CONFIG: RectangleTableConfigV2 = {
  type: 'rectangle',
  sides: {
    top: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 0 },
    right: { seatCount: 1, scalable: false, enabled: false, allocationPriority: 2 },
    bottom: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 1 },
    left: { seatCount: 1, scalable: false, enabled: false, allocationPriority: 3 },
  },
  scalingConfig: {
    allocationStrategy: 'round-robin',
    alternateOppositeSides: true,
    insertionOrder: [
      { side: 'bottom', edge: 'end' },
      { side: 'top', edge: 'start' },
      { side: 'bottom', edge: 'start' },
      { side: 'top', edge: 'end' },
    ],
  },
  orderingPattern: {
    type: 'manual',
    direction: 'clockwise',
    startPosition: 0,
    manualOrdering: [8, 4, 1, 6, 10, 7, 3, 2, 5, 9],
  },
  modePattern: {
    type: 'manual',
    defaultMode: 'default',
    manualModes: [
      'host-only', 'external-only', 'host-only', 'external-only', 'host-only',
      'external-only', 'host-only', 'external-only', 'host-only', 'external-only',
    ],
  },
};

const U_SHAPED_CONFIG: RectangleTableConfigV2 = {
  type: 'rectangle',
  sides: {
    top: { seatCount: 2, scalable: false, enabled: true, allocationPriority: 0 },
    right: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 2 },
    bottom: { seatCount: 3, scalable: true, enabled: false, allocationPriority: 1 },
    left: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 3 },
  },
  scalingConfig: {
    allocationStrategy: 'round-robin',
    alternateOppositeSides: true,
    insertionOrder: [
      { side: 'right', edge: 'end' },
      { side: 'left', edge: 'end' },
    ],
  },
  orderingPattern: {
    type: 'manual',
    direction: 'clockwise',
    startPosition: 0,
    manualOrdering: [2, 1, 3, 5, 7, 9, 11, 12, 10, 8, 6, 4],
  },
  modePattern: {
    type: 'manual',
    defaultMode: 'default',
    manualModes: [
      'external-only', 'host-only',
      'host-only', 'host-only', 'host-only', 'host-only', 'host-only',
      'external-only', 'external-only', 'external-only', 'external-only', 'external-only',
    ],
  },
};

// ============================================================================
// CIRCLE SCALING TESTS
// ============================================================================

describe('Circle Table Scaling', () => {
  describe('Farewell Dinner (VIP) - truly manual ordering', () => {
    const template = makeCircleTemplate(FAREWELL_DINNER_CONFIG);

    it('returns identical result at base count', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 10 });
      expect(isCircleResultV2(result)).toBe(true);
      const circleResult = result as ScaledCircleResultV2;
      expect(circleResult.seatOrdering).toEqual([1, 5, 7, 3, 9, 10, 8, 2, 6, 4]);
      expect(circleResult.seatModes).toEqual(FAREWELL_DINNER_CONFIG.modePattern.manualModes);
    });

    it('preserves seat 1 at position 0 when scaling up', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 12 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(12);
      // Seat 1 should remain at or very near position 0
      expect(result.seatOrdering[0]).toBe(1);
    });

    it('maintains host/external ratio when scaling up', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 12 }) as ScaledCircleResultV2;
      const counts = countModes(result.seatModes);
      // Base: 3H, 7E (30% H). At 12: should be ~3-4H
      expect(counts['host-only']).toBeGreaterThanOrEqual(3);
      expect(counts['host-only']).toBeLessThanOrEqual(4);
      expect(counts['host-only'] + counts['external-only']).toBe(12);
    });

    it('preserves seat 1 position when scaling up to 14', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 14 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(14);
      expect(result.seatOrdering[0]).toBe(1);
    });

    it('scales down correctly', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 8 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(8);
      // Highest-numbered seats (9, 10) should be removed
      expect(Math.max(...result.seatOrdering)).toBe(8);
      // Ordering should be sequential 1-8
      expect(result.seatOrdering.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('has valid seat numbers after scaling down', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 6 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(6);
      const sorted = [...result.seatOrdering].sort((a, b) => a - b);
      expect(sorted).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('Meal Round Even - alternating mode pattern', () => {
    const template = makeCircleTemplate(MEAL_ROUND_EVEN_CONFIG);

    it('returns identical result at base count', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 12 }) as ScaledCircleResultV2;
      expect(result.seatOrdering).toEqual([1, 8, 3, 10, 5, 12, 6, 11, 4, 9, 2, 7]);
      expect(result.seatModes).toEqual(MEAL_ROUND_EVEN_CONFIG.modePattern.manualModes);
    });

    it('maintains alternating H/E mode pattern when scaling up', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 14 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(14);
      // [H,E] repeating pattern should be maintained
      expect(isAlternating(result.seatModes, 2)).toBe(true);
    });

    it('maintains alternating modes at various sizes', () => {
      for (const size of [13, 14, 16, 18, 20]) {
        const result = scaleTemplateV2(template, { targetSeatCount: size }) as ScaledCircleResultV2;
        expect(isAlternating(result.seatModes, 2)).toBe(true);
      }
    });

    it('preserves seat 1 at position 0 when scaling up', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 14 }) as ScaledCircleResultV2;
      expect(result.seatOrdering[0]).toBe(1);
    });

    it('scales down maintaining mode pattern', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 10 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(10);
      expect(isAlternating(result.seatModes, 2)).toBe(true);
    });
  });

  describe('Pattern detection for disguised manual orderings', () => {
    it('detects sequential clockwise ordering', () => {
      const config: CircleTableConfigV2 = {
        type: 'circle',
        baseSeatCount: 8,
        orderingPattern: {
          type: 'manual',
          direction: 'clockwise',
          startPosition: 0,
          // This is actually sequential clockwise from position 0
          manualOrdering: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        modePattern: { type: 'uniform', defaultMode: 'default' },
      };
      const template = makeCircleTemplate(config);

      const result = scaleTemplateV2(template, { targetSeatCount: 10 }) as ScaledCircleResultV2;
      // Should regenerate as sequential at 10 seats
      expect(result.seatOrdering).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('detects alternating clockwise ordering', () => {
      // Generate alternating pattern at 8 seats
      const ordering = generateOrdering(8, 'clockwise', 'alternating', 0);
      const config: CircleTableConfigV2 = {
        type: 'circle',
        baseSeatCount: 8,
        orderingPattern: {
          type: 'manual',
          direction: 'clockwise',
          startPosition: 0,
          manualOrdering: ordering,
        },
        modePattern: { type: 'uniform', defaultMode: 'default' },
      };
      const template = makeCircleTemplate(config);

      const scaledResult = scaleTemplateV2(template, { targetSeatCount: 10 }) as ScaledCircleResultV2;
      const expected = generateOrdering(10, 'clockwise', 'alternating', 0);
      expect(scaledResult.seatOrdering).toEqual(expected);
    });
  });

  describe('Edge cases', () => {
    it('enforces minimum of 2 seats', () => {
      const template = makeCircleTemplate(FAREWELL_DINNER_CONFIG);
      const result = scaleTemplateV2(template, { targetSeatCount: 1 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(2);
    });

    it('handles large scale-up', () => {
      const template = makeCircleTemplate(FAREWELL_DINNER_CONFIG);
      const result = scaleTemplateV2(template, { targetSeatCount: 25 }) as ScaledCircleResultV2;
      expect(result.seatCount).toBe(25);
      expect(result.seatOrdering[0]).toBe(1);
      // All seat numbers should be unique
      expect(new Set(result.seatOrdering).size).toBe(25);
    });

    it('preserves propagateModePattern: false', () => {
      const template = makeCircleTemplate(MEAL_ROUND_EVEN_CONFIG);
      const result = scaleTemplateV2(template, {
        targetSeatCount: 14,
        propagateModePattern: false,
        defaultModeForNewSeats: 'host-only',
      }) as ScaledCircleResultV2;
      expect(result.seatModes.every(m => m === 'host-only')).toBe(true);
    });
  });
});

// ============================================================================
// RECTANGLE SCALING TESTS
// ============================================================================

describe('Rectangle Table Scaling', () => {
  describe('Boardroom Meetings - uniform side modes', () => {
    const template = makeRectangleTemplate(BOARDROOM_CONFIG);

    it('returns identical result at base count', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 10 });
      expect(isRectangleResultV2(result)).toBe(true);
      const rectResult = result as ScaledRectangleResultV2;
      expect(rectResult.seatCount).toBe(10);
      expect(rectResult.seatOrdering).toEqual([7, 3, 1, 5, 9, 8, 4, 2, 6, 10]);
    });

    it('preserves all-host top side and all-external bottom side when scaling up', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 12 }) as ScaledRectangleResultV2;
      expect(result.seatCount).toBe(12);
      // Top side should remain all host-only
      expect(result.sides.top.every(s => s.mode === 'host-only')).toBe(true);
      // Bottom side should remain all external-only
      expect(result.sides.bottom.every(s => s.mode === 'external-only')).toBe(true);
    });

    it('distributes seats correctly between top and bottom', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 14 }) as ScaledRectangleResultV2;
      expect(result.seatCount).toBe(14);
      // With 4 insertion points cycling top/bottom, should be balanced
      expect(result.sideSeats.top).toBeGreaterThanOrEqual(6);
      expect(result.sideSeats.bottom).toBeGreaterThanOrEqual(6);
    });

    it('scales down correctly', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 8 }) as ScaledRectangleResultV2;
      expect(result.seatCount).toBe(8);
      // Highest-numbered seats should be removed
      const allNums = [...result.seatOrdering].sort((a, b) => a - b);
      expect(allNums.length).toBe(8);
    });
  });

  describe('Long Table (with GOH) - alternating side modes', () => {
    const template = makeRectangleTemplate(LONG_TABLE_GOH_CONFIG);

    it('preserves alternating H/E modes on top side when scaling up', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 12 }) as ScaledRectangleResultV2;
      expect(result.seatCount).toBe(12);

      // Top side modes should alternate H, E
      const topModes = result.sides.top.map(s => s.mode);
      expect(isAlternating(topModes, 2)).toBe(true);
    });

    it('preserves alternating modes on bottom side when scaling up', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 12 }) as ScaledRectangleResultV2;

      // Bottom side modes should alternate (in visual order)
      const bottomModes = result.sides.bottom.map(s => s.mode);
      expect(isAlternating(bottomModes, 2)).toBe(true);
    });

    it('maintains pattern across multiple scale-ups', () => {
      for (const size of [12, 14, 16, 18]) {
        const result = scaleTemplateV2(template, { targetSeatCount: size }) as ScaledRectangleResultV2;
        const topModes = result.sides.top.map(s => s.mode);
        const bottomModes = result.sides.bottom.map(s => s.mode);
        expect(isAlternating(topModes, 2)).toBe(true);
        expect(isAlternating(bottomModes, 2)).toBe(true);
      }
    });
  });

  describe('U-shaped Calls - non-alternating side modes', () => {
    const template = makeRectangleTemplate(U_SHAPED_CONFIG);

    it('preserves all-host right side and all-external left side', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 14 }) as ScaledRectangleResultV2;
      expect(result.seatCount).toBe(14);

      // Right side should remain all host-only
      expect(result.sides.right.every(s => s.mode === 'host-only')).toBe(true);
      // Left side should remain all external-only
      expect(result.sides.left.every(s => s.mode === 'external-only')).toBe(true);
    });

    it('keeps top seats fixed (not scalable)', () => {
      const result = scaleTemplateV2(template, { targetSeatCount: 14 }) as ScaledRectangleResultV2;
      expect(result.sideSeats.top).toBe(2);
    });
  });

  describe('Rectangle edge cases', () => {
    it('enforces minimum of 2 seats', () => {
      const template = makeRectangleTemplate(BOARDROOM_CONFIG);
      const result = scaleTemplateV2(template, { targetSeatCount: 1 }) as ScaledRectangleResultV2;
      expect(result.seatCount).toBe(2);
    });

    it('handles non-pattern manual modes gracefully', () => {
      const config: RectangleTableConfigV2 = {
        ...BOARDROOM_CONFIG,
        modePattern: {
          type: 'manual',
          defaultMode: 'default',
          // Irregular pattern that doesn't repeat
          manualModes: [
            'host-only', 'host-only', 'external-only', 'host-only', 'external-only',
            'external-only', 'host-only', 'external-only', 'external-only', 'host-only',
          ],
        },
      };
      const template = makeRectangleTemplate(config);
      // Should not crash
      const result = scaleTemplateV2(template, { targetSeatCount: 12 }) as ScaledRectangleResultV2;
      expect(result.seatCount).toBe(12);
    });
  });
});

// ============================================================================
// GENERATE ORDERING TESTS
// ============================================================================

describe('generateOrdering', () => {
  describe('center-outward support', () => {
    it('generates center-outward ordering for circles', () => {
      const result = generateOrdering(8, 'clockwise', 'center-outward', 0);
      // Seat 1 at position 0, then alternating outward
      expect(result[0]).toBe(1);
      expect(result.length).toBe(8);
      // All numbers present
      expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('center-outward works with different start positions', () => {
      const result = generateOrdering(8, 'clockwise', 'center-outward', 3);
      expect(result[3]).toBe(1);
      expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe('consistency with internal generators', () => {
    it('sequential ordering matches across sizes', () => {
      for (const size of [4, 6, 8, 10, 12]) {
        const result = generateOrdering(size, 'clockwise', 'sequential', 0);
        expect(result).toEqual(Array.from({ length: size }, (_, i) => i + 1));
      }
    });

    it('alternating ordering produces valid permutation', () => {
      const result = generateOrdering(10, 'clockwise', 'alternating', 0);
      expect(result[0]).toBe(1);
      expect([...result].sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    });

    it('opposite ordering produces valid permutation', () => {
      const result = generateOrdering(10, 'clockwise', 'opposite', 0);
      expect([...result].sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    });
  });

  describe('rectangle opposite ordering', () => {
    it('pairs seats across top/bottom', () => {
      const config = { top: 3, bottom: 3, left: 0, right: 0 };
      const result = generateOrdering(6, 'clockwise', 'opposite', 0, config);
      expect(result.length).toBe(6);
      expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });
});

// ============================================================================
// SCALE CONFIG AND RANGE TESTS
// ============================================================================

describe('scaleConfigV2', () => {
  it('scales circle config directly', () => {
    const result = scaleConfigV2(FAREWELL_DINNER_CONFIG, 12);
    expect(isCircleResultV2(result)).toBe(true);
    expect(result.seatCount).toBe(12);
  });

  it('scales rectangle config directly', () => {
    const result = scaleConfigV2(BOARDROOM_CONFIG, 12);
    expect(isRectangleResultV2(result)).toBe(true);
    expect(result.seatCount).toBe(12);
  });
});

describe('getScaleRangeV2', () => {
  it('returns 2-30 for circle templates', () => {
    const template = makeCircleTemplate(FAREWELL_DINNER_CONFIG);
    const range = getScaleRangeV2(template);
    expect(range.min).toBe(2);
    expect(range.max).toBe(30);
  });

  it('returns correct range for rectangle templates with fixed sides', () => {
    const template = makeRectangleTemplate(U_SHAPED_CONFIG);
    const range = getScaleRangeV2(template);
    // Top has 2 fixed seats, others are scalable (but bottom is disabled)
    expect(range.min).toBe(2);
    expect(range.max).toBeLessThanOrEqual(60);
  });
});

// ============================================================================
// STRUCTURAL INTEGRITY TESTS
// ============================================================================

describe('Structural Integrity', () => {
  it('all circle results have unique seat numbers', () => {
    const configs = [FAREWELL_DINNER_CONFIG, MEAL_ROUND_EVEN_CONFIG];
    for (const config of configs) {
      const template = makeCircleTemplate(config);
      for (const size of [6, 8, 10, 12, 14, 16]) {
        const result = scaleTemplateV2(template, { targetSeatCount: size }) as ScaledCircleResultV2;
        expect(new Set(result.seatOrdering).size).toBe(size);
      }
    }
  });

  it('all rectangle results have unique seat numbers', () => {
    const configs = [BOARDROOM_CONFIG, LONG_TABLE_GOH_CONFIG, U_SHAPED_CONFIG];
    for (const config of configs) {
      const template = makeRectangleTemplate(config);
      for (const size of [8, 10, 12, 14, 16]) {
        const result = scaleTemplateV2(template, { targetSeatCount: size }) as ScaledRectangleResultV2;
        expect(new Set(result.seatOrdering).size).toBe(size);
      }
    }
  });

  it('circle seat count matches array lengths', () => {
    const template = makeCircleTemplate(FAREWELL_DINNER_CONFIG);
    for (const size of [6, 10, 14, 20]) {
      const result = scaleTemplateV2(template, { targetSeatCount: size }) as ScaledCircleResultV2;
      expect(result.seatOrdering.length).toBe(size);
      expect(result.seatModes.length).toBe(size);
      expect(result.seats.length).toBe(size);
    }
  });

  it('rectangle sideSeats sum matches seatCount', () => {
    const template = makeRectangleTemplate(LONG_TABLE_GOH_CONFIG);
    for (const size of [8, 10, 12, 14]) {
      const result = scaleTemplateV2(template, { targetSeatCount: size }) as ScaledRectangleResultV2;
      const sideSum = result.sideSeats.top + result.sideSeats.right
        + result.sideSeats.bottom + result.sideSeats.left;
      expect(sideSum).toBe(result.seatCount);
    }
  });
});
