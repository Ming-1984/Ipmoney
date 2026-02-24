/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

const prisma = new PrismaClient();

const NODE_ENV = String(process.env.NODE_ENV || '').trim().toLowerCase();
const SEED_BASE_DATA = String(process.env.SEED_BASE_DATA || '').trim().toLowerCase() !== 'false';
const SEED_DEMO_DATA = String(process.env.SEED_DEMO_DATA || '').trim().toLowerCase() === 'true';
const PURGE_DEMO_MAP = String(process.env.SEED_DEMO_PURGE_MAP || '').trim().toLowerCase() === 'true';

if (NODE_ENV === 'production' && SEED_DEMO_DATA) {
  throw new Error('SEED_DEMO_DATA must be false in production.');
}
const DEFAULT_DEMO_USER_ID = '8c592d03-c1c1-40be-8d62-64ce71ac7606';
const DEFAULT_DEMO_ADMIN_ID = '804b7a04-aafe-409a-bee4-e84f953cb4c0';
const DEMO_USER_ID = String(process.env.DEMO_USER_ID || DEFAULT_DEMO_USER_ID).trim() || DEFAULT_DEMO_USER_ID;
const DEMO_ADMIN_ID = String(process.env.DEMO_ADMIN_ID || DEFAULT_DEMO_ADMIN_ID).trim() || DEFAULT_DEMO_ADMIN_ID;
const DEMO_USER_NICKNAME =
  String(process.env.DEMO_USER_NICKNAME || '').trim() || '演示用户';
const DEMO_ADMIN_NICKNAME =
  String(process.env.DEMO_ADMIN_NICKNAME || '').trim() || '平台管理员';

const SEED_SELLER_ID = String(process.env.SEED_SELLER_ID || '').trim() || '20c2466b-2ba2-44c1-8357-55bf2585fc88';
const SEED_ORG_USER_ID = String(process.env.SEED_ORG_USER_ID || '').trim() || '982bb394-283b-418d-aec4-9e69568576b3';
const SEED_TECH_MANAGER_ID =
  String(process.env.SEED_TECH_MANAGER_ID || '').trim() || 'a864e458-2127-4f86-a2ee-e2cc9c7755e7';
const SEED_CS_USER_ID = String(process.env.SEED_CS_USER_ID || '').trim() || '191ec3cd-49e2-4881-98a0-63c4cbae6cd6';

const SEED_LISTING_ID_1 = 'd562cea2-5502-4553-9cf1-869ee2c760fd';
const SEED_LISTING_ID_2 = '485dbf32-dd26-4f62-a498-88f21f9d8cab';
const SEED_LISTING_ID_3 = '90c5843b-be62-4378-b242-caf4be4e9bd9';

const SEED_PATENT_ID_1 = '6e0511e4-5d32-4794-99f6-408d0941a754';
const SEED_PATENT_ID_2 = '28a2ae7c-9021-46a3-a75b-2a37dd06aa66';
const SEED_PATENT_ID_3 = '61cac934-7d84-45a4-80e5-c9c9acb35b18';

const SEED_DEMAND_ID_1 = '5f772bf1-c477-4b86-abcc-e9e273b8f6ff';
const SEED_DEMAND_ID_2 = 'e6d8cc6c-0a3e-46c7-9900-ef23fc040b11';

const SEED_ACHIEVEMENT_ID_1 = 'c0b1c093-6bf4-4296-9e04-62e874acd2fc';
const SEED_ACHIEVEMENT_ID_2 = 'ca2a49f0-88a4-4db7-9cc4-3fbaf5e5c4dc';

const SEED_ARTWORK_ID_1 = '2f515e73-3d9b-4e68-b381-b7229490b6cd';
const SEED_ARTWORK_ID_2 = 'dea00737-56b0-4361-a64b-a9562f856b27';

const SEED_ORDER_ID_1 = '5e238163-ad1e-4830-a74d-944959427ebe';
const SEED_PAYMENT_ID_1 = '28b74a0d-40c2-4af8-87b5-60d1390e46fd';

const SEED_CONVERSATION_ID_1 = 'ae127712-cb2f-4526-8520-0dc45528ab8a';
const SEED_MESSAGE_ID_1 = '15a7e31a-a785-4bac-9fda-443c47a0bfc3';
const SEED_MESSAGE_ID_2 = 'a43e77a9-791b-4f0b-90f8-576dcd8f0ab7';

const SEED_ORG_VERIFICATION_ID = '1bdebc8e-c3b8-42f5-8044-285cff931773';
const SEED_TECH_VERIFICATION_ID = '0a799698-9e0d-447c-a8fb-42479f485c26';
const SEED_PERSON_VERIFICATION_ID = 'e5f0b2c5-780e-4e74-acd0-57062b6b3412';

const SEED_FILE_LISTING_1 = 'c70ff054-ec17-4262-b9a1-56ece2a9ec5a';
const SEED_FILE_LISTING_2 = '3289ec88-661a-4db8-ad1d-50c456e611d2';
const SEED_FILE_LISTING_3 = '8bb620c6-5539-4b53-bc25-ecbd82f71ea0';
const SEED_FILE_DEMAND_1 = 'a8e4f3d1-13b5-49bf-8841-cd1a459b2cc8';
const SEED_FILE_DEMAND_2 = '080fd2e3-ca59-4a11-8581-3f6592c0e7c2';
const SEED_FILE_ACHIEVEMENT_1 = '026760c6-638d-4cc7-940c-1f8b45b65b04';
const SEED_FILE_ACHIEVEMENT_2 = '0a789d3c-ff8b-4c63-817f-76f24ffa77e6';
const SEED_FILE_ARTWORK_1 = '12b19b1d-598c-4b94-823c-8902a95512e7';
const SEED_FILE_ARTWORK_2 = '497acb00-6fe8-43ca-9611-fb1616a81267';
const SEED_FILE_ORG_LOGO = '10d0030b-ab22-4fb7-bc37-b53a56e3f6a6';

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

  if (!SEED_DEMO_DATA) {
    if (PURGE_DEMO_MAP) {
      await prisma.patentMapEntry.deleteMany({
        where: {
          OR: entries.map((e) => ({ regionCode: e.regionCode, year: e.year })),
        },
      });
      console.log(`[seed] patent_map_entries demo data purged: ${entries.length}`);
    } else {
      console.log('[seed] demo data disabled; skipping patent_map_entries');
    }
    return;
  }

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

