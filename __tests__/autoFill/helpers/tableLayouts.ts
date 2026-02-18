import { createRoundTable, resetTableCounter } from '../factories/tableFactory';

export function createSingleTableLayout(seatCount = 8) {
  resetTableCounter();
  return [createRoundTable({ seatCount, label: 'Table A' })];
}

export function createTwoTableLayout(seatsPerTable = 6) {
  resetTableCounter();
  const t1 = createRoundTable({ seatCount: seatsPerTable, label: 'Table A' });
  const t2 = createRoundTable({ seatCount: seatsPerTable, label: 'Table B' });
  return [t1, t2];
}

export function createThreeTableLayout(seatsPerTable = 4) {
  resetTableCounter();
  const t1 = createRoundTable({ seatCount: seatsPerTable, label: 'Table A' });
  const t2 = createRoundTable({ seatCount: seatsPerTable, label: 'Table B' });
  const t3 = createRoundTable({ seatCount: seatsPerTable, label: 'Table C' });
  return [t1, t2, t3];
}
