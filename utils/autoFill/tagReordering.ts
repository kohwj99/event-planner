/**
 * tagReordering.ts
 *
 * Reorders a sorted guest candidate list so that guests with shared tags or
 * explicit tag group membership are placed consecutively. Two strategies:
 *
 * 1. reorderForTagSimilarity: Groups guests with identical tag sets together.
 *    Used when no explicit tag groups are defined.
 *
 * 2. reorderForTagGroups: Groups guests by explicit TagSitTogetherGroup membership.
 *    The highest-priority member (earliest in sorted order) is the anchor;
 *    remaining group members are pulled up to appear right after the anchor.
 *    Used when the user has created explicit tag groups in the AutoFill modal.
 *
 * Design principles:
 * - Pure functions: no side effects, no store access.
 * - No-op when no guests have tags / no tag groups: returns the input array unchanged.
 * - Soft preference only: does not override sit-together/sit-away/locked constraints.
 * - Runs after sit-together cluster reordering, so hard constraints take priority.
 * - Maintains original sort order within each tag group.
 */

import { TagSitTogetherGroup } from '@/types/Event';

/**
 * Build a deterministic signature from a guest's tags.
 * Tags are sorted alphabetically and joined with '|'.
 * Returns empty string for guests with no tags.
 */
export function buildTagSignature(guest: { tags?: string[] }): string {
  const tags = guest.tags;
  if (!tags || tags.length === 0) return '';
  return [...tags].sort().join('|');
}

/**
 * Reorder a sorted candidate list so that guests sharing identical tag sets
 * are placed consecutively. Follows the same anchor-pull pattern as
 * proximityReordering.ts:
 *
 * 1. Group guests by tag signature.
 * 2. For each multi-member group, the earliest guest in the sorted order is the "anchor".
 * 3. Non-anchor members are pulled out of their original positions and inserted
 *    immediately after the anchor.
 * 4. Guests with no tags and single-member groups stay in place.
 *
 * @param sortedCandidates - Pre-sorted array of guest objects
 * @param _comparator - The comparator used for sorting (reserved for future use)
 * @returns New array with tag-similar guests grouped after their anchor
 */
export function reorderForTagSimilarity(
  sortedCandidates: { id: string; tags?: string[] }[],
  _comparator: (a: any, b: any) => number
): typeof sortedCandidates {
  if (sortedCandidates.length === 0) {
    return sortedCandidates;
  }

  // Build position lookup
  const positionMap = new Map<string, number>();
  sortedCandidates.forEach((g, idx) => positionMap.set(g.id, idx));

  // Group guests by tag signature (skip guests with no tags)
  const signatureToIds = new Map<string, string[]>();
  for (const guest of sortedCandidates) {
    const sig = buildTagSignature(guest);
    if (!sig) continue; // Skip guests with no tags

    if (!signatureToIds.has(sig)) {
      signatureToIds.set(sig, []);
    }
    signatureToIds.get(sig)!.push(guest.id);
  }

  // Identify anchors and members to pull up
  const pulledUpIds = new Set<string>();
  const anchorToMembers = new Map<string, typeof sortedCandidates>();

  for (const [, memberIds] of signatureToIds) {
    if (memberIds.length <= 1) continue; // Single-member group, no reordering needed

    // Anchor = member with earliest position in sorted array
    let anchorId = memberIds[0];
    let anchorPos = positionMap.get(anchorId) ?? Infinity;
    for (const id of memberIds) {
      const pos = positionMap.get(id) ?? Infinity;
      if (pos < anchorPos) {
        anchorId = id;
        anchorPos = pos;
      }
    }

    // Non-anchor members, preserving their original relative order
    const nonAnchorMembers = memberIds
      .filter(id => id !== anchorId)
      .sort((a, b) => (positionMap.get(a) ?? 0) - (positionMap.get(b) ?? 0))
      .map(id => sortedCandidates[positionMap.get(id)!]);

    for (const member of nonAnchorMembers) {
      pulledUpIds.add(member.id);
    }

    anchorToMembers.set(anchorId, nonAnchorMembers);
  }

  // If no reordering is needed, return the original array unchanged
  if (pulledUpIds.size === 0) {
    return sortedCandidates;
  }

  // Build the reordered array
  const result: typeof sortedCandidates = [];
  for (const guest of sortedCandidates) {
    // Skip pulled-up guests; they will be inserted after their anchor
    if (pulledUpIds.has(guest.id)) continue;

    result.push(guest);

    // If this guest is an anchor, insert its group members right after
    const members = anchorToMembers.get(guest.id);
    if (members) {
      result.push(...members);
    }
  }

  return result;
}

