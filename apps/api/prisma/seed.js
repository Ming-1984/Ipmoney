/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

const prisma = new PrismaClient();

const NODE_ENV = String(process.env.NODE_ENV || '').trim().toLowerCase();
const SEED_BASE_DATA = String(process.env.SEED_BASE_DATA || '').trim().toLowerCase() !== 'false';
const SEED_DEMO_DATA = String(process.env.SEED_DEMO_DATA || '').trim().toLowerCase() === 'true';

if (NODE_ENV === 'production' && SEED_DEMO_DATA) {
  throw new Error('SEED_DEMO_DATA must be false in production.');
}
const DEFAULT_DEMO_USER_ID = '8c592d03-c1c1-40be-8d62-64ce71ac7606';
const DEFAULT_DEMO_ADMIN_ID = '804b7a04-aafe-409a-bee4-e84f953cb4c0';
const DEMO_USER_ID = String(process.env.DEMO_USER_ID || DEFAULT_DEMO_USER_ID).trim() || DEFAULT_DEMO_USER_ID;
const DEMO_ADMIN_ID = String(process.env.DEMO_ADMIN_ID || DEFAULT_DEMO_ADMIN_ID).trim() || DEFAULT_DEMO_ADMIN_ID;
const DEMO_USER_NICKNAME =
  String(process.env.DEMO_USER_NICKNAME || '').trim() || '\u6f14\u793a\u7528\u6237';
const DEMO_ADMIN_NICKNAME =
  String(process.env.DEMO_ADMIN_NICKNAME || '').trim() || '\u5e73\u53f0\u7ba1\u7406\u5458';

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
const SEED_FILE_ORG_LOGO = '10d0030b-ab22-4fb7-bc37-b53a56e3f6a6';

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

async function seedRegions() {
  const regionsPath = path.resolve(__dirname, 'seed-data', 'regions-cn.json');
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
      listingTopicsJson: ['AWARD_WINNING', 'OPEN_LICENSE'],
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
      listingTopicsJson: ['HIGH_TECH_RETIRED', 'AWARD_WINNING'],
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
      listingTopicsJson: ['SLEEPING'],
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

  console.log('[seed] favorites upserted: 1');
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
    await seedNotifications();
    await seedAddresses();
    await seedFavorites();
    await seedConversations();
    await seedOrders();
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
