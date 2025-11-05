import { Guest } from "@/store/guestStore";
import { applyRatioRule } from "./ratioRule";
import { applySpacingRule } from "./spacingRule";

export interface RuleEngineOptions {
  ratioRule?: { enabled: boolean; hostPercentage: number };
  spacingRule?: { enabled: boolean; gap: number };
}

export function applyAutoFillRules(
  tables: Guest[][],
  hosts: Guest[],
  externals: Guest[],
  options?: RuleEngineOptions
) {
  let updatedTables = [...tables];

  // Order matters based on:
  // Priority: P1 (Ratio → then Spacing)
  updatedTables = applyRatioRule(updatedTables, hosts, externals, options?.ratioRule);
  updatedTables = applySpacingRule(updatedTables, options?.spacingRule);

  return updatedTables;
}
