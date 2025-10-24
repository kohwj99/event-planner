import { Seat } from "./Seat";

export interface Table {
  id: string;
  x: number;
  y: number;
  radius: number;
  seats: Seat[];
  label: string;
  shape: "round" | "square" | "rectangle";
  width?: number;  // for rectangular tables
  height?: number; // for rectangular tables
}
