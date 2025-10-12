import * as d3 from "d3";

const tableX = 200;
const tableY = 200;
const seatsCount = 8;

// Radius depends on number of seats
const radius = 30 + seatsCount * 5;

// Table circle
const table = { x: tableX, y: tableY, radius };

// Compute seat positions around table
const seats = d3.range(seatsCount).map((i) => {
  const angle = (i / seatsCount) * 2 * Math.PI;
  return {
    x: tableX + Math.cos(angle) * (radius + 15),
    y: tableY + Math.sin(angle) * (radius + 15),
  };
});

console.log(table, seats);