async function seedUsers() {
  const users = [
    {
      id: DEMO_USER_ID,
      phone: '13800138000',
      role: 'buyer',
      nickname: DEMO_USER_NICKNAME,
      regionCode: '110000',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&w=256&q=80',
    },
    {
      id: DEMO_ADMIN_ID,
      phone: '13900000000',
      role: 'admin',
      nickname: DEMO_ADMIN_NICKNAME,
      regionCode: '110000',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=facearea&w=256&q=80',
    },
    {
      id: SEED_SELLER_ID,
      phone: '13700001111',
      role: 'seller',
      nickname: '李昊',
      regionCode: '310000',
      avatarUrl: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=256&q=80',
    },
    {
      id: SEED_ORG_USER_ID,
      phone: '13600002222',
      role: 'seller',
      nickname: '海川创新',
      regionCode: '310000',
      avatarUrl: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=facearea&w=256&q=80',
    },
    {
      id: SEED_TECH_MANAGER_ID,
      phone: '13500003333',
      role: 'seller',
      nickname: '周启明',
      regionCode: '330000',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&w=256&q=80',
    },
    {
      id: SEED_CS_USER_ID,
      phone: '13400004444',
      role: 'cs',
      nickname: '客服小薇',
      regionCode: '110000',
      avatarUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=facearea&w=256&q=80',
    },
  ];

  if (!SEED_DEMO_DATA) {
    try {
      await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
      console.log(`[seed] demo users purged: ${users.length}`);
    } catch (err) {
      console.warn('[seed] demo users purge skipped (dependent data exists).');
    }
    return;
  }

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        phone: u.phone,
        role: u.role,
        nickname: u.nickname,
        regionCode: u.regionCode,
        avatarUrl: u.avatarUrl,
      },
      create: u,
    });
  }

  console.log(`[seed] users upserted: ${users.length}`);
}

async function seedFiles() {
  if (!SEED_DEMO_DATA) return;

  const files = [
    {
      id: SEED_FILE_LISTING_1,
      url: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
      fileName: 'listing-battery-thermal.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 182000,
      ownerScope: 'LISTING',
      ownerId: SEED_LISTING_ID_1,
    },
    {
      id: SEED_FILE_LISTING_2,
      url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
      fileName: 'listing-coating-process.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 176000,
      ownerScope: 'LISTING',
      ownerId: SEED_LISTING_ID_2,
    },
    {
      id: SEED_FILE_LISTING_3,
      url: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
      fileName: 'listing-robotics-cleaning.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 168000,
      ownerScope: 'LISTING',
      ownerId: SEED_LISTING_ID_3,
    },
    {
      id: SEED_FILE_DEMAND_1,
      url: 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?auto=format&fit=crop&w=1200&q=80',
      fileName: 'demand-energy-storage.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 156000,
      ownerScope: 'DEMAND',
      ownerId: SEED_DEMAND_ID_1,
    },
    {
      id: SEED_FILE_DEMAND_2,
      url: 'https://images.unsplash.com/photo-1474631245212-32dc3c8310c6?auto=format&fit=crop&w=1200&q=80',
      fileName: 'demand-lab-coop.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 149000,
      ownerScope: 'DEMAND',
      ownerId: SEED_DEMAND_ID_2,
    },
    {
      id: SEED_FILE_ACHIEVEMENT_1,
      url: 'https://images.unsplash.com/photo-1508921912186-1d1a45ebb3c1?auto=format&fit=crop&w=1200&q=80',
      fileName: 'achievement-sodium-ion.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 163000,
      ownerScope: 'ACHIEVEMENT',
      ownerId: SEED_ACHIEVEMENT_ID_1,
    },
    {
      id: SEED_FILE_ACHIEVEMENT_2,
      url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
      fileName: 'achievement-sensor-array.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 171000,
      ownerScope: 'ACHIEVEMENT',
      ownerId: SEED_ACHIEVEMENT_ID_2,
    },
    {
      id: SEED_FILE_ARTWORK_1,
      url: 'https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?auto=format&fit=crop&w=1200&q=80',
      fileName: 'artwork-landscape.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 142000,
      ownerScope: 'ARTWORK',
      ownerId: SEED_ARTWORK_ID_1,
    },
    {
      id: SEED_FILE_ARTWORK_2,
      url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
      fileName: 'artwork-calligraphy.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 139000,
      ownerScope: 'ARTWORK',
      ownerId: SEED_ARTWORK_ID_2,
    },
    {
      id: SEED_FILE_ORG_LOGO,
      url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=600&q=80',
      fileName: 'org-logo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 42000,
      ownerScope: 'USER_VERIFICATION',
      ownerId: SEED_ORG_USER_ID,
    },
  ];

  for (const f of files) {
    await prisma.file.upsert({
      where: { id: f.id },
      update: {
        url: f.url,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        ownerScope: f.ownerScope,
        ownerId: f.ownerId,
      },
      create: f,
    });
  }

  console.log(`[seed] files upserted: ${files.length}`);
}

async function seedOrganizations() {
  if (!SEED_DEMO_DATA) return;

  const org = {
    id: SEED_ORG_VERIFICATION_ID,
    userId: SEED_ORG_USER_ID,
    verificationType: 'COMPANY',
    verificationStatus: 'APPROVED',
    displayName: '海川创新科技（上海）有限公司',
    contactName: '王婷',
    contactPhone: '021-55550001',
    regionCode: '310000',
    intro: '聚焦新能源与储能系统成果转化，服务车企与电站客户。',
    logoFileId: SEED_FILE_ORG_LOGO,
    evidenceFileIdsJson: [],
    submittedAt: new Date('2025-01-05T00:00:00Z'),
    reviewedAt: new Date('2025-01-12T00:00:00Z'),
    reviewedById: DEMO_ADMIN_ID,
  };

  await prisma.userVerification.upsert({
    where: { id: org.id },
    update: {
      verificationType: org.verificationType,
      verificationStatus: org.verificationStatus,
      displayName: org.displayName,
      contactName: org.contactName,
      contactPhone: org.contactPhone,
      regionCode: org.regionCode,
      intro: org.intro,
      logoFileId: org.logoFileId,
      evidenceFileIdsJson: org.evidenceFileIdsJson,
      submittedAt: org.submittedAt,
      reviewedAt: org.reviewedAt,
      reviewedById: org.reviewedById,
    },
    create: org,
  });

  console.log('[seed] organizations upserted: 1');
}

