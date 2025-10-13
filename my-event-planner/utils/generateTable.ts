import { Table } from "@/store/seatStore";

export function createRoundTable(
  id: string,
  x: number,
  y: number,
  radius: number,
  seatCount: number,
  label: string
): Table {
  const seats = [];
  const seatRadius = 12;
  const angleStep = (2 * Math.PI) / seatCount;

  for (let i = 0; i < seatCount; i++) {
    const angle = i * angleStep;
    const sx = x + (radius + 30) * Math.cos(angle);
    const sy = y + (radius + 30) * Math.sin(angle);
    seats.push({
      id: `${id}-seat-${i}`,
      x: sx,
      y: sy,
      radius: seatRadius,
      label: `${i + 1}`,
      assignedGuestId: null,
    });
  }

  return {
    id,
    x,
    y,
    radius,
    seats,
    label,
    shape: "round",
  };
}
