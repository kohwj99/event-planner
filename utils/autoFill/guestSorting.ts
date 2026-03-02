/**
 * guestSorting.ts
 *
 * All guest ordering logic for the autofill algorithm:
 * - Multi-field sort comparators (by name, country, organization, ranking)
 * - Host/external tiebreak wrapping for deterministic ordering
 * - Fisher-Yates shuffle for randomization
 * - Rank-partition randomization (shuffle guests within rank ranges while
 *   preserving the overall ranking order)
 * - Applicability check for randomize order feature
 *
 * The comparators are used throughout the pipeline to maintain consistent
 * guest ordering during placement and optimization passes.
 */

import { SortField, SortRule, RandomizeOrderConfig } from '@/types/Event';
import { Guest } from '@/store/guestStore';

/**
 * Extract a field value from a guest object for sorting.
 * Handles the "organization" field alias (maps to "company").
 */
export function getGuestFieldValue(guest: Guest, field: SortField): string | number | undefined {
  if (!guest) return undefined;
  if (field === "organization") return guest.company ?? "";
  if (field === "ranking") return guest.ranking;
  if (field === "name") return guest.name;
  if (field === "country") return guest.country;
  return undefined;
}

/**
 * Create a multi-field comparator from an array of sort rules.
 * Applies rules in order (first rule is primary sort, etc.).
 * Falls back to host-first tiebreaker, then alphabetical by name.
 */
export function makeComparator(rules: SortRule[]): (a: Guest, b: Guest) => number {
  return (a: Guest, b: Guest) => {
    for (const r of rules) {
      const { field, direction } = r;
      let av = getGuestFieldValue(a, field);
      let bv = getGuestFieldValue(b, field);

      if (av === undefined || av === null) av = "";
      if (bv === undefined || bv === null) bv = "";

      if (field === "ranking") {
        const na = Number(av) || 0;
        const nb = Number(bv) || 0;
        if (na < nb) return direction === "asc" ? -1 : 1;
        if (na > nb) return direction === "asc" ? 1 : -1;
        continue;
      }

      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      if (sa < sb) return direction === "asc" ? -1 : 1;
      if (sa > sb) return direction === "asc" ? 1 : -1;
    }

    // Tiebreaker 1: Host guests come before external guests
    const aIsHost = a.fromHost === true;
    const bIsHost = b.fromHost === true;
    if (aIsHost && !bIsHost) return -1; // a is host, b is external -> a first
    if (!aIsHost && bIsHost) return 1;  // a is external, b is host -> b first

    // Tiebreaker 2: Alphabetical by name (for guests of the same type)
    const aName = String(a.name || "").toLowerCase();
    const bName = String(b.name || "").toLowerCase();
    return aName.localeCompare(bName);
  };
}

/**
 * Wrap a base comparator with an additional host-first tiebreak and ID fallback.
 * Used during initial placement when combining host and external candidate lists.
 */
export function makeComparatorWithHostTieBreak(baseComparator: (a: Guest, b: Guest) => number): (a: Guest, b: Guest) => number {
  return (a: Guest, b: Guest) => {
    const sortResult = baseComparator(a, b);
    if (sortResult !== 0) return sortResult;

    const aIsHost = a.fromHost === true;
    const bIsHost = b.fromHost === true;

    if (aIsHost && !bIsHost) return -1;
    if (!aIsHost && bIsHost) return 1;

    return String(a.id || "").localeCompare(String(b.id || ""));
  };
}

/**
 * Fisher-Yates shuffle algorithm for randomizing an array.
 * Returns a new shuffled array without modifying the original.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Apply randomization within rank partitions to a sorted guest array.
 * Each partition defines a rank range [minRank, maxRank).
 * Guests within each range are shuffled while maintaining their positions
 * relative to guests outside the range.
 */
export function applyRandomizeOrder(
  sortedGuests: Guest[],
  randomizeConfig: RandomizeOrderConfig
): Guest[] {
  if (!randomizeConfig.enabled || randomizeConfig.partitions.length === 0) {
    return sortedGuests;
  }

  const result = [...sortedGuests];

  for (const partition of randomizeConfig.partitions) {
    const { minRank, maxRank } = partition;

    const partitionIndices: number[] = [];
    const partitionGuests: Guest[] = [];

    result.forEach((guest, index) => {
      const guestRanking = Number(guest.ranking) || 0;
      if (guestRanking >= minRank && guestRanking < maxRank) {
        partitionIndices.push(index);
        partitionGuests.push(guest);
      }
    });

    if (partitionGuests.length > 1) {
      const shuffledGuests = shuffleArray(partitionGuests);

      partitionIndices.forEach((originalIndex, i) => {
        result[originalIndex] = shuffledGuests[i];
      });
    }
  }

  return result;
}

/**
 * Check if randomize order is applicable for the given sort rules.
 * Returns true only if there's exactly one sort rule and it's by ranking.
 */
export function isRandomizeOrderApplicable(sortRules: SortRule[]): boolean {
  return sortRules.length === 1 && sortRules[0].field === 'ranking';
}
