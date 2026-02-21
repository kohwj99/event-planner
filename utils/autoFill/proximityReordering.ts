/**
 * proximityReordering.ts
 *
 * Reorders a sorted guest candidate list so that sit-together cluster members
 * are placed immediately after the highest-priority member (anchor) of their
 * cluster. This ensures that during initial placement, linked guests are
 * assigned to the same or nearby tables, avoiding costly cross-table moves
 * in the sit-together optimization phase that could demote high-priority guests.
 *
 * Only sit-together rules trigger reordering. Sit-away rules are not affected.
 * Non-cluster guests retain their original relative positions.
 */

import { SitTogetherRule } from '@/types/Event';
import { buildSitTogetherClusters } from './clusterBuilder';

/**
 * Reorder a sorted candidate list so that sit-together cluster members
 * appear immediately after the highest-priority member of their cluster.
 *
 * For example, if Guest A (rank 1) has a sit-together rule with Guest B (rank 50),
 * and the sorted list is [A, ..., B, ...], the result will be [A, B, ...].
 *
 * Handles transitive clusters: if A-B and B-C rules exist, all three are grouped
 * after whichever has the best (earliest) position in the sorted array.
 *
 * @param sortedCandidates - Pre-sorted array of guest objects (by comparator)
 * @param sitTogetherRules - Sit-together proximity rules
 * @param comparator - The same comparator used to sort the candidates
 * @returns New array with cluster members grouped after their anchor
 */
export function reorderForSitTogetherClusters(
  sortedCandidates: any[],
  sitTogetherRules: SitTogetherRule[],
  comparator: (a: any, b: any) => number
): any[] {
  if (sitTogetherRules.length === 0 || sortedCandidates.length === 0) {
    return sortedCandidates;
  }

  // Build transitive clusters using Union-Find
  const clusters = buildSitTogetherClusters(sitTogetherRules);

  // Build a set of candidate IDs and position lookup
  const positionMap = new Map<string, number>();
  sortedCandidates.forEach((g, idx) => positionMap.set(g.id, idx));

  // For each cluster, identify the anchor and the members to pull up
  const pulledUpIds = new Set<string>();
  const anchorToMembers = new Map<string, any[]>();

  for (const [, memberIds] of clusters) {
    // Filter to only members present in the candidate array
    const membersInCandidates = memberIds.filter(id => positionMap.has(id));
    if (membersInCandidates.length <= 1) continue;

    // Find anchor: the member with the earliest (best) position
    let anchorId = membersInCandidates[0];
    let anchorPos = positionMap.get(anchorId) ?? Infinity;
    for (const id of membersInCandidates) {
      const pos = positionMap.get(id) ?? Infinity;
      if (pos < anchorPos) {
        anchorId = id;
        anchorPos = pos;
      }
    }

    // Collect non-anchor members, sorted by comparator
    const nonAnchorMembers = membersInCandidates
      .filter(id => id !== anchorId)
      .map(id => sortedCandidates[positionMap.get(id)!])
      .sort(comparator);

    for (const member of nonAnchorMembers) {
      pulledUpIds.add(member.id);
    }

    anchorToMembers.set(anchorId, nonAnchorMembers);
  }

  // If no reordering is needed, return the original array
  if (pulledUpIds.size === 0) {
    return sortedCandidates;
  }

  // Build the reordered array
  const result: any[] = [];
  for (const guest of sortedCandidates) {
    // Skip pulled-up guests; they will be inserted after their anchor
    if (pulledUpIds.has(guest.id)) continue;

    result.push(guest);

    // If this guest is an anchor, insert its cluster members right after
    const members = anchorToMembers.get(guest.id);
    if (members) {
      result.push(...members);
    }
  }

  return result;
}
