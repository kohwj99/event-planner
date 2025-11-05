import { Guest } from "@/store/guestStore";

interface RatioRuleOptions {
  enabled: boolean;
  hostPercentage: number; // e.g. 20 means 20% hosts per table
}

export function applyRatioRule(
  tables: Guest[][],
  hosts: Guest[],
  externals: Guest[],
  options?: RatioRuleOptions
): Guest[][] {
  if (!options?.enabled) return tables;

  const { hostPercentage } = options;
  const hostPool = [...hosts];
  const externalPool = [...externals];

  return tables.map((table) => {
    const tableSize = table.length;
    const expectedHosts = Math.round((hostPercentage / 100) * tableSize);
    const newTable: Guest[] = [];

    // Add hosts up to expected count
    for (let i = 0; i < expectedHosts && hostPool.length > 0; i++) {
      newTable.push(hostPool.shift()!);
    }

    // Fill rest with externals
    while (newTable.length < tableSize && externalPool.length > 0) {
      newTable.push(externalPool.shift()!);
    }

    // Best-effort fill if one pool runs out
    const leftovers = [...hostPool, ...externalPool];
    while (newTable.length < tableSize && leftovers.length > 0) {
      newTable.push(leftovers.shift()!);
    }

    return newTable;
  });
}
