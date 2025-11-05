import { Guest } from "@/store/guestStore";

/**
 * Spread out hosts by a gap value (best-effort).
 * E.g., gap = 1: host -> external -> host
 * gap = 2: host -> external -> external -> host
 */
export function applySpacingRule(tables: Guest[][], gap: number) {
  return tables.map((table) => {
    if (table.length === 0 || gap < 1) return table;

    const hosts = table.filter((g) => g.fromHost);
    const externals = table.filter((g) => !g.fromHost);

    if (hosts.length === 0 || externals.length === 0) return table;

    const result: Guest[] = [];
    let hostIdx = 0;
    let externalIdx = 0;

    for (let seatIdx = 0; seatIdx < table.length; seatIdx++) {
      if (hostIdx < hosts.length) {
        result.push(hosts[hostIdx]);
        hostIdx++;
      } else if (externalIdx < externals.length) {
        result.push(externals[externalIdx]);
        externalIdx++;
      }

      // Fill gap externals
      for (let g = 0; g < gap && externalIdx < externals.length; g++) {
        result.push(externals[externalIdx]);
        externalIdx++;
        seatIdx++;
      }
    }

    while (hostIdx < hosts.length) result.push(hosts[hostIdx++]);
    while (externalIdx < externals.length) result.push(externals[externalIdx++]);

    return result;
  });
}


// import { Guest } from "@/store/guestStore";

// interface SpacingRuleOptions {
//   enabled: boolean;
//   gap: number; // number of external guests between hosts
// }

// export function applySpacingRule(
//   tables: (Guest | null)[][],
//   spacingCount: number,
// ): (Guest | null)[][] {
//   if (!spacingCount || spacingCount < 1) return tables;

//   return tables.map((table) => {
//     const guests = table.filter((g): g is Guest => g !== null); // remove nulls
//     const hosts = guests.filter((g) => g.fromHost);
//     const externals = guests.filter((g) => !g.fromHost);

//     // If no mix or insufficient guests, return table unchanged
//     if (hosts.length === 0 || externals.length === 0) return table;

//     const result: (Guest | null)[] = [...Array(table.length)].map(() => null);

//     let hostIndex = 0;
//     let externalIndex = 0;
//     let position = 0;

//     while (position < table.length && (hostIndex < hosts.length || externalIndex < externals.length)) {
//       // Place a host
//       if (hostIndex < hosts.length) {
//         result[position] = hosts[hostIndex++];
//         position++;
//       }

//       // Place spacingCount external guests
//       for (let i = 0; i < spacingCount && position < table.length && externalIndex < externals.length; i++) {
//         result[position] = externals[externalIndex++];
//         position++;
//       }
//     }

//     // Fill leftover externals or hosts into remaining null spots
//     for (let i = 0; i < result.length; i++) {
//       if (result[i] === null) {
//         if (externalIndex < externals.length) result[i] = externals[externalIndex++];
//         else if (hostIndex < hosts.length) result[i] = hosts[hostIndex++];
//       }
//     }

//     return result;
//   });
// }