/**
 * Reorder a sorted candidate list so that explicit tag group members
 * appear immediately after the highest-priority member (anchor) of their group.
 *
 * Unlike reorderForTagSimilarity (which groups by identical tag sets),
 * this function uses explicit TagSitTogetherGroup definitions created by the user.
 * The anchor is the group member with the earliest position in the sorted array,
 * which corresponds to the highest sort priority per the user's sorting rules.
 *
 * Follows the same anchor-pull pattern as reorderForSitTogetherClusters in
 * proximityReordering.ts:
 * 1. For each tag group, find the anchor (earliest position in sorted array).
 * 2. Pull non-anchor members out of their original positions and insert them
 *    immediately after the anchor.
 * 3. Guests not in any tag group stay in their original positions.
 *
 * Edge cases:
 * - A guest in multiple tag groups is only pulled up once (for the first group processed).
 * - If an anchor was already pulled up by a prior group, that group is skipped.
 * - Group members not present in candidates are filtered out.
 *
 * @param sortedCandidates - Pre-sorted array of guest objects
 * @param tagGroups - User-created tag-based sit-together groups
 * @param comparator - The comparator used for sorting (for ordering non-anchor members)
 * @returns New array with tag group members grouped after their anchor
 */
export function reorderForTagGroups(
  sortedCandidates: { id: string; tags?: string[] }[],
  tagGroups: TagSitTogetherGroup[],
  comparator: (a: { id: string; tags?: string[] }, b: { id: string; tags?: string[] }) => number
): typeof sortedCandidates {
  if (tagGroups.length === 0 || sortedCandidates.length === 0) {
    return sortedCandidates;
  }

  // Build position lookup
  const positionMap = new Map<string, number>();
  sortedCandidates.forEach((g, idx) => positionMap.set(g.id, idx));

  // Track which guests are pulled up (handles multi-group membership)
  const pulledUpIds = new Set<string>();
  const anchorToMembers = new Map<string, typeof sortedCandidates>();

  for (const group of tagGroups) {
    if (group.guestIds.length < 2) continue;

    // Filter to members present in the candidate array
    const membersInCandidates = group.guestIds.filter(id => positionMap.has(id));
    if (membersInCandidates.length <= 1) continue;

    // Find anchor: member with the earliest position in sorted array
    // (= highest sort priority per user's sorting rules)
    let anchorId = membersInCandidates[0];
    let anchorPos = positionMap.get(anchorId) ?? Infinity;
    for (const id of membersInCandidates) {
      const pos = positionMap.get(id) ?? Infinity;
      if (pos < anchorPos) {
        anchorId = id;
        anchorPos = pos;
      }
    }

    // Skip if anchor was already pulled up by a previous group
    if (pulledUpIds.has(anchorId)) continue;

    // Non-anchor members, sorted by comparator, excluding already-pulled guests
    const nonAnchorMembers = membersInCandidates
      .filter(id => id !== anchorId && !pulledUpIds.has(id))
      .map(id => sortedCandidates[positionMap.get(id)!])
      .sort(comparator);

    if (nonAnchorMembers.length === 0) continue;

    for (const member of nonAnchorMembers) {
      pulledUpIds.add(member.id);
    }

    // Append to existing members if anchor already has members from another group
    const existing = anchorToMembers.get(anchorId) ?? [];
    anchorToMembers.set(anchorId, [...existing, ...nonAnchorMembers]);
  }

  // If no reordering is needed, return the original array unchanged
  if (pulledUpIds.size === 0) {
    return sortedCandidates;
  }

  // Build the reordered array
  const result: typeof sortedCandidates = [];
  for (const guest of sortedCandidates) {
    // Skip pulled-up guests; they will be inserted after their anchor
    if (pulledUpIds.has(guest.id)) continue;

    result.push(guest);

    // If this guest is an anchor, insert its group members right after
    const members = anchorToMembers.get(guest.id);
    if (members) {
      result.push(...members);
    }
  }

  return result;
}
