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

  return tables.map((table) => {
    const tableSize = table.length;
    const expectedHosts = Math.round((hostPercentage / 100) * tableSize);

    const currentHosts = table.filter((g) => g.fromHost);
    const currentExternals = table.filter((g) => !g.fromHost);

    // Already satisfies ratio (or best effort if insufficient supply)
    if (currentHosts.length === expectedHosts) return table;

    const newTable: Guest[] = [];

    // Add required hosts up to the expected count
    while (newTable.filter((g) => g?.fromHost).length < expectedHosts && hosts.length > 0) {
      const host = hosts.shift();
      if (host) newTable.push(host);
    }

    // Fill rest with externals
    while (newTable.length < tableSize && externals.length > 0) {
      const ext = externals.shift();
      if (ext) newTable.push(ext);
    }

    // If still short (not enough hosts or externals), fill with whatever guests remain
    const leftovers = [...hosts, ...externals];
    while (newTable.length < tableSize && leftovers.length > 0) {
      newTable.push(leftovers.shift()!);
    }

    return newTable;
  });
}
