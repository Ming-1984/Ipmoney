/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const thisFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(thisFilePath), '..');
const apiPackageJsonPath = path.join(repoRoot, 'apps', 'api', 'package.json');
const requireFromApi = createRequire(apiPackageJsonPath);
const { PrismaClient } = requireFromApi('@prisma/client');
const ExcelJS = requireFromApi('exceljs');

const prisma = new PrismaClient();

const PATENT_ROOT_DIR = path.join(repoRoot, 'docs', 'patent');
const PEOPLE_DIR = path.join(PATENT_ROOT_DIR, 'people');
const PEOPLE_AVATAR_DIR = path.join(PEOPLE_DIR, 'touxiang');
const ACH_DIR = fs
  .readdirSync(PATENT_ROOT_DIR, { withFileTypes: true })
  .find((it) => it.isDirectory() && it.name !== 'people');
const ACH_DIR_PATH = ACH_DIR ? path.join(PATENT_ROOT_DIR, ACH_DIR.name) : path.join(PATENT_ROOT_DIR, '成果');
const ACH_IMAGE_DIR = path.join(ACH_DIR_PATH, 'images');

const DEFAULT_ADMIN_PHONE = process.env.IMPORT_ADMIN_PHONE || '13925106699';
const DEFAULT_ADMIN_NICKNAME = process.env.IMPORT_ADMIN_NICKNAME || 'ipmoney';
const DEFAULT_BATCH = process.env.IMPORT_SOURCE_BATCH || 'people-achievements-2026-04-22';
const DEFAULT_REGION_CODE = process.env.IMPORT_DEFAULT_REGION_CODE || '440000';
const BASE_URL = String(process.env.BASE_URL || 'https://api.ipmoney.cn').replace(/\/$/, '');
const configuredUploadDir = String(process.env.UPLOAD_DIR || './uploads').trim();
const UPLOAD_DIR = path.isAbsolute(configuredUploadDir)
  ? configuredUploadDir
  : path.join(repoRoot, 'apps', 'api', configuredUploadDir.replace(/^\.?[\\/]/, ''));
const PERSON_NAME_ALIASES = new Map([['邓凤桂', '邓韵霖']]);

function log(...args) {
  console.log('[import]', ...args);
}

function normalizeCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (typeof v === 'object' && v && 'text' in v) return String(v.text || '').trim();
  if (typeof v === 'object' && v && 'result' in v) return String(v.result || '').trim();
  return String(v).trim();
}

function normalizePersonName(raw) {
  const value = String(raw || '').trim().replace(/\s+/g, '');
  if (!value) return '';
  return PERSON_NAME_ALIASES.get(value) || value;
}

function pickWorkbookPath(dir) {
  const files = fs.readdirSync(dir).filter((name) => /\.xlsx$/i.test(name));
  if (!files.length) throw new Error(`xlsx not found in ${dir}`);
  return path.join(dir, files[0]);
}

async function readRowsWithColumns(xlsxPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const rows = [];
  for (let rowIndex = 2; rowIndex <= ws.rowCount; rowIndex += 1) {
    const row = ws.getRow(rowIndex);
    const cols = [];
    let hasValue = false;
    for (let col = 1; col <= 16; col += 1) {
      const value = normalizeCell(row.getCell(col).value);
      cols.push(value);
      if (value) hasValue = true;
    }
    if (hasValue) rows.push(cols);
  }
  return rows;
}

