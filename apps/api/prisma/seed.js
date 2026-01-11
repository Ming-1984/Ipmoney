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

async function main() {
  await seedRegions();
  await seedSystemConfigs();
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

