// types/Table.ts
// Table type definition with metadata for rectangle configuration

import { Seat } from "./Seat";

/**
 * Rectangle seats configuration
 * Stores the number of seats on each side for rectangle tables
 */
export interface RectangleSeatsConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Table {
  id: string;
  x: number;
  y: number;
  radius: number;
  seats: Seat[];
  label: string;
  shape: "round" | "rectangle";
  width?: number;  // for rectangular tables
  height?: number; // for rectangular tables
  
  // NEW: Store the rectangle seat configuration for accurate modification
  // This is set when creating rectangle tables and used by ModifyTableModal
  rectangleSeats?: RectangleSeatsConfig;
}