async function seedTechManagers() {
  if (!SEED_DEMO_DATA) return;

  const verification = {
    id: SEED_TECH_VERIFICATION_ID,
    userId: SEED_TECH_MANAGER_ID,
    verificationType: 'TECH_MANAGER',
    verificationStatus: 'APPROVED',
    displayName: '周启明',
    regionCode: '330000',
    intro: '10年技术转移与投融资对接经验，擅长新能源与先进制造成果转化。',
    evidenceFileIdsJson: [],
    submittedAt: new Date('2025-02-08T00:00:00Z'),
    reviewedAt: new Date('2025-02-15T00:00:00Z'),
    reviewedById: DEMO_ADMIN_ID,
  };

  await prisma.userVerification.upsert({
    where: { id: verification.id },
    update: {
      verificationType: verification.verificationType,
      verificationStatus: verification.verificationStatus,
      displayName: verification.displayName,
      regionCode: verification.regionCode,
      intro: verification.intro,
      evidenceFileIdsJson: verification.evidenceFileIdsJson,
      submittedAt: verification.submittedAt,
      reviewedAt: verification.reviewedAt,
      reviewedById: verification.reviewedById,
    },
    create: verification,
  });

  const profile = {
    userId: SEED_TECH_MANAGER_ID,
    intro: '聚焦新能源与先进制造，提供技术评估与交易撮合服务。',
    serviceTagsJson: ['技术评估', '估值辅导', '交易撮合', '尽调协助'],
    featuredRank: 1,
    featuredUntil: new Date('2026-12-31T00:00:00Z'),
    consultCount: 128,
    dealCount: 12,
    ratingScore: 4.8,
    ratingCount: 26,
  };

  await prisma.techManagerProfile.upsert({
    where: { userId: profile.userId },
    update: {
      intro: profile.intro,
      serviceTagsJson: profile.serviceTagsJson,
      featuredRank: profile.featuredRank,
      featuredUntil: profile.featuredUntil,
      consultCount: profile.consultCount,
      dealCount: profile.dealCount,
      ratingScore: profile.ratingScore,
      ratingCount: profile.ratingCount,
    },
    create: profile,
  });

  console.log('[seed] tech managers upserted: 1');
}

async function seedPersonalVerification() {
  if (!SEED_DEMO_DATA) return;

  const record = {
    id: SEED_PERSON_VERIFICATION_ID,
    userId: DEMO_USER_ID,
    verificationType: 'PERSON',
    verificationStatus: 'APPROVED',
    displayName: DEMO_USER_NICKNAME,
    contactName: DEMO_USER_NICKNAME,
    contactPhone: '13800138000',
    regionCode: '110000',
    intro: '演示账号个人认证，用于本地测试与功能验证。',
    evidenceFileIdsJson: [],
    submittedAt: new Date('2026-02-01T00:00:00Z'),
    reviewedAt: new Date('2026-02-01T00:00:00Z'),
    reviewedById: DEMO_ADMIN_ID,
  };

  await prisma.userVerification.upsert({
    where: { id: record.id },
    update: {
      verificationType: record.verificationType,
      verificationStatus: record.verificationStatus,
      displayName: record.displayName,
      contactName: record.contactName,
      contactPhone: record.contactPhone,
      regionCode: record.regionCode,
      intro: record.intro,
      evidenceFileIdsJson: record.evidenceFileIdsJson,
      submittedAt: record.submittedAt,
      reviewedAt: record.reviewedAt,
      reviewedById: record.reviewedById,
    },
    create: record,
  });

  console.log('[seed] personal verification upserted: 1');
}

async function seedPatents() {
  if (!SEED_DEMO_DATA) return;

  const patents = [
    {
      id: SEED_PATENT_ID_1,
      applicationNoNorm: '2024101234567',
      applicationNoDisplay: '202410123456.7',
      patentType: 'INVENTION',
      title: '高安全性电池包液冷热管理系统',
      abstract: '一种用于动力电池包的液冷热管理系统，结合预测模型与自适应控制，提升高倍率工况下的温度一致性。',
      filingDate: new Date('2024-03-12'),
      publicationDate: new Date('2024-09-20'),
      grantDate: new Date('2025-01-15'),
      legalStatus: 'GRANTED',
      legalStatusRaw: '授权',
      sourcePrimary: 'USER',
      parties: {
        applicants: ['海川创新科技（上海）有限公司'],
        inventors: ['李昊', '周启明'],
        assignees: ['海川创新科技（上海）有限公司'],
      },
      classifications: ['H01M 10/0525', 'H01M 10/0566'],
    },
    {
      id: SEED_PATENT_ID_2,
      applicationNoNorm: '2024202345678',
      applicationNoDisplay: '202420234567.8',
      patentType: 'UTILITY_MODEL',
      title: '均匀涂覆的辊涂装置',
      abstract: '一种用于功能涂层生产的辊涂装置，通过张力闭环与间隙微调提高涂覆均匀性。',
      filingDate: new Date('2024-05-18'),
      publicationDate: new Date('2024-11-02'),
      legalStatus: 'PENDING',
      legalStatusRaw: '实审中',
      sourcePrimary: 'USER',
      parties: {
        applicants: ['北京启航材料技术有限公司'],
        inventors: ['王珊', '张凯'],
        assignees: ['北京启航材料技术有限公司'],
      },
      classifications: ['H01M 10/04', 'B05C 11/10'],
    },
    {
      id: SEED_PATENT_ID_3,
      applicationNoNorm: '2024303456789',
      applicationNoDisplay: '202430345678.9',
      patentType: 'INVENTION',
      title: '光伏组件清洗机器人路径规划方法',
      abstract: '面向分布式光伏电站的清洗机器人路径规划方法，结合视觉定位与障碍避让提高覆盖率。',
      filingDate: new Date('2024-08-05'),
      publicationDate: new Date('2025-01-20'),
      legalStatus: 'PENDING',
      legalStatusRaw: '实审中',
      sourcePrimary: 'USER',
      parties: {
        applicants: ['京北智造研究院'],
        inventors: ['陈奕', '刘宇'],
        assignees: ['京北智造研究院'],
      },
      classifications: ['H02S 40/10', 'G05D 1/02'],
    },
  ];

  for (const p of patents) {
    await prisma.patent.upsert({
      where: { id: p.id },
      update: {
        applicationNoNorm: p.applicationNoNorm,
        applicationNoDisplay: p.applicationNoDisplay,
        patentType: p.patentType,
        title: p.title,
        abstract: p.abstract,
        filingDate: p.filingDate,
        publicationDate: p.publicationDate,
        grantDate: p.grantDate ?? null,
        legalStatus: p.legalStatus,
        legalStatusRaw: p.legalStatusRaw,
        sourcePrimary: p.sourcePrimary,
      },
      create: {
        id: p.id,
        jurisdiction: 'CN',
        applicationNoNorm: p.applicationNoNorm,
        applicationNoDisplay: p.applicationNoDisplay,
        patentType: p.patentType,
        title: p.title,
        abstract: p.abstract,
        filingDate: p.filingDate,
        publicationDate: p.publicationDate,
        grantDate: p.grantDate ?? null,
        legalStatus: p.legalStatus,
        legalStatusRaw: p.legalStatusRaw,
        sourcePrimary: p.sourcePrimary,
      },
    });

    await prisma.patentIdentifier.deleteMany({ where: { patentId: p.id } });
    await prisma.patentIdentifier.createMany({
      data: [
        {
          patentId: p.id,
          idType: 'APPLICATION',
          idValueNorm: p.applicationNoNorm,
          kindCode: null,
          dateRef: p.filingDate,
        },
      ],
    });

    await prisma.patentClassification.deleteMany({ where: { patentId: p.id } });
    await prisma.patentClassification.createMany({
      data: p.classifications.map((code, idx) => ({
        patentId: p.id,
        system: 'IPC',
        code,
        isMain: idx === 0,
      })),
    });

    await prisma.patentParty.deleteMany({ where: { patentId: p.id } });
    const partyRows = [];
    for (const name of p.parties.applicants) partyRows.push({ patentId: p.id, role: 'APPLICANT', name });
    for (const name of p.parties.inventors) partyRows.push({ patentId: p.id, role: 'INVENTOR', name });
    for (const name of p.parties.assignees) partyRows.push({ patentId: p.id, role: 'ASSIGNEE', name });
    if (partyRows.length) {
      await prisma.patentParty.createMany({ data: partyRows });
    }
  }

  console.log(`[seed] patents upserted: ${patents.length}`);
}

