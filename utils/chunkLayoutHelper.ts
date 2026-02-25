import { Table } from "@/types/Table";
import { Chunk, CHUNK_WIDTH, CHUNK_HEIGHT } from "@/types/Chunk";
import { moveTableGeometry } from "@/utils/tableGeometryHelper";
import { getChunkKey, ensureChunkExists, assignTableToChunk } from "@/utils/chunkHelper";

export interface ChunkLayoutConfig {
  rows: number;
  cols: number;
  tablesPerChunk: number;
}

export interface ChunkLayoutResult {
  tables: Table[];
  chunks: Record<string, Chunk>;
}

/**
 * Extract the numeric suffix from a table label (e.g. "Table 12" -> 12).
 * Returns Infinity if no number is found so those tables sort last.
 */
function extractTableNumber(label: string): number {
  const match = label.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : Infinity;
}

/**
 * Compute new positions for all tables arranged in a chunk grid.
 *
 * Tables are sorted by label number, then assigned to chunk cells in
 * reading order (left-to-right, top-to-bottom). Within each chunk,
 * tables are arranged in an auto sub-grid.
 */
export function computeChunkLayout(
  tables: Table[],
  config: ChunkLayoutConfig
): ChunkLayoutResult {
  if (tables.length === 0) {
    const chunks: Record<string, Chunk> = {};
    ensureChunkExists(chunks, 0, 0);
    return { tables: [], chunks };
  }

  const { rows, cols, tablesPerChunk } = config;
  const tpc = Math.max(1, tablesPerChunk);

  // Sort tables by label number for consistent ordering
  const sorted = [...tables].sort((a, b) => {
    const numA = extractTableNumber(a.label);
    const numB = extractTableNumber(b.label);
    if (numA !== numB) return numA - numB;
    // Fallback: preserve original order via label string comparison
    return a.label.localeCompare(b.label);
  });

  // Compute sub-grid dimensions within a single chunk
  const subCols = Math.ceil(Math.sqrt(tpc));
  const subRows = Math.ceil(tpc / subCols);

  // Padding inside each chunk to avoid edge overlap
  const hPad = 150;
  const vPad = 100;
  const cellWidth = (CHUNK_WIDTH - 2 * hPad) / subCols;
  const cellHeight = (CHUNK_HEIGHT - 2 * vPad) / subRows;

  const chunks: Record<string, Chunk> = {};
  const movedTables: Table[] = [];

  // Ensure all configured chunks exist
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ensureChunkExists(chunks, r, c);
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const table = sorted[i];

    // Which chunk cell does this table go to?
    const cellIndex = Math.floor(i / tpc);
    // For overflow: extend columns beyond configured grid
    const chunkRow = Math.floor(cellIndex / cols);
    const chunkCol = cellIndex % cols;

    // Ensure overflow chunks exist
    ensureChunkExists(chunks, chunkRow, chunkCol);

    // Local index within the chunk
    const localIdx = i % tpc;
    const localRow = Math.floor(localIdx / subCols);
    const localCol = localIdx % subCols;

    // New center position
    const newX = chunkCol * CHUNK_WIDTH + hPad + (localCol + 0.5) * cellWidth;
    const newY = chunkRow * CHUNK_HEIGHT + vPad + (localRow + 0.5) * cellHeight;

    const dx = newX - table.x;
    const dy = newY - table.y;
    const moved = moveTableGeometry(table, dx, dy);
    movedTables.push(moved);

    assignTableToChunk(chunks, moved.id, chunkRow, chunkCol);
  }

  return { tables: movedTables, chunks };
}
