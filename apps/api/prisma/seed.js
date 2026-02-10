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

const DEMO_USER_ID = '99999999-9999-9999-9999-999999999999';

async function seedUsers() {
  const users = [
    {
      id: DEMO_USER_ID,
      phone: '13800138000',
      role: 'buyer',
      nickname: '演示用户',
      regionCode: '110000',
    },
    {
      id: '00000000-0000-0000-0000-000000000001',
      phone: '13900000000',
      role: 'admin',
      nickname: '管理员',
      regionCode: '110000',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        phone: u.phone,
        role: u.role,
        nickname: u.nickname,
        regionCode: u.regionCode,
      },
      create: u,
    });
  }

  console.log(`[seed] users upserted: ${users.length}`);
}

async function seedAnnouncements() {
  const entries = [
    {
      id: '8c8b6d24-53e2-48ef-8609-d42ef6327973',
      title: '关于发布2025年专利开放许可项目清单的通知',
      summary: '发布2025年专利开放许可项目清单，面向社会公告。',
      content:
        '为推动专利转化运用，现发布2025年专利开放许可项目清单。欢迎有意向的企事业单位联系平台客服获取详细材料与对接方式。',
      createdAt: '2025-10-16T00:00:00Z',
    },
    {
      id: '1c8dabbf-a9d2-4015-8cb1-d2e74a873a35',
      title: '浙江安防职业技术学院专利转让交易公示——一种基于大数据服务的智慧安防系统',
      summary: '学院发布专利转让交易公示，欢迎意向单位咨询。',
      content:
        '本次公示涉及智慧安防系统相关专利。公告期内如有异议，请与平台客服或发布单位联系。',
      createdAt: '2024-07-04T00:00:00Z',
    },
    {
      id: 'a3d41364-9ea6-4294-b5c9-6b4bc9951ebd',
      title: '陆冬赵燕专利转让公示',
      summary: '专利转让公示信息公开。',
      content: '现对相关专利转让事项进行公示，公示期内接受咨询与反馈。',
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

  for (const e of entries) {
    await prisma.announcement.upsert({
      where: { id: e.id },
      update: { title: e.title, summary: e.summary, content: e.content },
      create: {
        id: e.id,
        title: e.title,
        summary: e.summary,
        content: e.content,
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
      id: '7d3e5c6b-4a1d-4c7f-9b9a-1d5f6c9b0a01',
      publisherUserId: DEMO_USER_ID,
      source: 'USER',
      title: '高效储能材料技术需求',
      summary: '面向新能源储能场景的材料配方合作需求。',
      description: '希望与高校或研究机构合作开发高效储能材料，支持样品验证与工艺优化。',
      keywordsJson: ['储能材料', '新能源', '高分子'],
      deliveryPeriod: 'MONTH_1_3',
      cooperationModesJson: ['TRANSFER', 'TECH_CONSULTING'],
      budgetType: 'NEGOTIABLE',
      budgetMinFen: 200000,
      budgetMaxFen: 800000,
      contactName: '张工',
      contactTitle: '技术负责人',
      contactPhoneMasked: '138****8000',
      regionCode: '110000',
      industryTagsJson: ['新材料', '新能源'],
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
    },
  ];

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
      },
      create: e,
    });
  }

  console.log(`[seed] demands upserted: ${entries.length}`);
}

async function seedAchievements() {
  const entries = [
    {
      id: '2f9a1c8b-5d2a-4c6c-9d1f-9c1b2a3d4e51',
      publisherUserId: DEMO_USER_ID,
      source: 'USER',
      title: '高效电池隔膜成果',
      summary: '具备批量化潜力的高效电池隔膜成果。',
      description: '成果已完成中试验证，具备产业化应用前景，支持技术转让与合作开发。',
      keywordsJson: ['电池隔膜', '中试', '产业化'],
      maturity: 'PILOT',
      cooperationModesJson: ['TRANSFER', 'PLATFORM_CO_BUILD'],
      regionCode: '110000',
      industryTagsJson: ['新能源', '先进制造'],
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
    },
  ];

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
      },
      create: e,
    });
  }

  console.log(`[seed] achievements upserted: ${entries.length}`);
}

async function seedArtworks() {
  const entries = [
    {
      id: 'a1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
      sellerUserId: DEMO_USER_ID,
      source: 'USER',
      title: '山水雅集',
      description: '纸本设色山水作品，笔墨清雅。',
      category: 'PAINTING',
      paintingGenre: 'LANDSCAPE',
      creatorName: '匿名',
      creationYear: 2021,
      certificateNo: 'ART-2021-001',
      priceType: 'NEGOTIABLE',
      depositAmountFen: 200000,
      regionCode: '110000',
      material: '宣纸',
      size: '四尺',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
    },
  ];

  for (const e of entries) {
    await prisma.artwork.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        description: e.description,
        category: e.category,
        paintingGenre: e.paintingGenre,
        creatorName: e.creatorName,
        creationYear: e.creationYear,
        certificateNo: e.certificateNo,
        priceType: e.priceType,
        depositAmountFen: e.depositAmountFen,
        regionCode: e.regionCode,
        material: e.material,
        size: e.size,
        auditStatus: e.auditStatus,
        status: e.status,
      },
      create: e,
    });
  }

  console.log(`[seed] artworks upserted: ${entries.length}`);
}

async function main() {
  await seedUsers();
  await seedRegions();
  await seedSystemConfigs();
  await seedPatentMapEntries();
  await seedAnnouncements();
  await seedNotifications();
  await seedAddresses();
  await seedDemands();
  await seedAchievements();
  await seedArtworks();
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
