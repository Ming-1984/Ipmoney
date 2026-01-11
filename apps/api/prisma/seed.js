/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

const prisma = new PrismaClient();

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

async function seedRegions() {
  const regionsPath = path.resolve(__dirname, 'seed-data', 'regions-cn-provinces.json');
  const regions = readJson(regionsPath);

  for (const r of regions) {
    await prisma.region.upsert({
      where: { code: r.code },
      update: {
        name: r.name,
        level: r.level,
        parentCode: r.parentCode,
        centerLat: r.centerLat,
        centerLng: r.centerLng,
      },
      create: {
        code: r.code,
        name: r.name,
        level: r.level,
        parentCode: r.parentCode,
        centerLat: r.centerLat,
        centerLng: r.centerLng,
        industryTagsJson: [],
      },
    });
  }

  console.log(`[seed] regions upserted: ${regions.length}`);
}

async function seedSystemConfigs() {
  const now = new Date().toISOString();

  const tradeRules = {
    version: 1,
    depositRate: 0.05,
    depositMinFen: 10000,
    depositMaxFen: 500000,
    depositFixedForNegotiableFen: 20000,
    autoRefundWindowMinutes: 30,
    sellerMaterialDeadlineBusinessDays: 3,
    contractSignedDeadlineBusinessDays: 10,
    transferCompletedSlaDays: 90,
    commissionRate: 0.05,
    commissionMinFen: 100000,
    commissionMaxFen: 5000000,
    payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED',
    payoutMethodDefault: 'MANUAL',
    autoPayoutOnTimeout: false,
  };

  const recommendation = {
    enabled: true,
    timeDecayHalfLifeHours: 72,
    dedupeWindowHours: 24,
    weights: { time: 1, view: 1, favorite: 2, consult: 3, region: 2, user: 1 },
    featuredBoost: { province: 2, city: 3 },
    updatedAt: now,
  };

  const entries = [
    { key: 'trade_rules', valueType: 'JSON', scope: 'GLOBAL', value: JSON.stringify(tradeRules), version: 1 },
    {
      key: 'recommendation_config',
      valueType: 'JSON',
      scope: 'GLOBAL',
      value: JSON.stringify(recommendation),
      version: 1,
    },
  ];

  for (const e of entries) {
    await prisma.systemConfig.upsert({
      where: { key: e.key },
      update: { valueType: e.valueType, scope: e.scope, value: e.value, version: e.version },
      create: { key: e.key, valueType: e.valueType, scope: e.scope, value: e.value, version: e.version },
    });
  }

  console.log(`[seed] system_configs upserted: ${entries.length}`);
}

async function seedPatentMapEntries() {
  const entries = [
    {
      regionCode: '110000',
      year: 2024,
      patentCount: 1200,
      industryBreakdown: [
        { industryTag: '新能源', count: 320 },
        { industryTag: '电池', count: 210 },
        { industryTag: '智能制造', count: 180 },
      ],
      topAssignees: [
        { assigneeName: '某新能源企业', patentCount: 120 },
        { assigneeName: '某高校技术转移中心', patentCount: 88 },
      ],
    },
    {
      regionCode: '310000',
      year: 2024,
      patentCount: 980,
      industryBreakdown: [
        { industryTag: '生物医药', count: 260 },
        { industryTag: '集成电路', count: 240 },
        { industryTag: '环保', count: 160 },
      ],
      topAssignees: [
        { assigneeName: '某医药集团', patentCount: 110 },
        { assigneeName: '某半导体公司', patentCount: 96 },
      ],
    },
    {
      regionCode: '110000',
      year: 2025,
      patentCount: 1350,
      industryBreakdown: [
        { industryTag: '新能源', count: 360 },
        { industryTag: '电池', count: 260 },
        { industryTag: '人工智能', count: 200 },
      ],
      topAssignees: [
        { assigneeName: '某新能源企业', patentCount: 140 },
        { assigneeName: '某研究院', patentCount: 92 },
      ],
    },
    {
      regionCode: '310000',
      year: 2025,
      patentCount: 1050,
      industryBreakdown: [
        { industryTag: '集成电路', count: 280 },
        { industryTag: '生物医药', count: 270 },
        { industryTag: '智能制造', count: 170 },
      ],
      topAssignees: [
        { assigneeName: '某半导体公司', patentCount: 120 },
        { assigneeName: '某高校技术转移中心', patentCount: 75 },
      ],
    },
  ];

  for (const e of entries) {
    await prisma.patentMapEntry.upsert({
      where: { regionCode_year: { regionCode: e.regionCode, year: e.year } },
      update: {
        patentCount: e.patentCount,
        industryBreakdownJson: e.industryBreakdown,
        topAssigneesJson: e.topAssignees,
      },
      create: {
        regionCode: e.regionCode,
        year: e.year,
        patentCount: e.patentCount,
        industryBreakdownJson: e.industryBreakdown,
        topAssigneesJson: e.topAssignees,
      },
    });
  }

  console.log(`[seed] patent_map_entries upserted: ${entries.length}`);
}

async function main() {
  await seedRegions();
  await seedSystemConfigs();
  await seedPatentMapEntries();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
