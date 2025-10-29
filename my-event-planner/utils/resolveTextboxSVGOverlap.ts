// function resolveOverlaps(
//   boxes: { x: number; y: number; width: number; height: number }[],
//   shape: 'round' | 'rect'
// ) {
//   const iterations = 25;
//   const padding = 6;

//   for (let k = 0; k < iterations; k++) {
//     for (let i = 0; i < boxes.length; i++) {
//       for (let j = i + 1; j < boxes.length; j++) {
//         const a = boxes[i];
//         const b = boxes[j];

//         // detect overlap
//         if (
//           a.x < b.x + b.width + padding &&
//           a.x + a.width + padding > b.x &&
//           a.y < b.y + b.height + padding &&
//           a.y + a.height + padding > b.y
//         ) {
//           const dx = (a.x + a.width / 2) - (b.x + b.width / 2);
//           const dy = (a.y + a.height / 2) - (b.y + b.height / 2);
//           const dist = Math.sqrt(dx * dx + dy * dy) || 1;
//           const move = 1.5;

//           // For rectangular tables, bias direction
//           if (shape === 'rect') {
//             if (Math.abs(dx) > Math.abs(dy)) {
//               a.x += Math.sign(dx) * move;
//               b.x -= Math.sign(dx) * move;
//             } else {
//               a.y += Math.sign(dy) * move;
//               b.y -= Math.sign(dy) * move;
//             }
//           } else {
//             a.x += (dx / dist) * move;
//             a.y += (dy / dist) * move;
//             b.x -= (dx / dist) * move;
//             b.y -= (dy / dist) * move;
//           }
//         }
//       }
//     }
//   }
// }



function resolveOverlaps(
  boxes: { x: number; y: number; width: number; height: number; nx: number; ny: number }[],
  shape: 'round' | 'rect'
) {
  const iterations = 25;
  const padding = 6;

  for (let k = 0; k < iterations; k++) {
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];

        if (
          a.x < b.x + b.width + padding &&
          a.x + a.width + padding > b.x &&
          a.y < b.y + b.height + padding &&
          a.y + a.height + padding > b.y
        ) {
          // Compute vector between centers
          const dx = (a.x + a.width / 2) - (b.x + b.width / 2);
          const dy = (a.y + a.height / 2) - (b.y + b.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const move = 2;

          if (shape === 'rect') {
            // Rectangular: only move along preferred nx/ny
            if (a.nx !== 0) {
              a.x += a.nx * move;
              b.x -= b.nx * move;
            } else if (a.ny !== 0) {
              a.y += a.ny * move;
              b.y -= b.ny * move;
            }
          } else {
            // Round: move along radial vector
            a.x += (a.nx / dist) * move;
            a.y += (a.ny / dist) * move;
            b.x -= (b.nx / dist) * move;
            b.y -= (b.ny / dist) * move;
          }
        }
      }
    }
  }
}