async function seedListings() {
  if (!SEED_DEMO_DATA) return;

  const listings = [
    {
      id: SEED_LISTING_ID_1,
      sellerUserId: SEED_ORG_USER_ID,
      patentId: SEED_PATENT_ID_1,
      title: '高安全电池包液冷热管理专利独占许可',
      summary: '锂电池热管理 + 安全冗余设计，适配乘用车与储能',
      tradeMode: 'LICENSE',
      licenseMode: 'EXCLUSIVE',
      priceType: 'FIXED',
      priceAmount: 4800000,
      depositAmount: 200000,
      deliverablesJson: ['专利许可协议', '技术交底资料', '实施支持方案'],
      expectedCompletionDays: 60,
      negotiableNote: '许可期限与地域可协商，支持联合开发',
      pledgeStatus: 'NONE',
      existingLicenseStatus: 'NONE',
      regionCode: '310000',
      industryTagsJson: ['新能源', '储能', '汽车'],
      listingTopicsJson: ['高价值', '可落地'],
      featuredLevel: 'PROVINCE',
      featuredRegionCode: '310000',
      featuredRank: 1,
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      mediaFileIds: [SEED_FILE_LISTING_1],
      stats: { viewCount: 320, favoriteCount: 18, consultCount: 6 },
    },
    {
      id: SEED_LISTING_ID_2,
      sellerUserId: SEED_SELLER_ID,
      patentId: SEED_PATENT_ID_2,
      title: '均匀涂覆辊涂装置专利转让',
      summary: '面向涂覆产线，提升良率与一致性',
      tradeMode: 'ASSIGNMENT',
      priceType: 'NEGOTIABLE',
      priceAmount: null,
      depositAmount: 50000,
      deliverablesJson: ['专利转让协议', '工艺图纸', '落地指导'],
      expectedCompletionDays: 90,
      negotiableRangeFen: 3000000,
      negotiableNote: '支持分阶段付款与交割',
      pledgeStatus: 'NONE',
      existingLicenseStatus: 'NONE',
      regionCode: '110000',
      industryTagsJson: ['智能制造', '新材料', '装备'],
      listingTopicsJson: ['可转让', '可量产'],
      featuredLevel: 'CITY',
      featuredRegionCode: '110000',
      featuredRank: 2,
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      mediaFileIds: [SEED_FILE_LISTING_2],
      stats: { viewCount: 210, favoriteCount: 11, consultCount: 4 },
    },
    {
      id: SEED_LISTING_ID_3,
      sellerUserId: DEMO_USER_ID,
      patentId: SEED_PATENT_ID_3,
      title: '光伏清洗机器人路径规划专利转让',
      summary: '适用于分布式电站，降低运维成本',
      tradeMode: 'ASSIGNMENT',
      priceType: 'FIXED',
      priceAmount: 2600000,
      depositAmount: 50000,
      deliverablesJson: ['专利转让协议', '算法说明文档', '对接支持'],
      expectedCompletionDays: 45,
      negotiableNote: '可提供试运行辅导',
      pledgeStatus: 'NONE',
      existingLicenseStatus: 'NONE',
      regionCode: '110000',
      industryTagsJson: ['新能源', '机器人', '运维'],
      listingTopicsJson: ['节能降本', '成熟项目'],
      featuredLevel: 'NONE',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      mediaFileIds: [SEED_FILE_LISTING_3],
      stats: { viewCount: 156, favoriteCount: 7, consultCount: 3 },
    },
  ];

  for (const l of listings) {
    await prisma.listing.upsert({
      where: { id: l.id },
      update: {
        sellerUserId: l.sellerUserId,
        patentId: l.patentId,
        title: l.title,
        summary: l.summary,
        tradeMode: l.tradeMode,
        licenseMode: l.licenseMode ?? null,
        priceType: l.priceType,
        priceAmount: l.priceAmount,
        depositAmount: l.depositAmount,
        deliverablesJson: l.deliverablesJson,
        expectedCompletionDays: l.expectedCompletionDays,
        negotiableRangeFen: l.negotiableRangeFen ?? null,
        negotiableNote: l.negotiableNote ?? null,
        pledgeStatus: l.pledgeStatus ?? null,
        existingLicenseStatus: l.existingLicenseStatus ?? null,
        regionCode: l.regionCode,
        industryTagsJson: l.industryTagsJson,
        listingTopicsJson: l.listingTopicsJson,
        featuredLevel: l.featuredLevel,
        featuredRegionCode: l.featuredRegionCode ?? null,
        featuredRank: l.featuredRank ?? null,
        auditStatus: l.auditStatus,
        status: l.status,
      },
      create: {
        id: l.id,
        sellerUserId: l.sellerUserId,
        source: 'USER',
        patentId: l.patentId,
        title: l.title,
        summary: l.summary,
        tradeMode: l.tradeMode,
        licenseMode: l.licenseMode ?? null,
        priceType: l.priceType,
        priceAmount: l.priceAmount,
        depositAmount: l.depositAmount,
        deliverablesJson: l.deliverablesJson,
        expectedCompletionDays: l.expectedCompletionDays,
        negotiableRangeFen: l.negotiableRangeFen ?? null,
        negotiableNote: l.negotiableNote ?? null,
        pledgeStatus: l.pledgeStatus ?? null,
        existingLicenseStatus: l.existingLicenseStatus ?? null,
        regionCode: l.regionCode,
        industryTagsJson: l.industryTagsJson,
        listingTopicsJson: l.listingTopicsJson,
        featuredLevel: l.featuredLevel,
        featuredRegionCode: l.featuredRegionCode ?? null,
        featuredRank: l.featuredRank ?? null,
        auditStatus: l.auditStatus,
        status: l.status,
      },
    });

    await prisma.listingStats.upsert({
      where: { listingId: l.id },
      update: {
        viewCount: l.stats.viewCount,
        favoriteCount: l.stats.favoriteCount,
        consultCount: l.stats.consultCount,
      },
      create: {
        listingId: l.id,
        viewCount: l.stats.viewCount,
        favoriteCount: l.stats.favoriteCount,
        consultCount: l.stats.consultCount,
      },
    });

    await prisma.listingMedia.deleteMany({ where: { listingId: l.id } });
    if (l.mediaFileIds?.length) {
      await prisma.listingMedia.createMany({
        data: l.mediaFileIds.map((fileId, idx) => ({
          listingId: l.id,
          fileId,
          type: 'IMAGE',
          sort: idx,
        })),
      });
    }
  }

  console.log(`[seed] listings upserted: ${listings.length}`);
}

