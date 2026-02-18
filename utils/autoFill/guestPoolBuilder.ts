/**
 * guestPoolBuilder.ts
 *
 * Separates guest candidates into priority pools for the autofill algorithm.
 * Guests who are involved in proximity rules (sit-together or sit-away) are
 * placed first in the sorted order, ensuring they get seated before regular
 * guests. This maximizes the chance of satisfying proximity constraints, since
 * earlier-placed guests have more seat options available.
 *
 * The output is two prioritized arrays (host and external) where proximity-rule
 * guests appear before regular guests, each sub-group sorted by the comparator.
 */

import { ProximityRules } from '@/types/Event';

/**
 * Build prioritized guest pools by separating guests into those involved in
 * proximity rules (must-include) and regular guests.
 *
 * Returns:
 * - prioritizedHost: Host guests sorted with proximity-rule guests first
 * - prioritizedExternal: External guests sorted with proximity-rule guests first
 * - guestsInProximityRules: Set of guest IDs that appear in any proximity rule
 */
export function buildPrioritizedGuestPools(
  hostCandidates: any[],
  externalCandidates: any[],
  proximityRules: ProximityRules,
  comparator: (a: any, b: any) => number,
  _totalAvailableSeats: number
): { prioritizedHost: any[]; prioritizedExternal: any[]; guestsInProximityRules: Set<string> } {
  const guestsInProximityRules = new Set<string>();

  proximityRules.sitTogether.forEach(rule => {
    guestsInProximityRules.add(rule.guest1Id);
    guestsInProximityRules.add(rule.guest2Id);
  });

  proximityRules.sitAway.forEach(rule => {
    guestsInProximityRules.add(rule.guest1Id);
    guestsInProximityRules.add(rule.guest2Id);
  });

  function prioritizeGuests(candidates: any[]) {
    const mustInclude: any[] = [];
    const regular: any[] = [];

    candidates.forEach(guest => {
      if (guestsInProximityRules.has(guest.id)) {
        mustInclude.push(guest);
      } else {
        regular.push(guest);
      }
    });

    // Sort both arrays by comparator
    mustInclude.sort(comparator);
    regular.sort(comparator);

    return { mustInclude, regular };
  }

  const hostGroups = prioritizeGuests(hostCandidates);
  const externalGroups = prioritizeGuests(externalCandidates);

  const prioritizedHost: any[] = [
    ...hostGroups.mustInclude,
    ...hostGroups.regular
  ];

  const prioritizedExternal: any[] = [
    ...externalGroups.mustInclude,
    ...externalGroups.regular
  ];

  return {
    prioritizedHost,
    prioritizedExternal,
    guestsInProximityRules
  };
}
