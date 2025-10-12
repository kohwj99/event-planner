// const width = 120;
// const height = 80;
// const seatsCount = 10;

// // Distribute seats around four sides
// const seats = [];
// const sides = [
//   { x1: 0, y1: 0, x2: width, y2: 0 },      // top
//   { x1: width, y1: 0, x2: width, y2: height }, // right
//   { x1: width, y1: height, x2: 0, y2: height }, // bottom
//   { x1: 0, y1: height, x2: 0, y2: 0 },    // left
// ];

// const seatsPerSide = Math.ceil(seatsCount / 4);

// sides.forEach((side) => {
//   for (let i = 0; i < seatsPerSide; i++) {
//     const t = i / (seatsPerSide + 1);
//     seats.push({
//       x: side.x1 + (side.x2 - side.x1) * t,
//       y: side.y1 + (side.y2 - side.y1) * t,
//     });
//   }
// });

// console.log(seats);