async function seedFavorites() {
  if (!SEED_DEMO_DATA) return;

  await prisma.listingFavorite.upsert({
    where: { listingId_userId: { listingId: SEED_LISTING_ID_1, userId: DEMO_USER_ID } },
    update: {},
    create: { listingId: SEED_LISTING_ID_1, userId: DEMO_USER_ID },
  });
  await prisma.demandFavorite.upsert({
    where: { demandId_userId: { demandId: SEED_DEMAND_ID_1, userId: DEMO_USER_ID } },
    update: {},
    create: { demandId: SEED_DEMAND_ID_1, userId: DEMO_USER_ID },
  });
  await prisma.achievementFavorite.upsert({
    where: { achievementId_userId: { achievementId: SEED_ACHIEVEMENT_ID_1, userId: DEMO_USER_ID } },
    update: {},
    create: { achievementId: SEED_ACHIEVEMENT_ID_1, userId: DEMO_USER_ID },
  });
  await prisma.artworkFavorite.upsert({
    where: { artworkId_userId: { artworkId: SEED_ARTWORK_ID_1, userId: DEMO_USER_ID } },
    update: {},
    create: { artworkId: SEED_ARTWORK_ID_1, userId: DEMO_USER_ID },
  });

  console.log('[seed] favorites upserted: 4');
}

async function seedConversations() {
  if (!SEED_DEMO_DATA) return;

  const lastMessageAt = new Date('2026-02-10T09:45:00Z');
  await prisma.conversation.upsert({
    where: { id: SEED_CONVERSATION_ID_1 },
    update: {
      contentType: 'LISTING',
      contentId: SEED_LISTING_ID_1,
      listingId: SEED_LISTING_ID_1,
      buyerUserId: DEMO_USER_ID,
      sellerUserId: SEED_ORG_USER_ID,
      lastMessageAt,
    },
    create: {
      id: SEED_CONVERSATION_ID_1,
      contentType: 'LISTING',
      contentId: SEED_LISTING_ID_1,
      listingId: SEED_LISTING_ID_1,
      buyerUserId: DEMO_USER_ID,
      sellerUserId: SEED_ORG_USER_ID,
      lastMessageAt,
    },
  });

  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId: SEED_CONVERSATION_ID_1, userId: DEMO_USER_ID } },
    update: { lastReadAt: new Date('2026-02-10T10:00:00Z') },
    create: {
      conversationId: SEED_CONVERSATION_ID_1,
      userId: DEMO_USER_ID,
      lastReadAt: new Date('2026-02-10T10:00:00Z'),
    },
  });
  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId: SEED_CONVERSATION_ID_1, userId: SEED_ORG_USER_ID } },
    update: { lastReadAt: new Date('2026-02-10T09:50:00Z') },
    create: {
      conversationId: SEED_CONVERSATION_ID_1,
      userId: SEED_ORG_USER_ID,
      lastReadAt: new Date('2026-02-10T09:50:00Z'),
    },
  });

  const messages = [
    {
      id: SEED_MESSAGE_ID_1,
      conversationId: SEED_CONVERSATION_ID_1,
      senderUserId: DEMO_USER_ID,
      type: 'TEXT',
      text: '你好，请问该专利是否包含后续技术支持？',
      createdAt: new Date('2026-02-10T09:30:00Z'),
    },
    {
      id: SEED_MESSAGE_ID_2,
      conversationId: SEED_CONVERSATION_ID_1,
      senderUserId: SEED_ORG_USER_ID,
      type: 'TEXT',
      text: '可以提供1个月实施辅导，支持线上答疑。',
      createdAt: new Date('2026-02-10T09:45:00Z'),
    },
  ];

  for (const m of messages) {
    await prisma.conversationMessage.upsert({
      where: { id: m.id },
      update: {
        conversationId: m.conversationId,
        senderUserId: m.senderUserId,
        type: m.type,
        text: m.text,
        createdAt: m.createdAt,
      },
      create: m,
    });
  }

  console.log('[seed] conversations upserted: 1, messages: 2');
}

