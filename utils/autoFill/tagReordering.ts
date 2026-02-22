/**
 * tagReordering.ts
 *
 * Reorders a sorted guest candidate list so that guests with identical tag sets
 * are placed consecutively. This is a soft preference for initial placement:
 * guests with the same tags end up at the same or nearby tables.
 *
 * Design principles:
 * - Pure function: no side effects, no store access.
 * - No-op when no guests have tags: returns the input array unchanged.
 * - Soft preference only: does not override sit-together/sit-away/locked constraints.
 * - Runs after sit-together cluster reordering, so hard constraints take priority.
 * - Maintains original sort order within each tag group.
 */

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
