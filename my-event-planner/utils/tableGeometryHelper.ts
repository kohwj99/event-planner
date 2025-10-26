import { Table } from "@/types/Table";

/** Get the bounding box of a rectangular table */
export const getTableBounds = (table: Table) => {
  return {
    left: table.x,
    top: table.y,
    right: table.x + (table.width ?? 0),
    bottom: table.y + (table.height ?? 0),
  };
};

/** Check whether a pointer or point lies inside a table */
export const isPointInsideTable = (table: Table, x: number, y: number) => {
  const bounds = getTableBounds(table);
  return (
    x >= bounds.left &&
    x <= bounds.right &&
    y >= bounds.top &&
    y <= bounds.bottom
  );
};

/** Move a table and all of its seats by dx/dy */
export const moveTableGeometry = (table: Table, dx: number, dy: number): Table => {
  return {
    ...table,
    x: table.x + dx,
    y: table.y + dy,
    seats: table.seats.map((s) => ({
      ...s,
      x: s.x + dx,
      y: s.y + dy,
    })),
  };
};
