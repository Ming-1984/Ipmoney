export const TECH_MANAGER_BADGE_CATEGORY = {
  HONOR: 'HONOR',
  STATUS: 'STATUS',
};

export const TECH_MANAGER_BADGE_CODES = {
  TOP10_TECH_MANAGER: 'TOP10_TECH_MANAGER',
  GOLD_MANAGER: 'GOLD_MANAGER',
  BENCHMARK_MANAGER: 'BENCHMARK_MANAGER',
  EXCELLENT_TECH_MANAGER: 'EXCELLENT_TECH_MANAGER',
  CERTIFIED_MANAGER: 'CERTIFIED_MANAGER',
  SIGNED_MANAGER: 'SIGNED_MANAGER',
};

export const TECH_MANAGER_BADGE_SOURCE = {
  ADMIN_MANUAL: 'ADMIN_MANUAL',
  ADMIN_BATCH: 'ADMIN_BATCH',
  IMPORT: 'IMPORT',
  MIGRATION: 'MIGRATION',
};

export const TECH_MANAGER_BADGE_MODE = {
  REPLACE: 'REPLACE',
  APPEND: 'APPEND',
  REMOVE: 'REMOVE',
};

export const TECH_MANAGER_BADGE_DEFINITIONS = [
  {
    code: TECH_MANAGER_BADGE_CODES.TOP10_TECH_MANAGER,
    name: '十佳技术经理人',
    category: TECH_MANAGER_BADGE_CATEGORY.HONOR,
    sortOrder: 10,
    styleToken: 'gold',
  },
  {
    code: TECH_MANAGER_BADGE_CODES.GOLD_MANAGER,
    name: '金牌经理人',
    category: TECH_MANAGER_BADGE_CATEGORY.HONOR,
    sortOrder: 20,
    styleToken: 'amber',
  },
  {
    code: TECH_MANAGER_BADGE_CODES.BENCHMARK_MANAGER,
    name: '标杆技术经理人',
    category: TECH_MANAGER_BADGE_CATEGORY.HONOR,
    sortOrder: 30,
    styleToken: 'sun',
  },
  {
    code: TECH_MANAGER_BADGE_CODES.EXCELLENT_TECH_MANAGER,
    name: '卓越技术经理人',
    category: TECH_MANAGER_BADGE_CATEGORY.HONOR,
    sortOrder: 40,
    styleToken: 'ocean',
  },
  {
    code: TECH_MANAGER_BADGE_CODES.CERTIFIED_MANAGER,
    name: '认证经理人',
    category: TECH_MANAGER_BADGE_CATEGORY.STATUS,
    sortOrder: 50,
    styleToken: 'ink',
  },
  {
    code: TECH_MANAGER_BADGE_CODES.SIGNED_MANAGER,
    name: '签约经理人',
    category: TECH_MANAGER_BADGE_CATEGORY.STATUS,
    sortOrder: 60,
    styleToken: 'emerald',
  },
];

export const TECH_MANAGER_BADGE_NAME_TO_CODE = Object.freeze(
  TECH_MANAGER_BADGE_DEFINITIONS.reduce((acc, item) => {
    acc[item.name] = item.code;
    return acc;
  }, {}),
);

const TECH_MANAGER_BADGE_CODE_SET = Object.freeze(
  TECH_MANAGER_BADGE_DEFINITIONS.reduce((acc, item) => {
    acc[item.code] = true;
    return acc;
  }, {}),
);

export function isTechManagerBadgeCode(value) {
  return Boolean(TECH_MANAGER_BADGE_CODE_SET[String(value || '').trim()]);
}

export function getTechManagerBadgeDefinition(code) {
  const normalized = String(code || '').trim();
  return TECH_MANAGER_BADGE_DEFINITIONS.find((item) => item.code === normalized) || null;
}
