import { Guest } from "@/store/guestStore";

/**
 * Adjust guests per table to respect host:external ratio.
 * Best-effort: if not enough hosts/externals, fill with remaining guests.
 */
export function applyHostRatioRule(tables: Guest[][], ratio: number) {
  return tables.map((table) => {
    if (table.length === 0) return table;

    const hosts = table.filter((g) => g.fromHost);
    const externals = table.filter((g) => !g.fromHost);

    const totalSeats = table.length;
    const hostTarget = Math.round(totalSeats * ratio);

    const finalHosts = hosts.slice(0, hostTarget);
    const finalExternals = externals.slice(0, totalSeats - hostTarget);

    const remaining = table.filter(
      (g) => !finalHosts.includes(g) && !finalExternals.includes(g)
    );

    return [...finalHosts, ...finalExternals, ...remaining];
  });
}
