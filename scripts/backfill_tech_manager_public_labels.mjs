/* eslint-disable no-console */
import process from 'node:process';

const YEAR_PATTERNS = [
  /(?:从事|从业|服务|执业|工作)[^。；，,\n]{0,24}?(?:超|近|约|达|至少)?\d{1,2}\s*年(?:[^。；，,\n]{0,16})?/u,
  /\d{1,2}\s*年(?:从业经验|服务经验|行业经验)/u,
];
const LEVEL_PATTERN = /资深顾问|高级(?:经理人|顾问|工程师)|中级(?:经理人|顾问|工程师)|初级(?:经理人|顾问|工程师)|技术经纪高级工程师|技术经纪工程师|专家|顾问|经理人|工程师|研究员|主任|总监/u;
const EMPTY_LIKE_TEXTS = new Set(['', '-', '--', '—', '——', '无', '暂无', '待补充', '未填写', '未提供', 'null', 'NULL']);

function normalizeText(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return EMPTY_LIKE_TEXTS.has(text) ? '' : text;
}

function matchFirst(text, patterns) {
  for (const pattern of patterns) {
    const matched = text.match(pattern)?.[0]?.trim();
    if (matched) return matched.replace(/[，。；、,\s]+$/u, '');
  }
  return '';
}

function deriveExperienceLabel(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    const matched = matchFirst(normalized, YEAR_PATTERNS);
    if (matched) return matched;
  }
  return '';
}

function deriveLevelLabel(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    const matched = normalized.match(LEVEL_PATTERN)?.[0]?.trim();
    if (matched) return matched;
  }
  return '';
}

function isSuspiciousExperienceLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return normalized.includes(',') || normalized.includes('，') || normalized.length > 32;
}

async function loadPrismaClient() {
  try {
    return await import('../apps/api/node_modules/@prisma/client/index.js');
  } catch (error) {
    console.error('[backfill-tech-manager-public-labels] failed to load Prisma client.');
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const dryRun = String(process.env.DRY_RUN || '0').trim() === '1';
  const repairExisting = String(process.env.REPAIR_EXISTING || '0').trim() === '1';
  if (!databaseUrl) {
    console.error('[backfill-tech-manager-public-labels] DATABASE_URL is required.');
    process.exit(1);
  }

  const { PrismaClient } = await loadPrismaClient();
  const prisma = new PrismaClient();

  try {
    const profiles = await prisma.techManagerProfile.findMany({
      include: {
        user: {
          include: {
            verifications: {
              where: { verificationType: 'TECH_MANAGER' },
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let updatedCount = 0;
    const items = [];

    for (const profile of profiles) {
      const experienceLabel = normalizeText(profile.experienceLabel);
      const levelLabel = normalizeText(profile.levelLabel);
      const derivedExperienceLabel = deriveExperienceLabel(profile.workHighlights, profile.intro);
      const derivedLevelLabel = deriveLevelLabel(profile.workHighlights, profile.intro);
      const nextData = {};

      if (!experienceLabel && derivedExperienceLabel) nextData.experienceLabel = derivedExperienceLabel;
      if (
        repairExisting &&
        experienceLabel &&
        derivedExperienceLabel &&
        experienceLabel !== derivedExperienceLabel &&
        isSuspiciousExperienceLabel(experienceLabel)
      ) {
        nextData.experienceLabel = derivedExperienceLabel;
      }
      if (!levelLabel && derivedLevelLabel) nextData.levelLabel = derivedLevelLabel;
      if (!Object.keys(nextData).length) continue;

      updatedCount += 1;
      items.push({
        userId: profile.userId,
        displayName: normalizeText(profile.user?.verifications?.[0]?.displayName) || profile.userId,
        nextData,
      });

      if (!dryRun) {
        await prisma.techManagerProfile.update({
          where: { userId: profile.userId },
          data: nextData,
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          totalProfiles: profiles.length,
          updatedCount,
          items: items.slice(0, 50),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[backfill-tech-manager-public-labels] failed');
  console.error(error);
  process.exit(1);
});
