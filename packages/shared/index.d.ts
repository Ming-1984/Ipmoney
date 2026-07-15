export declare const TECH_MANAGER_BADGE_CATEGORY: {
  readonly HONOR: 'HONOR';
  readonly STATUS: 'STATUS';
};

export declare const TECH_MANAGER_BADGE_CODES: {
  readonly TOP10_TECH_MANAGER: 'TOP10_TECH_MANAGER';
  readonly GOLD_MANAGER: 'GOLD_MANAGER';
  readonly BENCHMARK_MANAGER: 'BENCHMARK_MANAGER';
  readonly EXCELLENT_TECH_MANAGER: 'EXCELLENT_TECH_MANAGER';
  readonly CERTIFIED_MANAGER: 'CERTIFIED_MANAGER';
  readonly SIGNED_MANAGER: 'SIGNED_MANAGER';
};

export declare const TECH_MANAGER_BADGE_SOURCE: {
  readonly ADMIN_MANUAL: 'ADMIN_MANUAL';
  readonly ADMIN_BATCH: 'ADMIN_BATCH';
  readonly IMPORT: 'IMPORT';
  readonly MIGRATION: 'MIGRATION';
};

export declare const TECH_MANAGER_BADGE_MODE: {
  readonly REPLACE: 'REPLACE';
  readonly APPEND: 'APPEND';
  readonly REMOVE: 'REMOVE';
};

export type TechManagerBadgeCategory =
  (typeof TECH_MANAGER_BADGE_CATEGORY)[keyof typeof TECH_MANAGER_BADGE_CATEGORY];
export type TechManagerBadgeCode = (typeof TECH_MANAGER_BADGE_CODES)[keyof typeof TECH_MANAGER_BADGE_CODES];
export type TechManagerBadgeSource =
  (typeof TECH_MANAGER_BADGE_SOURCE)[keyof typeof TECH_MANAGER_BADGE_SOURCE];
export type TechManagerBadgeMode = (typeof TECH_MANAGER_BADGE_MODE)[keyof typeof TECH_MANAGER_BADGE_MODE];

export type TechManagerBadgeDefinition = {
  code: TechManagerBadgeCode;
  name: string;
  category: TechManagerBadgeCategory;
  sortOrder: number;
  styleToken: string;
};

export declare const TECH_MANAGER_BADGE_DEFINITIONS: ReadonlyArray<TechManagerBadgeDefinition>;
export declare const TECH_MANAGER_BADGE_NAME_TO_CODE: Readonly<Record<string, TechManagerBadgeCode>>;

export declare function isTechManagerBadgeCode(value: unknown): value is TechManagerBadgeCode;
export declare function getTechManagerBadgeDefinition(code: unknown): TechManagerBadgeDefinition | null;