function splitTags(raw) {
  return String(raw || '')
    .split(/[、,，;/；|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toImagePath(raw) {
  return String(raw || '').replace(/^[/\\]+/, '').replace(/\\/g, '/');
}

function toImageFullPath(dir, raw) {
  const relativePath = toImagePath(raw);
  if (!relativePath) return '';
  const directPath = path.join(dir, relativePath);
  if (fs.existsSync(directPath)) return directPath;
  const fallbackPath = path.join(dir, path.basename(relativePath));
  if (fs.existsSync(fallbackPath)) return fallbackPath;
  return '';
}

function mapMaturity(rawStatus) {
  const text = String(rawStatus || '').trim();
  if (!text) return 'OTHER';
  if (text.includes('实验室') || text.includes('概念')) return 'CONCEPT';
  if (text.includes('原型') || text.includes('样机')) return 'PROTOTYPE';
  if (text.includes('中试') || text.includes('试点')) return 'PILOT';
  if (text.includes('量产') || text.includes('工程化')) return 'MASS_PRODUCTION';
  if (text.includes('商业化') || text.includes('产业化') || text.includes('落地')) return 'COMMERCIALIZED';
  return 'OTHER';
}

function inferRegionCode(rawRegion) {
  const text = String(rawRegion || '').trim();
  if (!text) return DEFAULT_REGION_CODE;
  if (text.includes('广东') || text.includes('广州') || text.includes('佛山') || text.includes('深圳')) return '440000';
  if (text.includes('北京')) return '110000';
  if (text.includes('上海')) return '310000';
  return DEFAULT_REGION_CODE;
}

function safeFileName(name) {
  return String(name || '').replace(/[^\w\-.()\u4e00-\u9fa5]+/g, '_');
}

async function ensureAdminUser() {
  let admin = await prisma.user.findFirst({ where: { phone: DEFAULT_ADMIN_PHONE } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        phone: DEFAULT_ADMIN_PHONE,
        nickname: DEFAULT_ADMIN_NICKNAME,
        role: 'admin',
      },
    });
  } else if (String(admin.nickname || '').trim() !== DEFAULT_ADMIN_NICKNAME) {
    admin = await prisma.user.update({ where: { id: admin.id }, data: { nickname: DEFAULT_ADMIN_NICKNAME } });
  }
  return admin;
}

async function ensureImageFile(ownerId, absolutePath, purposeName) {
  if (!absolutePath || !fs.existsSync(absolutePath)) return null;
  const stat = fs.statSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const localDir = path.join(UPLOAD_DIR, 'import-assets', purposeName);
  fs.mkdirSync(localDir, { recursive: true });
  const copiedName = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${safeFileName(path.basename(absolutePath))}`;
  const copiedPath = path.join(localDir, copiedName);
  fs.copyFileSync(absolutePath, copiedPath);
  const relativePath = path.relative(UPLOAD_DIR, copiedPath).replace(/\\/g, '/');
  const url = `${BASE_URL}/uploads/${relativePath}`;
  return await prisma.file.create({
    data: {
      url,
      fileName: copiedName,
      mimeType,
      sizeBytes: Number(stat.size || 0),
      ownerScope: 'USER',
      ownerId,
    },
  });
}

async function importPeople(adminUser) {
  const workbookPath = pickWorkbookPath(PEOPLE_DIR);
  const rows = await readRowsWithColumns(workbookPath);
  const report = { total: rows.length, imported: 0, missingAvatar: 0 };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const name = normalizePersonName(row[0] || '');
    if (!name) continue;
    const position = row[1] || '';
    const organization = row[2] || '';
    const serviceDirections = splitTags(row[3] || '');
    const workHighlights = row[4] || '';
    const photoRaw = row[5] || '';
    const avatarPath = toImageFullPath(PEOPLE_DIR, photoRaw) || toImageFullPath(PEOPLE_AVATAR_DIR, photoRaw);
    if (!avatarPath) report.missingAvatar += 1;

    const fakePhone = `199${String(i + 1).padStart(8, '0').slice(-8)}`;
    let user = await prisma.user.findFirst({ where: { OR: [{ phone: fakePhone }, { nickname: name }] } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: fakePhone,
          nickname: name,
          role: 'seller',
        },
      });
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { nickname: name } });
    }

    if (avatarPath) {
      const avatarFile = await ensureImageFile(user.id, avatarPath, 'people-avatar');
      if (avatarFile?.url) {
        await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: avatarFile.url } });
      }
    }

    const verification = await prisma.userVerification.findFirst({
      where: { userId: user.id, verificationType: 'TECH_MANAGER' },
    });
    if (verification) {
      await prisma.userVerification.update({
        where: { id: verification.id },
        data: {
          verificationStatus: 'APPROVED',
          displayName: name,
          intro: organization || verification.intro || null,
        },
      });
    } else {
      await prisma.userVerification.create({
        data: {
          userId: user.id,
          verificationType: 'TECH_MANAGER',
          verificationStatus: 'APPROVED',
          displayName: name,
          intro: organization || null,
          regionCode: DEFAULT_REGION_CODE,
          submittedAt: new Date(),
          reviewedAt: new Date(),
        },
      });
    }

    await prisma.techManagerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        intro: organization || workHighlights || null,
        position: position || null,
        organization: organization || null,
        serviceDirectionsJson: serviceDirections.length ? serviceDirections : null,
        serviceTagsJson: serviceDirections.length ? serviceDirections : null,
        workHighlights: workHighlights || null,
      },
      update: {
        intro: organization || workHighlights || null,
        position: position || null,
        organization: organization || null,
        serviceDirectionsJson: serviceDirections.length ? serviceDirections : null,
        serviceTagsJson: serviceDirections.length ? serviceDirections : null,
        workHighlights: workHighlights || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminUser.id,
        action: 'TECH_MANAGER_IMPORT_UPSERT',
        targetType: 'TECH_MANAGER_PROFILE',
        targetId: user.id,
        afterJson: { name, position, organization, serviceDirections, workHighlights },
      },
    });

    report.imported += 1;
  }

  return report;
}

async function importAchievements(adminUser) {
  const workbookPath = pickWorkbookPath(ACH_DIR_PATH);
  const rows = await readRowsWithColumns(workbookPath);
  const report = { total: rows.length, imported: 0, missingCover: 0, unmappedCategory: 0, unmappedStatus: 0 };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const externalId = row[0] || '';
    const title = row[1] || '';
    if (!title) continue;
    const rawCategory = row[2] || '';
    const rawStatus = row[3] || '';
    const rawRegion = row[4] || '';
    const orgName = row[5] || '';
    const description = row[6] || '';
    const imageRaw = row[7] || '';

    const maturity = mapMaturity(rawStatus);
    const regionCode = inferRegionCode(rawRegion);
    const industryTags = splitTags(rawCategory);
    const imagePath = toImageFullPath(ACH_DIR_PATH, imageRaw) || toImageFullPath(ACH_IMAGE_DIR, imageRaw);
    let coverFileId = null;
    if (!imagePath) {
      report.missingCover += 1;
    } else {
      const coverFile = await ensureImageFile(adminUser.id, imagePath, 'achievement-cover');
      coverFileId = coverFile?.id || null;
    }
    if (!industryTags.length && rawCategory) report.unmappedCategory += 1;
    if (maturity === 'OTHER' && rawStatus) report.unmappedStatus += 1;

    const existing = externalId ? await prisma.achievement.findUnique({ where: { externalId } }) : null;
    const commonData = {
      publisherUserId: adminUser.id,
      source: 'PLATFORM',
      externalId: externalId || null,
      title,
      summary: description.slice(0, 240) || null,
      description: description || null,
      maturity,
      regionCode,
      industryTagsJson: industryTags.length ? industryTags : null,
      keywordsJson: industryTags.length ? industryTags : null,
      coverFileId,
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      sourceRawCategory: rawCategory || null,
      sourceRawStatus: rawStatus || null,
      sourceBatch: DEFAULT_BATCH,
      sourceRawRegion: rawRegion || null,
      sourceOrgName: orgName || null,
    };

    let achievementId = existing?.id || '';
    if (existing) {
      await prisma.achievement.update({ where: { id: existing.id }, data: commonData });
      achievementId = existing.id;
    } else {
      const created = await prisma.achievement.create({ data: commonData });
      achievementId = created.id;
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: adminUser.id,
        action: 'ACHIEVEMENT_IMPORT_UPSERT',
        targetType: 'ACHIEVEMENT',
        targetId: achievementId,
        afterJson: { externalId: externalId || null, title, maturity, sourceBatch: DEFAULT_BATCH },
      },
    });

    report.imported += 1;
  }

  return report;
}

async function main() {
  log('start import');
  const adminUser = await ensureAdminUser();
  const peopleReport = await importPeople(adminUser);
  const achievementsReport = await importAchievements(adminUser);
  const summary = {
    at: new Date().toISOString(),
    batch: DEFAULT_BATCH,
    adminUserId: adminUser.id,
    people: peopleReport,
    achievements: achievementsReport,
  };
  const outputPath = path.join(repoRoot, 'docs', 'engineering', `import-report-${DEFAULT_BATCH}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
  log('done', outputPath);
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
