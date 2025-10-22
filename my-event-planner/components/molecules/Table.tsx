"use client";

import { Rect, Circle, Group } from "react-konva";
import * as d3 from "d3";
import Seat from "./Seat";

export type TableType = "circle" | "rectangle";

export interface TableProps {
  x: number;
  y: number;
  type: TableType;
  totalSeats: number;
  seatsPerSide?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  baseSize?: number; // Used for circle tables
  baseWidth?: number; // Used for rectangle tables
  baseHeight?: number;
  onSeatClick?: (id: string) => void;
}

/**
 * Renders a table (circle or rectangle) with seats distributed around it.
 */
export default function Table({
  x,
  y,
  type,
  totalSeats,
  seatsPerSide = { top: 2, right: 2, bottom: 2, left: 2 },
  baseSize = 60,
  baseWidth = 100,
  baseHeight = 60,
  onSeatClick,
}: TableProps) {
  let width = baseWidth;
  let height = baseHeight;
  let radius = baseSize;

  // Adjust circle size based on number of seats
  if (type === "circle") {
    radius = Math.max(baseSize, 30 + totalSeats * 6);
  }

  // Adjust rectangle size based on seat distribution
  if (type === "rectangle") {
    const { top = 0, right = 0, bottom = 0, left = 0 } = seatsPerSide;
    const horizontalSeats = Math.max(top, bottom);
    const verticalSeats = Math.max(left, right);

    width = baseWidth + horizontalSeats * 25;
    height = baseHeight + verticalSeats * 25;
  }

  // === Seat Position Calculation ===
  let seats: { id: string; x: number; y: number }[] = [];

  if (type === "circle") {
    // Arrange seats evenly around a circle
    seats = d3.range(totalSeats).map((i) => {
      const angle = (i / totalSeats) * 2 * Math.PI - Math.PI / 2; // Start from top
      return {
        id: `seat-${i}`,
        x: x + Math.cos(angle) * (radius + 25),
        y: y + Math.sin(angle) * (radius + 25),
      };
    });
  } else {
    // Rectangle seats per side
    const { top = 0, right = 0, bottom = 0, left = 0 } = seatsPerSide;
    const padding = 10;

    // Top
    for (let i = 0; i < top; i++) {
      const posX = x + ((i + 1) * width) / (top + 1);
      seats.push({ id: `seat-top-${i}`, x: posX, y: y - padding });
    }

    // Bottom
    for (let i = 0; i < bottom; i++) {
      const posX = x + ((i + 1) * width) / (bottom + 1);
      seats.push({ id: `seat-bottom-${i}`, x: posX, y: y + height + padding });
    }

    // Left
    for (let i = 0; i < left; i++) {
      const posY = y + ((i + 1) * height) / (left + 1);
      seats.push({ id: `seat-left-${i}`, x: x - padding, y: posY });
    }

    // Right
    for (let i = 0; i < right; i++) {
      const posY = y + ((i + 1) * height) / (right + 1);
      seats.push({ id: `seat-right-${i}`, x: x + width + padding, y: posY });
    }
  }

  // === Render ===
  return (
    <Group x={x} y={y} draggable>
      {type === "circle" && (
        <Circle x={0} y={0} radius={radius} fill="#6C63FF" stroke="black" strokeWidth={2} />
      )}

      {type === "rectangle" && (
        <Rect x={0} y={0} width={width} height={height} fill="#6C63FF" stroke="black" strokeWidth={2} />
      )}

      {seats.map((seat) => (
        <Seat
          key={seat.id}
          id={seat.id}
          x={seat.x - x}
          y={seat.y - y}
          onClick={onSeatClick}
        />
      ))}
    </Group>
  );
}
