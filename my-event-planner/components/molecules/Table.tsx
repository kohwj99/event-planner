// app/seating/components/Table.tsx
"use client";

import { Rect, Circle, Group } from "react-konva";
import Seat from "./Seat";
import * as d3 from "d3";

type TableType = "circle" | "square" | "rectangle";

interface TableProps {
  x: number;
  y: number;
  type: TableType;
  seatsCount: number;
  baseWidth?: number;
  baseHeight?: number;
  onSeatClick?: (id: string) => void;
}

export default function Table({
  x,
  y,
  type,
  seatsCount,
  baseWidth = 100,
  baseHeight = 60,
  onSeatClick,
}: TableProps) {
  // 1️⃣ Calculate table dimensions
  let width = baseWidth;
  let height = baseHeight;
  let radius = Math.max(width, height) / 2;

  if (type === "circle") {
    radius = 30 + seatsCount * 8; // scale radius by number of seats
  } else if (type === "square") {
    const seatsPerSide = Math.ceil(seatsCount / 4);
    width = baseWidth + seatsPerSide * 20;
    height = baseHeight + seatsPerSide * 20;
  } else if (type === "rectangle") {
    const seatsPerSide = Math.ceil(seatsCount / 4);
    width = baseWidth + seatsPerSide * 25;
    height = baseHeight + Math.ceil(seatsPerSide / 2) * 20;
  }

  // 2️⃣ Calculate seat positions
  let seats: { x: number; y: number; id: string }[] = [];

  if (type === "circle") {
    seats = d3.range(seatsCount).map((i) => {
      const angle = (i / seatsCount) * 2 * Math.PI;
      return {
        x: x + Math.cos(angle) * (radius + 20),
        y: y + Math.sin(angle) * (radius + 20),
        id: `seat-${i}`,
      };
    });
  } else {
    // Rectangular or square table
    const sides = [
      { x1: 0, y1: 0, x2: width, y2: 0 }, // top
      { x1: width, y1: 0, x2: width, y2: height }, // right
      { x1: width, y1: height, x2: 0, y2: height }, // bottom
      { x1: 0, y1: height, x2: 0, y2: 0 }, // left
    ];
    const seatsPerSide = Math.ceil(seatsCount / 4);
    sides.forEach((side, sIdx) => {
      for (let i = 0; i < seatsPerSide; i++) {
        const t = (i + 1) / (seatsPerSide + 1);
        if (seats.length < seatsCount) {
          seats.push({
            x: x + side.x1 + (side.x2 - side.x1) * t,
            y: y + side.y1 + (side.y2 - side.y1) * t,
            id: `seat-${seats.length}`,
          });
        }
      }
    });
  }

  // 3️⃣ Render Table + Seats
  return (
    <Group x={x} y={y} draggable>
      {type === "circle" && (
        <Circle x={0} y={0} radius={radius} fill="#6C63FF" stroke="black" strokeWidth={2} />
      )}
      {(type === "square" || type === "rectangle") && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#6C63FF"
          stroke="black"
          strokeWidth={2}
          cornerRadius={type === "square" ? 10 : 0}
        />
      )}

      {seats.map((seat) => (
        <Seat
          key={seat.id}
          x={seat.x - x} // adjust relative to Group
          y={seat.y - y}
          id={seat.id}
          onClick={onSeatClick}
        />
      ))}
    </Group>
  );
}
