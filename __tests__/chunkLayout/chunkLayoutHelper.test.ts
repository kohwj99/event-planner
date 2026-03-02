import { describe, it, expect, beforeEach } from 'vitest';
import { computeChunkLayout, ChunkLayoutConfig } from '@/utils/chunkLayoutHelper';
import { CHUNK_WIDTH, CHUNK_HEIGHT } from '@/types/Chunk';
import { createRoundTable, resetTableCounter } from '../autoFill/factories/tableFactory';
import { Table } from '@/types/Table';

function makeTables(count: number, labelPrefix = 'Table'): Table[] {
  resetTableCounter();
  return Array.from({ length: count }, (_, i) =>
    createRoundTable({ label: `${labelPrefix} ${i + 1}`, seatCount: 4 }) as Table
  );
}

describe('computeChunkLayout', () => {
  beforeEach(() => {
    resetTableCounter();
  });

  it('returns empty tables and default chunk for zero tables', () => {
    const result = computeChunkLayout([], { rows: 2, cols: 2, tablesPerChunk: 1 });
    expect(result.tables).toHaveLength(0);
    expect(Object.keys(result.chunks)).toHaveLength(1);
    expect(result.chunks['row:0_col:0']).toBeDefined();
  });

  it('places all tables in a single chunk when 1x1 grid', () => {
    const tables = makeTables(3);
    const config: ChunkLayoutConfig = { rows: 1, cols: 1, tablesPerChunk: 3 };
    const result = computeChunkLayout(tables, config);

    expect(result.tables).toHaveLength(3);
    expect(result.chunks['row:0_col:0'].tables).toHaveLength(3);

    // All tables should be within chunk (0,0) bounds
    for (const t of result.tables) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(CHUNK_WIDTH);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThan(CHUNK_HEIGHT);
    }
  });

  it('places 1 table per chunk in a 2x2 grid', () => {
    const tables = makeTables(4);
    const config: ChunkLayoutConfig = { rows: 2, cols: 2, tablesPerChunk: 1 };
    const result = computeChunkLayout(tables, config);

    expect(result.tables).toHaveLength(4);
    expect(result.chunks['row:0_col:0'].tables).toHaveLength(1);
    expect(result.chunks['row:0_col:1'].tables).toHaveLength(1);
    expect(result.chunks['row:1_col:0'].tables).toHaveLength(1);
    expect(result.chunks['row:1_col:1'].tables).toHaveLength(1);

    // Table 1 should be in top-left chunk
    const t1 = result.tables[0];
    expect(t1.x).toBeGreaterThanOrEqual(0);
    expect(t1.x).toBeLessThan(CHUNK_WIDTH);
    expect(t1.y).toBeGreaterThanOrEqual(0);
    expect(t1.y).toBeLessThan(CHUNK_HEIGHT);

    // Table 2 should be in top-right chunk
    const t2 = result.tables[1];
    expect(t2.x).toBeGreaterThanOrEqual(CHUNK_WIDTH);
    expect(t2.x).toBeLessThan(2 * CHUNK_WIDTH);
    expect(t2.y).toBeGreaterThanOrEqual(0);
    expect(t2.y).toBeLessThan(CHUNK_HEIGHT);

    // Table 3 should be in bottom-left chunk
    const t3 = result.tables[2];
    expect(t3.x).toBeGreaterThanOrEqual(0);
    expect(t3.x).toBeLessThan(CHUNK_WIDTH);
    expect(t3.y).toBeGreaterThanOrEqual(CHUNK_HEIGHT);
    expect(t3.y).toBeLessThan(2 * CHUNK_HEIGHT);

    // Table 4 should be in bottom-right chunk
    const t4 = result.tables[3];
    expect(t4.x).toBeGreaterThanOrEqual(CHUNK_WIDTH);
    expect(t4.x).toBeLessThan(2 * CHUNK_WIDTH);
    expect(t4.y).toBeGreaterThanOrEqual(CHUNK_HEIGHT);
    expect(t4.y).toBeLessThan(2 * CHUNK_HEIGHT);
  });

  it('handles reading order: left-to-right then top-to-bottom', () => {
    const tables = makeTables(6);
    const config: ChunkLayoutConfig = { rows: 2, cols: 3, tablesPerChunk: 1 };
    const result = computeChunkLayout(tables, config);

    // Row 0: tables 1,2,3; Row 1: tables 4,5,6
    expect(result.chunks['row:0_col:0'].tables).toHaveLength(1);
    expect(result.chunks['row:0_col:1'].tables).toHaveLength(1);
    expect(result.chunks['row:0_col:2'].tables).toHaveLength(1);
    expect(result.chunks['row:1_col:0'].tables).toHaveLength(1);
    expect(result.chunks['row:1_col:1'].tables).toHaveLength(1);
    expect(result.chunks['row:1_col:2'].tables).toHaveLength(1);

    // Verify X increases left-to-right for first row
    expect(result.tables[0].x).toBeLessThan(result.tables[1].x);
    expect(result.tables[1].x).toBeLessThan(result.tables[2].x);

    // Verify Y increases for second row
    expect(result.tables[0].y).toBeLessThan(result.tables[3].y);
  });

  it('handles overflow when more tables than capacity', () => {
    const tables = makeTables(6);
    const config: ChunkLayoutConfig = { rows: 1, cols: 2, tablesPerChunk: 2 };
    // Capacity = 1 * 2 * 2 = 4, overflow = 2
    const result = computeChunkLayout(tables, config);

    expect(result.tables).toHaveLength(6);
    // First 4 in configured chunks
    expect(result.chunks['row:0_col:0'].tables).toHaveLength(2);
    expect(result.chunks['row:0_col:1'].tables).toHaveLength(2);
    // Overflow into row:1
    expect(result.chunks['row:1_col:0'].tables).toHaveLength(2);
  });

  it('sorts tables by label number for correct ordering', () => {
    resetTableCounter();
    const t3 = createRoundTable({ id: 'tA', label: 'Table 3', seatCount: 4 }) as Table;
    const t1 = createRoundTable({ id: 'tB', label: 'Table 1', seatCount: 4 }) as Table;
    const t2 = createRoundTable({ id: 'tC', label: 'Table 2', seatCount: 4 }) as Table;

    const config: ChunkLayoutConfig = { rows: 1, cols: 3, tablesPerChunk: 1 };
    const result = computeChunkLayout([t3, t1, t2], config);

    // Should be ordered: Table 1, Table 2, Table 3 (by label number)
    expect(result.tables[0].label).toBe('Table 1');
    expect(result.tables[1].label).toBe('Table 2');
    expect(result.tables[2].label).toBe('Table 3');

    // Table 1 should be leftmost
    expect(result.tables[0].x).toBeLessThan(result.tables[1].x);
    expect(result.tables[1].x).toBeLessThan(result.tables[2].x);
  });

  it('preserves seat coordinates relative to table center', () => {
    const tables = makeTables(1);
    const original = tables[0];
    const originalSeatOffsets = original.seats.map((s) => ({
      dx: s.x - original.x,
      dy: s.y - original.y,
    }));

    const config: ChunkLayoutConfig = { rows: 1, cols: 1, tablesPerChunk: 1 };
    const result = computeChunkLayout(tables, config);
    const moved = result.tables[0];

    // Seat offsets from table center should be identical
    for (let i = 0; i < moved.seats.length; i++) {
      const movedDx = moved.seats[i].x - moved.x;
      const movedDy = moved.seats[i].y - moved.y;
      expect(movedDx).toBeCloseTo(originalSeatOffsets[i].dx, 5);
      expect(movedDy).toBeCloseTo(originalSeatOffsets[i].dy, 5);
    }
  });

  it('handles fewer tables than capacity gracefully', () => {
    const tables = makeTables(2);
    const config: ChunkLayoutConfig = { rows: 3, cols: 3, tablesPerChunk: 4 };
    // Capacity = 36, only 2 tables
    const result = computeChunkLayout(tables, config);

    expect(result.tables).toHaveLength(2);
    // Both tables in first chunk
    expect(result.chunks['row:0_col:0'].tables).toHaveLength(2);
    // All 9 configured chunks should exist
    expect(Object.keys(result.chunks)).toHaveLength(9);
  });

  it('creates correct sub-grid positions within a chunk', () => {
    const tables = makeTables(4);
    const config: ChunkLayoutConfig = { rows: 1, cols: 1, tablesPerChunk: 4 };
    const result = computeChunkLayout(tables, config);

    // With 4 tables per chunk, sub-grid is 2x2
    // Table 1 (top-left) should have smaller x and y than Table 4 (bottom-right)
    expect(result.tables[0].x).toBeLessThan(result.tables[1].x); // T1 left of T2
    expect(result.tables[0].y).toBeLessThan(result.tables[2].y); // T1 above T3
    expect(result.tables[2].x).toBeLessThan(result.tables[3].x); // T3 left of T4
    expect(result.tables[0].y).toBeCloseTo(result.tables[1].y, 1); // T1 same row as T2
    expect(result.tables[2].y).toBeCloseTo(result.tables[3].y, 1); // T3 same row as T4
  });
});
