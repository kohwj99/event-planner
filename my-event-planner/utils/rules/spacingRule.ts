import { Guest } from "@/store/guestStore";

interface SpacingRuleOptions {
  enabled: boolean;
  gap: number; // number of external guests between hosts
}

export function applySpacingRule(
  tables: Guest[][],
  options?: SpacingRuleOptions
): Guest[][] {
  if (!options?.enabled) return tables;

  const { gap } = options;

  return tables.map((table) => {
    const hosts = table.filter((g) => g.fromHost);
    const externals = table.filter((g) => !g.fromHost);

    if (hosts.length === 0 || externals.length === 0) return table;

    const arranged: Guest[] = [];
    let hostIndex = 0;
    let externalIndex = 0;

    while (arranged.length < table.length) {
      // Add a host if possible
      if (hostIndex < hosts.length) {
        arranged.push(hosts[hostIndex++]);
      }

      // Add gap number of externals
      for (let i = 0; i < gap && arranged.length < table.length; i++) {
        if (externalIndex < externals.length) {
          arranged.push(externals[externalIndex++]);
        }
      }

      // If externals run out, just push remaining hosts or vice versa
      if (externalIndex >= externals.length && hostIndex >= hosts.length) break;
    }

    // If leftover externals, append to end
    while (externalIndex < externals.length && arranged.length < table.length) {
      arranged.push(externals[externalIndex++]);
    }

    // If leftover hosts, append to end (best effort)
    while (hostIndex < hosts.length && arranged.length < table.length) {
      arranged.push(hosts[hostIndex++]);
    }

    return arranged;
  });
}
