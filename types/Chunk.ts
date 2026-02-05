export interface Chunk {
  id: string; // e.g. "row:0_col:0"
  row: number;
  col: number;
  tables: string[]; // table IDs within this chunk
}

export const CHUNK_WIDTH = 2000;
export const CHUNK_HEIGHT = 1200;
export const getChunkKey = (row: number, col: number) => `row:${row}_col:${col}`;
export const getChunkCoords = (x: number, y: number) => {
  const col = Math.floor(x / CHUNK_WIDTH);
  const row = Math.floor(y / CHUNK_HEIGHT);
  return { row, col };
};
