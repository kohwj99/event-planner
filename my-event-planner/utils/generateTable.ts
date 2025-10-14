import { Table } from "@/store/seatStore";

export function createRoundTable(
  id: string,
  centerX: number,
  centerY: number,
  radius: number,
  seatCount: number,
  label: string
): Table {
  const seats = [];
  const seatRadius = 12;
  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2; // start top, clockwise
    const x = centerX + Math.cos(angle) * (radius + 30);
    const y = centerY + Math.sin(angle) * (radius + 30);
    seats.push({
      id: `${id}-seat-${i + 1}`,
      x,
      y,
      radius: seatRadius,
      label: `${i + 1}`,
      seatNumber: i + 1,
      assignedGuestId: null,
      locked: false,
      selected: false,
    });
  }

  return {
    id,
    x: centerX,
    y: centerY,
    radius,
    label,
    shape: "round",
    seats,
  };
}
