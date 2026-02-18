/**
 * proximityRuleHelpers.ts
 *
 * Pure lookup functions for proximity rules (sit-together and sit-away).
 * Given a guest ID and a set of rules, these functions answer questions like:
 * - Should two specific guests sit together?
 * - Should two specific guests sit apart?
 * - Who are all the sit-together partners for a guest?
 * - Who are all the guests that a given guest should sit away from?
 * - Is a guest a VIP (ranking 1-4)?
 *
 * These are stateless helper functions used across multiple algorithm phases.
 */

import { SitTogetherRule, SitAwayRule } from '@/types/Event';

/**
 * Check if a sit-together rule exists for the given pair of guests.
 */
export function shouldSitTogether(guest1Id: string, guest2Id: string, rules: SitTogetherRule[]): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

/**
 * Check if a sit-away rule exists for the given pair of guests.
 */
export function shouldSitAway(guest1Id: string, guest2Id: string, rules: SitAwayRule[]): boolean {
  return rules.some(
    (rule) =>
      (rule.guest1Id === guest1Id && rule.guest2Id === guest2Id) ||
      (rule.guest1Id === guest2Id && rule.guest2Id === guest1Id)
  );
}

/**
 * Get ALL sit-together partners for a guest (not just the first one).
 * With rules A+B and A+C, returns [B, C] for guest A.
 */
export function getAllSitTogetherPartners(guestId: string, rules: SitTogetherRule[]): string[] {
  const partners: string[] = [];
  for (const rule of rules) {
    if (rule.guest1Id === guestId && !partners.includes(rule.guest2Id)) {
      partners.push(rule.guest2Id);
    }
    if (rule.guest2Id === guestId && !partners.includes(rule.guest1Id)) {
      partners.push(rule.guest1Id);
    }
  }
  return partners;
}

/**
 * @deprecated Use getAllSitTogetherPartners instead
 * Kept for backward compatibility but now returns first partner only
 */
export function getSitTogetherPartner(guestId: string, rules: SitTogetherRule[]): string | null {
  const partners = getAllSitTogetherPartners(guestId, rules);
  return partners.length > 0 ? partners[0] : null;
}

/**
 * Get all guests that a given guest should sit away from.
 */
export function getSitAwayGuests(guestId: string, rules: SitAwayRule[]): string[] {
  const awayGuests: string[] = [];
  for (const rule of rules) {
    if (rule.guest1Id === guestId) awayGuests.push(rule.guest2Id);
    if (rule.guest2Id === guestId) awayGuests.push(rule.guest1Id);
  }
  return awayGuests;
}

/**
 * Check if a guest is a VIP (ranking 1-4).
 */
export function isVIP(guest: any): boolean {
  const ranking = Number(guest?.ranking) || Infinity;
  return ranking >= 1 && ranking <= 4;
}