async function seedOrders() {
  if (!SEED_DEMO_DATA) return;

  const order = {
    id: SEED_ORDER_ID_1,
    listingId: SEED_LISTING_ID_2,
    buyerUserId: DEMO_USER_ID,
    assignedCsUserId: SEED_CS_USER_ID,
    status: 'DEPOSIT_PAID',
    dealAmount: 3500000,
    depositAmount: 50000,
    finalAmount: 3450000,
    commissionAmount: 175000,
  };

  await prisma.order.upsert({
    where: { id: order.id },
    update: {
      listingId: order.listingId,
      buyerUserId: order.buyerUserId,
      assignedCsUserId: order.assignedCsUserId,
      status: order.status,
      dealAmount: order.dealAmount,
      depositAmount: order.depositAmount,
      finalAmount: order.finalAmount,
      commissionAmount: order.commissionAmount,
    },
    create: order,
  });

  await prisma.payment.upsert({
    where: { id: SEED_PAYMENT_ID_1 },
    update: {
      orderId: SEED_ORDER_ID_1,
      payType: 'DEPOSIT',
      channel: 'WECHAT',
      tradeNo: `demo-deposit-${SEED_ORDER_ID_1.slice(0, 8)}`,
      amount: 50000,
      status: 'PAID',
      paidAt: new Date('2026-02-10T08:20:00Z'),
    },
    create: {
      id: SEED_PAYMENT_ID_1,
      orderId: SEED_ORDER_ID_1,
      payType: 'DEPOSIT',
      channel: 'WECHAT',
      tradeNo: `demo-deposit-${SEED_ORDER_ID_1.slice(0, 8)}`,
      amount: 50000,
      status: 'PAID',
      paidAt: new Date('2026-02-10T08:20:00Z'),
    },
  });

  console.log('[seed] orders upserted: 1');
}

async function seedAnnouncements() {
  const entries = [
      {
        id: '8c8b6d24-53e2-48ef-8609-d42ef6327973',
        title: '关于发布2025年专利开放许可项目清单的通知',
        summary: '发布2025年专利开放许可项目清单，面向社会公告。',
        content:
          '为推动专利转化运用，现发布2025年专利开放许可项目清单。欢迎有意向的企事业单位联系平台客服获取详细材料与对接方式。',
        publisherName: '国家知识产权局',
        issueNo: '2025-10',
        sourceUrl: 'https://example.com/announcement/2025-open-license',
        tags: ['专利开放许可', '政策公告'],
        relatedPatents: [
          { name: '专利开放许可清单', patentNo: 'CN202510000001' },
        ],
        createdAt: '2025-10-16T00:00:00Z',
      },
      {
        id: '1c8dabbf-a9d2-4015-8cb1-d2e74a873a35',
        title: '浙江安防职业技术学院专利转让交易公示——一种基于大数据服务的智慧安防系统',
        summary: '学院发布专利转让交易公示，欢迎意向单位咨询。',
        content:
          '本次公示涉及智慧安防系统相关专利。公告期内如有异议，请与平台客服或发布单位联系。',
        publisherName: '浙江安防职业技术学院',
        issueNo: '2024-07',
        sourceUrl: 'https://example.com/announcement/zaf-202407',
        tags: ['转让公示'],
        relatedPatents: [
          { name: '智慧安防系统', patentNo: 'CN202410000002' },
        ],
        createdAt: '2024-07-04T00:00:00Z',
      },
      {
        id: 'a3d41364-9ea6-4294-b5c9-6b4bc9951ebd',
        title: '陆冬赵燕专利转让公示',
        summary: '专利转让公示信息公开。',
        content: '现对相关专利转让事项进行公示，公示期内接受咨询与反馈。',
        publisherName: '发布机构',
        issueNo: '2023-12',
        sourceUrl: 'https://example.com/announcement/2023-12',
        tags: ['转让公示'],
        relatedPatents: [
          { name: '一种装置', patentNo: 'CN202310000003' },
        ],
        createdAt: '2023-12-21T00:00:00Z',
      },
    {
      id: 'b7dcf6d7-783b-487c-9363-702cd027db28',
      title: '关于“基于改进的LSTM-seq2seq模型的河流突发水污染事故水质预测方法”等4件专利转让的公示',
      summary: '中国地质大学（武汉）发布专利转让公示。',
      content: '本次公示涉及4件专利转让事项，详情请联系平台或发布单位。',
      createdAt: '2023-11-24T00:00:00Z',
    },
  ];

  if (!SEED_DEMO_DATA) {
    await prisma.announcement.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    console.log(`[seed] announcements demo data purged: ${entries.length}`);
    return;
  }

  for (const e of entries) {
    await prisma.announcement.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        summary: e.summary,
        content: e.content,
        publisherName: e.publisherName,
        issueNo: e.issueNo,
        sourceUrl: e.sourceUrl,
        tagsJson: e.tags,
        relatedPatentsJson: e.relatedPatents,
        status: 'PUBLISHED',
        publishedAt: new Date(e.createdAt),
      },
      create: {
        id: e.id,
        title: e.title,
        summary: e.summary,
        content: e.content,
        publisherName: e.publisherName,
        issueNo: e.issueNo,
        sourceUrl: e.sourceUrl,
        tagsJson: e.tags,
        relatedPatentsJson: e.relatedPatents,
        status: 'PUBLISHED',
        publishedAt: new Date(e.createdAt),
        createdAt: new Date(e.createdAt),
      },
    });
  }

  console.log(`[seed] announcements upserted: ${entries.length}`);
}

async function seedNotifications() {
  const entries = [
    {
      id: '0a9e9d16-8c44-44b6-9a6c-4c15a205b5b0',
      userId: DEMO_USER_ID,
      kind: 'system',
      title: '订单状态更新',
      summary: '您的订单已进入尾款支付阶段。',
      source: '交易通知',
      createdAt: '2026-02-01T08:30:00Z',
    },
    {
      id: '4a3f7c92-31b1-44b4-9b72-65c2d9e0e4a4',
      userId: DEMO_USER_ID,
      kind: 'cs',
      title: '客服提醒',
      summary: '请补充权属材料以完成审核。',
      source: '平台客服',
      createdAt: '2026-02-02T09:00:00Z',
    },
  ];

  if (!SEED_DEMO_DATA) {
    await prisma.notification.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    console.log(`[seed] notifications demo data purged: ${entries.length}`);
    return;
  }

  for (const e of entries) {
    await prisma.notification.upsert({
      where: { id: e.id },
      update: { title: e.title, summary: e.summary, source: e.source, kind: e.kind },
      create: {
        id: e.id,
        userId: e.userId,
        kind: e.kind,
        title: e.title,
        summary: e.summary,
        source: e.source,
        createdAt: new Date(e.createdAt),
      },
    });
  }

  console.log(`[seed] notifications upserted: ${entries.length}`);
}

