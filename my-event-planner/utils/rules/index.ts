import { Guest } from "@/store/guestStore";
import { applyHostRatioRule } from "./hostRatioRule";
import { applySpacingRule } from "./spacingRule";

export interface AutoFillRulesOptions {
  ratioRule?: { enabled: boolean; ratio: number };
  spacingRule?: { enabled: boolean; gap: number };
}

/**
 * Apply table-level rules in order: ratio → spacing
 */
export function applyAutoFillRules(
  tables: Guest[][],
  options?: AutoFillRulesOptions
): Guest[][] {
  let updated = tables;

  if (options?.ratioRule?.enabled && typeof options.ratioRule.ratio === "number") {
    updated = applyHostRatioRule(updated, options.ratioRule.ratio);
  }

  if (options?.spacingRule?.enabled && typeof options.spacingRule.gap === "number") {
    updated = applySpacingRule(updated, options.spacingRule.gap);
  }

  return updated;
}


// import { Guest } from "@/store/guestStore";
// import { applyRatioRule } from "./ratioRule";
// import { applySpacingRule } from "./spacingRule";

// export interface RuleEngineOptions {
//   ratioRule?: { enabled: boolean; hostPercentage: number };
//   spacingRule?: { enabled: boolean; gap: number };
// }

// export function applyAutoFillRules(
//   tables: Guest[][],
//   hosts: Guest[],
//   externals: Guest[],
//   options?: RuleEngineOptions
// ) {
//   let updated = [...tables];
//   const clonedHosts = [...hosts];
//   const clonedExternals = [...externals];

//   updated = applyRatioRule(updated, clonedHosts, clonedExternals, options?.ratioRule);
//   updated = applySpacingRule(updated, options?.spacingRule);

//   return updated;
// }
