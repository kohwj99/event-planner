"use client";

import { Circle } from "react-konva";

interface SeatProps {
  x: number;
  y: number;
  radius?: number;
  color?: string;
  id: string;
  onClick?: (id: string) => void;
}

export default function Seat({ x, y, radius = 12, color = "#FFD700", id, onClick }: SeatProps) {
  return (
    <Circle
      x={x}
      y={y}
      radius={radius}
      fill={color}
      stroke="black"
      strokeWidth={1}
      draggable
      onClick={() => onClick?.(id)}
    />
  );
}
