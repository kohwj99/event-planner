/**
 * clusterBuilder.ts
 *
 * Builds transitive clusters of guests who must sit together using Union-Find,
 * and determines the optimal seating order within each cluster.
 *
 * For example, if rules say A+B and B+C, all three guests form one cluster [A, B, C].
 * The optimal ordering places the most-connected guest in the center position
 * so they can be adjacent to the most partners (e.g., [C, B, A] if B has 2 connections).
 *
 * Used by the sit-together optimization phase to process entire groups rather
 * than individual pairs, which avoids breaking one rule while satisfying another.
 */

import { SitTogetherRule } from '@/types/Event';
import { UnionFind } from './unionFind';

/**
 * Build sit-together clusters using Union-Find.
 * Returns groups of guest IDs that should all sit adjacent to each other.
 * Each group is keyed by its Union-Find root element.
 */
export function buildSitTogetherClusters(rules: SitTogetherRule[]): Map<string, string[]> {
  const uf = new UnionFind();

  for (const rule of rules) {
    uf.makeSet(rule.guest1Id);
    uf.makeSet(rule.guest2Id);
    uf.union(rule.guest1Id, rule.guest2Id);
  }

  return uf.getGroups();
}

/**
 * For a cluster, determine the optimal ordering for adjacent seat placement.
 * The guest with the most connections within the cluster is placed in the middle,
 * so they can be adjacent to the maximum number of partners.
 *
 * For pairs (size 2), simply sorts by the provided comparator (priority order).
 * For larger clusters, distributes guests around the center position.
 */
export function getOptimalClusterOrder(
  clusterGuestIds: string[],
  rules: SitTogetherRule[],
  guestLookup: Map<string, any>,
  comparator: (a: any, b: any) => number
): string[] {
  if (clusterGuestIds.length <= 2) {
    // For pairs, sort by priority
    return clusterGuestIds.sort((a, b) => {
      const guestA = guestLookup.get(a);
      const guestB = guestLookup.get(b);
      if (!guestA || !guestB) return 0;
      return comparator(guestA, guestB);
    });
  }

  // Count connections for each guest in cluster
  const connectionCount = new Map<string, number>();
  for (const guestId of clusterGuestIds) {
    connectionCount.set(guestId, 0);
  }

  for (const rule of rules) {
    if (clusterGuestIds.includes(rule.guest1Id) && clusterGuestIds.includes(rule.guest2Id)) {
      connectionCount.set(rule.guest1Id, (connectionCount.get(rule.guest1Id) || 0) + 1);
      connectionCount.set(rule.guest2Id, (connectionCount.get(rule.guest2Id) || 0) + 1);
    }
  }

  // Sort by connection count (most connections first - they go in middle)
  // Secondary sort by priority
  const sorted = [...clusterGuestIds].sort((a, b) => {
    const countDiff = (connectionCount.get(b) || 0) - (connectionCount.get(a) || 0);
    if (countDiff !== 0) return countDiff;

    const guestA = guestLookup.get(a);
    const guestB = guestLookup.get(b);
    if (!guestA || !guestB) return 0;
    return comparator(guestA, guestB);
  });

  // Place most-connected guests in the middle
  // For [A, B, C] where A has most connections: result is [B, A, C]
  if (sorted.length >= 3) {
    const result: string[] = [];
    const center = sorted[0]; // Most connected goes in center
    const others = sorted.slice(1);

    // Distribute others around center
    for (let i = 0; i < others.length; i++) {
      if (i % 2 === 0) {
        result.push(others[i]);
      } else {
        result.unshift(others[i]);
      }
    }

    // Insert center in the middle
    const middleIndex = Math.floor(result.length / 2);
    result.splice(middleIndex, 0, center);

    return result;
  }

  return sorted;
}
