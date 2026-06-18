/* eslint-disable no-console */
import process from 'node:process';

const YEAR_HINT_RE = /(?:从事|从业|服务|执业|技术转移|技术经纪|科技服务).{0,12}?(?:\d{1,2}|[一二三四五六七八九十两]+)\s*年|(?:\d{1,2}|[一二三四五六七八九十两]+)\s*年(?:从业|经验|服务经验)/u;
const LEVEL_HINT_RE = /资深|高级|中级|初级|专家|顾问|经理人|工程师|研究员|主任|总监/u;
const EMPTY_LIKE_TEXTS = new Set(['', '-', '--', '—', '——', '无', '暂无', '待补充', '未填写', '未提供', 'null', 'NULL']);

function normalizeText(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return EMPTY_LIKE_TEXTS.has(text) ? '' : text;
}

async function loadPrismaClient() {
  try {
    return await import('../apps/api/node_modules/@prisma/client/index.js');
  } catch (error) {
    console.error('[audit-tech-manager-profile-field-misalignment] failed to load Prisma client.');
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('[audit-tech-manager-profile-field-misalignment] DATABASE_URL is required.');
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
              where: {
                verificationType: 'TECH_MANAGER',
              },
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: {
                displayName: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const rows = [];
    for (const profile of profiles) {
      const verification = Array.isArray(profile.user?.verifications) ? profile.user.verifications[0] : null;
      const displayName = normalizeText(verification?.displayName) || normalizeText(profile.user?.nickname) || profile.userId;
      const experienceLabel = normalizeText(profile.experienceLabel);
      const levelLabel = normalizeText(profile.levelLabel);
      const intro = normalizeText(profile.intro);
      const workHighlights = normalizeText(profile.workHighlights);
      const combined = [intro, workHighlights].filter(Boolean).join('\n');

      const hasYearHint = YEAR_HINT_RE.test(combined);
      const hasLevelHint = LEVEL_HINT_RE.test(combined);
      const issues = [];

      if (!experienceLabel && hasYearHint) issues.push('missingExperienceLabelWithYearHint');
      if (!levelLabel && hasLevelHint) issues.push('missingLevelLabelWithLevelHint');
      if (!issues.length) continue;

      rows.push({
        userId: profile.userId,
        displayName,
        verificationStatus: verification?.verificationStatus ?? null,
        experienceLabel: experienceLabel || null,
        levelLabel: levelLabel || null,
        introPreview: intro.slice(0, 120) || null,
        workHighlightsPreview: workHighlights.slice(0, 120) || null,
        issues,
      });
    }

    console.log(
      JSON.stringify(
        {
          totalProfiles: profiles.length,
          suspiciousProfiles: rows.length,
          items: rows,
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
  console.error('[audit-tech-manager-profile-field-misalignment] failed');
  console.error(error);
  process.exit(1);
});
