import {
  SortRule,
  TableRules,
  ProximityRules,
  SitTogetherRule,
  SitAwayRule,
  RandomizeOrderConfig,
  AutoFillOptions,
  RandomizePartition,
  TagSitTogetherGroup,
} from '@/types/Event';

let ruleIdCounter = 0;

function nextRuleId(): string {
  ruleIdCounter++;
  return `rule-${ruleIdCounter}`;
}

export function resetRuleIdCounter() {
  ruleIdCounter = 0;
}

export function createSortRule(overrides: Partial<SortRule> = {}): SortRule {
  return { field: 'ranking', direction: 'asc', ...overrides };
}

export function createTableRules(overrides: {
  ratioRule?: Partial<TableRules['ratioRule']>;
  spacingRule?: Partial<TableRules['spacingRule']>;
} = {}): TableRules {
  return {
    ratioRule: {
      enabled: false,
      hostRatio: 50,
      externalRatio: 50,
      ...overrides.ratioRule,
    },
    spacingRule: {
      enabled: false,
      spacing: 1,
      startWithExternal: false,
      ...overrides.spacingRule,
    },
  };
}

export function createSitTogetherRule(guest1Id: string, guest2Id: string): SitTogetherRule {
  return { id: nextRuleId(), guest1Id, guest2Id };
}

export function createSitAwayRule(guest1Id: string, guest2Id: string): SitAwayRule {
  return { id: nextRuleId(), guest1Id, guest2Id };
}

export function createProximityRules(overrides: Partial<ProximityRules> = {}): ProximityRules {
  return { sitTogether: [], sitAway: [], ...overrides };
}

export function createRandomizePartition(overrides: Partial<RandomizePartition> = {}): RandomizePartition {
  return {
    id: nextRuleId(),
    minRank: overrides.minRank ?? 1,
    maxRank: overrides.maxRank ?? 10,
  };
}

export function createRandomizeConfig(overrides: Partial<RandomizeOrderConfig> = {}): RandomizeOrderConfig {
  return {
    enabled: false,
    partitions: [],
    ...overrides,
  };
}

export function createTagSitTogetherGroup(
  tag: string,
  guestIds: string[],
  overrides: Partial<TagSitTogetherGroup> = {}
): TagSitTogetherGroup {
  return {
    id: nextRuleId(),
    tag,
    guestIds,
    ...overrides,
  };
}

export function createAutoFillOptions(overrides: Partial<AutoFillOptions> = {}): AutoFillOptions {
  return {
    includeHost: true,
    includeExternal: true,
    sortRules: [createSortRule()],
    tableRules: createTableRules(),
    proximityRules: createProximityRules(),
    randomizeOrder: createRandomizeConfig(),
    ...overrides,
  };
}
