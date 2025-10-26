import { CHUNK_WIDTH, CHUNK_HEIGHT, Chunk } from "@/types/Chunk";
import { Table } from "@/types/Table";

/** Return consistent chunk key like "row:1_col:3" */
export const getChunkKey = (row: number, col: number) =>
  `row:${row}_col:${col}`;

/** Convert table or coordinate to chunk row/col */
export const getChunkCoords = (x: number, y: number) => {
  const col = Math.floor(x / CHUNK_WIDTH);
  const row = Math.floor(y / CHUNK_HEIGHT);
  return { row, col };
};

/** Convenience: find chunk for a given table */
export const getTableChunk = (table: Table) => {
  return getChunkCoords(table.x, table.y);
};

/** Helper: find world pixel bounds of a chunk (used for rendering / culling) */
export const getChunkBounds = (row: number, col: number) => {
  return {
    left: col * CHUNK_WIDTH,
    top: row * CHUNK_HEIGHT,
    right: (col + 1) * CHUNK_WIDTH,
    bottom: (row + 1) * CHUNK_HEIGHT,
  };
};

// chunk management helpers
/** Ensure a chunk exists in the map, create if missing */
export const ensureChunkExists = (
  chunks: Record<string, Chunk>,
  row: number,
  col: number
) => {
  const key = getChunkKey(row, col);
  if (!chunks[key]) {
    chunks[key] = { id: key, row, col, tables: [] };
  }
  return key;
};

/** Add a table to a chunk (no duplicate tables) */
export const assignTableToChunk = (
  chunks: Record<string, Chunk>,
  tableId: string,
  row: number,
  col: number
) => {
  const key = ensureChunkExists(chunks, row, col);
  const chunk = chunks[key];
  if (!chunk.tables.includes(tableId)) {
    chunk.tables.push(tableId);
  }
  return key;
};

/** Remove a table from whichever chunk currently holds it */
export const removeTableFromChunk = (
  chunks: Record<string, Chunk>,
  tableId: string
) => {
  for (const key in chunks) {
    const idx = chunks[key].tables.indexOf(tableId);
    if (idx > -1) {
      chunks[key].tables.splice(idx, 1);
      break;
    }
  }
};

/** Move a table between chunks if chunk changed */
export const moveTableBetweenChunks = (
  chunks: Record<string, Chunk>,
  tableId: string,
  newRow: number,
  newCol: number
) => {
  removeTableFromChunk(chunks, tableId);
  return assignTableToChunk(chunks, tableId, newRow, newCol);
};