async function seedAddresses() {
  const entries = [
    {
      id: 'c6a16b2c-4e6f-4b3e-9b5f-0f9cf978e0a1',
      userId: DEMO_USER_ID,
      name: '演示收货人',
      phone: '13800138000',
      regionCode: '110000',
      addressLine: '北京市海淀区中关村南大街 1 号',
      isDefault: true,
    },
  ];

  if (!SEED_DEMO_DATA) {
    await prisma.address.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    console.log(`[seed] addresss demo data purged: ${entries.length}`);
    return;
  }

  for (const e of entries) {
    await prisma.address.upsert({
      where: { id: e.id },
      update: {
        name: e.name,
        phone: e.phone,
        regionCode: e.regionCode,
        addressLine: e.addressLine,
        isDefault: e.isDefault,
      },
      create: e,
    });
  }

  console.log(`[seed] addresses upserted: ${entries.length}`);
}

async function seedDemands() {
  const entries = [
    {
      id: SEED_DEMAND_ID_1,
      publisherUserId: DEMO_USER_ID,
      source: 'USER',
      title: '动力电池健康评估算法需求',
      summary: '面向BMS的SOH/寿命评估方案',
      description: '需要可部署的电池健康评估算法或模型，支持在线学习与多工况适配，优先有车规落地经验。',
      keywordsJson: ['电池', '算法', 'BMS'],
      deliveryPeriod: 'MONTH_1_3',
      cooperationModesJson: ['TRANSFER', 'TECH_CONSULTING'],
      budgetType: 'NEGOTIABLE',
      budgetMinFen: 200000,
      budgetMaxFen: 800000,
      contactName: '赵先生',
      contactTitle: '技术负责人',
      contactPhoneMasked: '138****8000',
      regionCode: '110000',
      industryTagsJson: ['新能源', '汽车'],
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      coverFileId: SEED_FILE_DEMAND_1,
      stats: { viewCount: 88, favoriteCount: 6, consultCount: 2, commentCount: 1 },
    },
    {
      id: SEED_DEMAND_ID_2,
      publisherUserId: SEED_ORG_USER_ID,
      source: 'USER',
      title: '储能系统热失控预警合作',
      summary: '传感+模型联合预警',
      description: '寻求具备温度/气体传感与模型算法的团队，共同开发热失控预警系统并推进产品化落地。',
      keywordsJson: ['储能', '传感', '预警'],
      deliveryPeriod: 'MONTH_3_6',
      cooperationModesJson: ['TRANSFER', 'PLATFORM_CO_BUILD'],
      budgetType: 'NEGOTIABLE',
      budgetMinFen: 300000,
      budgetMaxFen: 1200000,
      contactName: '李女士',
      contactTitle: '项目经理',
      contactPhoneMasked: '021****2211',
      regionCode: '310000',
      industryTagsJson: ['储能', '安全'],
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      coverFileId: SEED_FILE_DEMAND_2,
      stats: { viewCount: 64, favoriteCount: 4, consultCount: 1, commentCount: 0 },
    },
  ];

  if (!SEED_DEMO_DATA) {
    await prisma.demand.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    console.log(`[seed] demands demo data purged: ${entries.length}`);
    return;
  }

  for (const e of entries) {
    await prisma.demand.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        summary: e.summary,
        description: e.description,
        keywordsJson: e.keywordsJson,
        deliveryPeriod: e.deliveryPeriod,
        cooperationModesJson: e.cooperationModesJson,
        budgetType: e.budgetType,
        budgetMinFen: e.budgetMinFen,
        budgetMaxFen: e.budgetMaxFen,
        contactName: e.contactName,
        contactTitle: e.contactTitle,
        contactPhoneMasked: e.contactPhoneMasked,
        regionCode: e.regionCode,
        industryTagsJson: e.industryTagsJson,
        auditStatus: e.auditStatus,
        status: e.status,
        coverFileId: e.coverFileId,
      },
      create: {
        id: e.id,
        publisherUserId: e.publisherUserId,
        source: e.source,
        title: e.title,
        summary: e.summary,
        description: e.description,
        keywordsJson: e.keywordsJson,
        deliveryPeriod: e.deliveryPeriod,
        cooperationModesJson: e.cooperationModesJson,
        budgetType: e.budgetType,
        budgetMinFen: e.budgetMinFen,
        budgetMaxFen: e.budgetMaxFen,
        contactName: e.contactName,
        contactTitle: e.contactTitle,
        contactPhoneMasked: e.contactPhoneMasked,
        regionCode: e.regionCode,
        industryTagsJson: e.industryTagsJson,
        auditStatus: e.auditStatus,
        status: e.status,
        coverFileId: e.coverFileId,
      },
    });

    await prisma.demandStats.upsert({
      where: { demandId: e.id },
      update: {
        viewCount: e.stats.viewCount,
        favoriteCount: e.stats.favoriteCount,
        consultCount: e.stats.consultCount,
        commentCount: e.stats.commentCount,
      },
      create: {
        demandId: e.id,
        viewCount: e.stats.viewCount,
        favoriteCount: e.stats.favoriteCount,
        consultCount: e.stats.consultCount,
        commentCount: e.stats.commentCount,
      },
    });
  }

  console.log(`[seed] demands upserted: ${entries.length}`);
}

async function seedAchievements() {
  const entries = [
    {
      id: SEED_ACHIEVEMENT_ID_1,
      publisherUserId: DEMO_USER_ID,
      source: 'USER',
      title: '高功率密度液冷电池包样机',
      summary: '已完成样机与台架验证',
      description: '面向乘用车与储能的液冷电池包样机，具备高功率密度与热均匀性，已完成台架测试。',
      keywordsJson: ['液冷', '电池包', '热管理'],
      maturity: 'PILOT',
      cooperationModesJson: ['TRANSFER', 'PLATFORM_CO_BUILD'],
      regionCode: '110000',
      industryTagsJson: ['新能源', '汽车'],
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      coverFileId: SEED_FILE_ACHIEVEMENT_1,
      stats: { viewCount: 120, favoriteCount: 9, consultCount: 3, commentCount: 1 },
    },
    {
      id: SEED_ACHIEVEMENT_ID_2,
      publisherUserId: SEED_ORG_USER_ID,
      source: 'USER',
      title: '智能涂覆产线数字孪生成果',
      summary: '已在两条产线试运行',
      description: '基于视觉检测与工艺模型的数字孪生系统，实现涂覆厚度在线监控与工艺自优化。',
      keywordsJson: ['数字孪生', '视觉检测', '工艺优化'],
      maturity: 'PROTOTYPE',
      cooperationModesJson: ['TRANSFER', 'TECH_CONSULTING'],
      regionCode: '310000',
      industryTagsJson: ['智能制造', '新材料'],
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      coverFileId: SEED_FILE_ACHIEVEMENT_2,
      stats: { viewCount: 76, favoriteCount: 5, consultCount: 2, commentCount: 0 },
    },
  ];

  if (!SEED_DEMO_DATA) {
    await prisma.achievement.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    console.log(`[seed] achievements demo data purged: ${entries.length}`);
    return;
  }

  for (const e of entries) {
    await prisma.achievement.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        summary: e.summary,
        description: e.description,
        keywordsJson: e.keywordsJson,
        maturity: e.maturity,
        cooperationModesJson: e.cooperationModesJson,
        regionCode: e.regionCode,
        industryTagsJson: e.industryTagsJson,
        auditStatus: e.auditStatus,
        status: e.status,
        coverFileId: e.coverFileId,
      },
      create: {
        id: e.id,
        publisherUserId: e.publisherUserId,
        source: e.source,
        title: e.title,
        summary: e.summary,
        description: e.description,
        keywordsJson: e.keywordsJson,
        maturity: e.maturity,
        cooperationModesJson: e.cooperationModesJson,
        regionCode: e.regionCode,
        industryTagsJson: e.industryTagsJson,
        auditStatus: e.auditStatus,
        status: e.status,
        coverFileId: e.coverFileId,
      },
    });

    await prisma.achievementStats.upsert({
      where: { achievementId: e.id },
      update: {
        viewCount: e.stats.viewCount,
        favoriteCount: e.stats.favoriteCount,
        consultCount: e.stats.consultCount,
        commentCount: e.stats.commentCount,
      },
      create: {
        achievementId: e.id,
        viewCount: e.stats.viewCount,
        favoriteCount: e.stats.favoriteCount,
        consultCount: e.stats.consultCount,
        commentCount: e.stats.commentCount,
      },
    });
  }

  console.log(`[seed] achievements upserted: ${entries.length}`);
}

async function seedArtworks() {
  const entries = [
    {
      id: SEED_ARTWORK_ID_1,
      sellerUserId: DEMO_USER_ID,
      source: 'USER',
      title: '松风远岫',
      description: '当代水墨山水，构图清雅，适合会议室或展厅陈设。',
      category: 'PAINTING',
      paintingGenre: 'LANDSCAPE',
      creatorName: '林溪',
      creationYear: 2021,
      certificateNo: 'ART-2021-001',
      priceType: 'NEGOTIABLE',
      depositAmountFen: 200000,
      regionCode: '110000',
      material: '宣纸、水墨',
      size: '68x136 cm',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      coverFileId: SEED_FILE_ARTWORK_1,
      stats: { viewCount: 54, favoriteCount: 3, consultCount: 1, commentCount: 0 },
    },
    {
      id: SEED_ARTWORK_ID_2,
      sellerUserId: SEED_ORG_USER_ID,
      source: 'USER',
      title: '行书《致远》',
      description: '行书作品，笔势流畅，适合企业办公空间。',
      category: 'CALLIGRAPHY',
      calligraphyScript: 'XINGSHU',
      creatorName: '周弘',
      creationYear: 2019,
      certificateNo: 'ART-2019-014',
      priceType: 'FIXED',
      priceAmountFen: 680000,
      depositAmountFen: 80000,
      regionCode: '310000',
      material: '宣纸、墨',
      size: '138x69 cm',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      coverFileId: SEED_FILE_ARTWORK_2,
      stats: { viewCount: 42, favoriteCount: 2, consultCount: 1, commentCount: 0 },
    },
  ];

  if (!SEED_DEMO_DATA) {
    await prisma.artwork.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    console.log(`[seed] artworks demo data purged: ${entries.length}`);
    return;
  }

  for (const e of entries) {
    await prisma.artwork.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        description: e.description,
        category: e.category,
        paintingGenre: e.paintingGenre ?? null,
        calligraphyScript: e.calligraphyScript ?? null,
        creatorName: e.creatorName,
        creationYear: e.creationYear,
        certificateNo: e.certificateNo,
        priceType: e.priceType,
        priceAmountFen: e.priceAmountFen ?? null,
        depositAmountFen: e.depositAmountFen,
        regionCode: e.regionCode,
        material: e.material,
        size: e.size,
        auditStatus: e.auditStatus,
        status: e.status,
        coverFileId: e.coverFileId,
      },
      create: {
        id: e.id,
        sellerUserId: e.sellerUserId,
        source: e.source,
        title: e.title,
        description: e.description,
        category: e.category,
        paintingGenre: e.paintingGenre ?? null,
        calligraphyScript: e.calligraphyScript ?? null,
        creatorName: e.creatorName,
        creationYear: e.creationYear,
        certificateNo: e.certificateNo,
        priceType: e.priceType,
        priceAmountFen: e.priceAmountFen ?? null,
        depositAmountFen: e.depositAmountFen,
        regionCode: e.regionCode,
        material: e.material,
        size: e.size,
        auditStatus: e.auditStatus,
        status: e.status,
        coverFileId: e.coverFileId,
      },
    });

    await prisma.artworkStats.upsert({
      where: { artworkId: e.id },
      update: {
        viewCount: e.stats.viewCount,
        favoriteCount: e.stats.favoriteCount,
        consultCount: e.stats.consultCount,
        commentCount: e.stats.commentCount,
      },
      create: {
        artworkId: e.id,
        viewCount: e.stats.viewCount,
        favoriteCount: e.stats.favoriteCount,
        consultCount: e.stats.consultCount,
        commentCount: e.stats.commentCount,
      },
    });
  }

  console.log(`[seed] artworks upserted: ${entries.length}`);
}

async function main() {
  if (SEED_BASE_DATA) {
    await seedRegions();
    await seedSystemConfigs();
  }

  if (SEED_DEMO_DATA) {
    await seedUsers();
    await seedFiles();
    await seedOrganizations();
    await seedTechManagers();
    await seedPersonalVerification();
    await seedPatents();
    await seedListings();
    await seedPatentMapEntries();
    await seedAnnouncements();
    await seedNotifications();
    await seedAddresses();
    await seedDemands();
    await seedAchievements();
    await seedArtworks();
    await seedFavorites();
    await seedConversations();
    await seedOrders();
  } else if (PURGE_DEMO_MAP) {
    await seedPatentMapEntries();
  }
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
