import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FileOwnerScope, Prisma } from '@prisma/client';
import ExcelJS = require('exceljs');
import crypto from 'node:crypto';
import path from 'node:path';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FilesService } from '../files/files.service';

type RatingPolicy = 'KEEP_EXISTING' | 'FILL_MISSING' | 'FORCE_SET';
type ImportHistoryAction = 'PREVIEW' | 'EXECUTE' | 'ALL';
type WorkbookKind = 'PEOPLE' | 'ACHIEVEMENTS';

type ImportInput = {
  peopleFileId: string;
  achievementsFileId: string;
  sourceBatch: string;
  defaultRegionCode: string;
  ratingPolicy: RatingPolicy;
  defaultRatingScore: number;
  defaultRatingCount: number;
};

type PreviewRowError = {
  rowNo: number;
  reason: string;
};

type PreviewSection = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sampleErrors: PreviewRowError[];
};

type ExecuteSection = PreviewSection & {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

type RegionRecord = { code: string; name: string };
type WorkbookRow = { rowNo: number; cols: string[] };
type WorkbookRows = { headers: string[]; rows: WorkbookRow[] };
type RegionMatchers = { exactNameToCode: Map<string, string>; fuzzyList: Array<{ name: string; code: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGION_CODE_RE = /^[0-9]{6}$/;
const MAX_ROWS = 10000;
const SAMPLE_ERROR_LIMIT = 30;
const DEFAULT_SOURCE_BATCH = 'people-achievements-manual';
const ACTION_PREVIEW = 'BULK_IMPORT_PREVIEW';
const ACTION_EXECUTE = 'BULK_IMPORT_EXECUTE';
const PERSON_NAME_ALIASES = new Map<string, string>([['邓凤桂', '邓韵霖']]);

@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditLogService,
  ) {}

  private ensureAdmin(request: any) {
    if (!request?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'permission denied' });
    }
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseImportHistoryAction(value: unknown): ImportHistoryAction {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw || raw === 'ALL') return 'ALL';
    if (raw === 'PREVIEW') return 'PREVIEW';
    if (raw === 'EXECUTE') return 'EXECUTE';
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'action is invalid' });
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseOptionalRegionCode(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '440000';
    if (!REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'defaultRegionCode is invalid' });
    }
    return raw;
  }

  private parseRatingPolicy(value: unknown): RatingPolicy {
    const normalized = String(value ?? 'FILL_MISSING').trim().toUpperCase();
    if (normalized === 'KEEP_EXISTING' || normalized === 'FILL_MISSING' || normalized === 'FORCE_SET') {
      return normalized as RatingPolicy;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: 'ratingPolicy is invalid' });
  }

  private parseRatingScore(value: unknown): number {
    if (value === null || value === undefined || String(value).trim() === '') return 4.8;
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 5) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'defaultRatingScore is invalid' });
    }
    return Number(score.toFixed(1));
  }

  private parseRatingCount(value: unknown): number {
    if (value === null || value === undefined || String(value).trim() === '') return 16;
    const count = Number(value);
    if (!Number.isFinite(count) || !Number.isSafeInteger(count) || count < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'defaultRatingCount is invalid' });
    }
    return count;
  }

  private parseRequest(body: any): ImportInput {
    const peopleFileId = String(body?.peopleFileId || '').trim();
    const achievementsFileId = String(body?.achievementsFileId || '').trim();
    if (!peopleFileId && !achievementsFileId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'peopleFileId or achievementsFileId is required' });
    }
    const parsedPeopleFileId = peopleFileId ? this.parseUuidStrict(peopleFileId, 'peopleFileId') : '';
    const parsedAchievementsFileId = achievementsFileId ? this.parseUuidStrict(achievementsFileId, 'achievementsFileId') : '';

    const sourceBatchRaw = String(body?.sourceBatch ?? '').trim();
    const sourceBatch = sourceBatchRaw || DEFAULT_SOURCE_BATCH;
    if (sourceBatch.length > 100) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'sourceBatch is too long' });
    }

    const defaultRegionCode = this.parseOptionalRegionCode(body?.defaultRegionCode);
    const ratingPolicy = this.parseRatingPolicy(body?.ratingPolicy);
    const defaultRatingScore = this.parseRatingScore(body?.defaultRatingScore);
    const defaultRatingCount = this.parseRatingCount(body?.defaultRatingCount);
    if (defaultRatingCount === 0 && defaultRatingScore > 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'defaultRatingCount is invalid' });
    }

    return {
      peopleFileId: parsedPeopleFileId,
      achievementsFileId: parsedAchievementsFileId,
      sourceBatch,
      defaultRegionCode,
      ratingPolicy,
      defaultRatingScore,
      defaultRatingCount,
    };
  }

  private toInputPayload(input: ImportInput) {
    return {
      peopleFileId: input.peopleFileId || null,
      achievementsFileId: input.achievementsFileId || null,
      sourceBatch: input.sourceBatch,
      defaultRegionCode: input.defaultRegionCode,
      ratingPolicy: input.ratingPolicy,
      defaultRatingScore: input.defaultRatingScore,
      defaultRatingCount: input.defaultRatingCount,
    };
  }

  private normalizeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (typeof value === 'object' && value) {
      const maybe = value as Record<string, unknown>;
      if (typeof maybe.text === 'string') return String(maybe.text).trim();
      if (maybe.result !== undefined) return String(maybe.result || '').trim();
    }
    return String(value).trim();
  }

  private normalizeHeaderText(value: unknown): string {
    return this.normalizeCell(value)
      .toLowerCase()
      .replace(/[\s_\-（）()【】\[\]:：]/g, '');
  }

  private splitTags(raw: unknown): string[] {
    return String(raw || '')
      .split(/[、，,;；|/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizePersonName(raw: unknown): string {
    const name = String(raw || '').trim();
    if (!name) return '';
    const normalized = name.replace(/\s+/g, '');
    return PERSON_NAME_ALIASES.get(normalized) || normalized;
  }

  private normalizePosition(raw: unknown): string | null {
    const value = String(raw || '').trim();
    if (!value || value === '-') return null;
    return value;
  }

  private normalizeText(raw: unknown, maxLength: number): string | null {
    const value = String(raw || '').trim();
    if (!value) return null;
    return value.slice(0, maxLength);
  }

  private normalizeImageUrl(raw: unknown, baseUrl: string): string | null {
    const original = String(raw || '').trim();
    if (!original) return null;

    const normalized = original.replace(/\\/g, '/');
    if (/^https?:\/\//i.test(normalized)) return normalized;

    let pathname = normalized;
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
    if (!pathname.startsWith('/uploads/')) return null;
    return `${baseUrl}${pathname}`;
  }

  private mapMaturity(rawStatus: unknown):
    | 'CONCEPT'
    | 'PROTOTYPE'
    | 'PILOT'
    | 'MASS_PRODUCTION'
    | 'COMMERCIALIZED'
    | 'OTHER' {
    const text = String(rawStatus || '').trim();
    if (!text) return 'OTHER';
    if (text.includes('实验室') || text.includes('小试') || text.includes('概念')) return 'CONCEPT';
    if (text.includes('原型') || text.includes('样机')) return 'PROTOTYPE';
    if (text.includes('中试') || text.includes('试点')) return 'PILOT';
    if (text.includes('成熟') || text.includes('量产')) return 'MASS_PRODUCTION';
    if (text.includes('产业化') || text.includes('商业化') || text.includes('百吨') || text.includes('已实现')) {
      return 'COMMERCIALIZED';
    }
    return 'OTHER';
  }

  private buildRegionMatchers(regions: RegionRecord[]): RegionMatchers {
    const exactNameToCode = new Map<string, string>();
    const fuzzyList: Array<{ name: string; code: string }> = [];

    for (const region of regions) {
      const name = String(region.name || '').trim();
      if (!name) continue;
      exactNameToCode.set(name, region.code);
      fuzzyList.push({ name, code: region.code });
    }

    return { exactNameToCode, fuzzyList };
  }

  private resolveRegionCode(rawRegion: unknown, fallbackRegionCode: string, matchers: RegionMatchers): string {
    const text = String(rawRegion || '').trim();
    if (!text) return fallbackRegionCode;
    if (REGION_CODE_RE.test(text)) return text;
    if (matchers.exactNameToCode.has(text)) return matchers.exactNameToCode.get(text) || fallbackRegionCode;

    for (const item of matchers.fuzzyList) {
      if (item.name.includes(text) || text.includes(item.name)) return item.code;
    }
    return fallbackRegionCode;
  }

  private inferMimeType(fileName: string): string {
    const ext = path.extname(String(fileName || '').toLowerCase());
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'application/octet-stream';
  }

  private detectFileName(file: { fileName?: string | null; url?: string | null }): string {
    const direct = String(file.fileName || '').trim();
    if (direct) return direct;
    const url = String(file.url || '').trim();
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return path.basename(parsed.pathname);
    } catch {
      return path.basename(url.split('?')[0] || '');
    }
  }

  private validateTemplateHeaders(kind: WorkbookKind, headers: string[]) {
    const h1 = headers[0] || '';
    const h2 = headers[1] || '';
    if (kind === 'PEOPLE') {
      const nameOk = h1.includes('姓名') || h1.includes('名称');
      if (!nameOk) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'people template header is invalid' });
      return;
    }
    const titleOk = h2.includes('成果名称') || h2.includes('名称');
    if (!titleOk) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'achievements template header is invalid' });
  }

  private async readWorkbookRows(fileId: string, kind: WorkbookKind): Promise<WorkbookRows> {
    const file = await this.files.getFileById(fileId);
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'import file not found' });

    const detectedName = this.detectFileName(file);
    if (!detectedName) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });

    const fileBufferRaw = await this.files.getFileBuffer(detectedName);
    if (!fileBufferRaw || !fileBufferRaw.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });
    }
    const buffer = Buffer.from(fileBufferRaw);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'import file is invalid' });

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    for (let col = 1; col <= 16; col += 1) {
      headers.push(this.normalizeHeaderText(headerRow.getCell(col).value));
    }
    this.validateTemplateHeaders(kind, headers);

    const rows: WorkbookRow[] = [];
    for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
      const row = sheet.getRow(rowNo);
      const cols: string[] = [];
      let hasValue = false;
      for (let col = 1; col <= 16; col += 1) {
        const value = this.normalizeCell(row.getCell(col).value);
        cols.push(value);
        if (value) hasValue = true;
      }
      if (hasValue) rows.push({ rowNo, cols });
      if (rows.length > MAX_ROWS) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `import rows exceed limit (${MAX_ROWS})` });
      }
    }
    return { headers, rows };
  }

  private pushPreviewError(target: PreviewRowError[], rowNo: number, reason: string) {
    if (target.length >= SAMPLE_ERROR_LIMIT) return;
    target.push({ rowNo, reason });
  }

  private buildFakePhone(name: string, rowNo: number): string {
    const digest = crypto.createHash('md5').update(`${name}-${rowNo}`).digest('hex').slice(0, 8);
    return `199${digest.replace(/[^0-9]/g, '0').slice(0, 8).padEnd(8, '0')}`;
  }

  private buildAchievementExternalId(rawExternalId: string, title: string, orgName: string, rowNo: number): string {
    const candidate = String(rawExternalId || '').trim();
    if (candidate) return candidate;
    const digest = crypto.createHash('sha1').update(`${title}|${orgName}|${rowNo}`).digest('hex').slice(0, 16);
    return `AUTO-${digest}`;
  }

  private async ensureImageFileByUrl(userId: string, imageUrl: string): Promise<string | null> {
    const normalizedUrl = String(imageUrl || '').trim();
    if (!normalizedUrl) return null;

    const existing = await this.prisma.file.findFirst({
      where: { ownerId: userId, ownerScope: FileOwnerScope.USER, url: normalizedUrl },
      select: { id: true },
    });
    if (existing?.id) return existing.id;

    const fileName = path.basename(normalizedUrl.split('?')[0] || '');
    if (!fileName) return null;

    const created = await this.prisma.file.create({
      data: {
        url: normalizedUrl,
        fileName,
        mimeType: this.inferMimeType(fileName),
        sizeBytes: 0,
        ownerScope: FileOwnerScope.USER,
        ownerId: userId,
      },
      select: { id: true },
    });
    return created.id;
  }

  private buildPayload(input: ImportInput, people: PreviewSection | ExecuteSection, achievements: PreviewSection | ExecuteSection) {
    return {
      scope: 'PEOPLE_ACHIEVEMENTS' as const,
      input: this.toInputPayload(input),
      people,
      achievements,
    };
  }

  private getIdempotencyKey(req: any) {
    const raw = req?.headers?.['idempotency-key'];
    if (!raw) return '';
    return String(raw).trim();
  }

  private hashPayload(input: ImportInput): string {
    return crypto.createHash('sha256').update(JSON.stringify(this.toInputPayload(input))).digest('hex');
  }

  private async withIdempotency<T>(req: any, scope: string, requestHash: string, handler: () => Promise<T>): Promise<T> {
    const key = this.getIdempotencyKey(req);
    if (!key) return await handler();
    const userId = req?.auth?.userId ? String(req.auth.userId) : '';
    if (!userId) return await handler();

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_scope_userId: { key, scope, userId } },
    });
    if (existing) {
      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new ConflictException({ code: 'CONFLICT', message: 'idempotency key reused with different payload' });
      }
      if (existing.status === 'COMPLETED' && existing.responseJson != null) {
        return existing.responseJson as T;
      }
      throw new ConflictException({ code: 'CONFLICT', message: 'idempotency key already used' });
    }

    const record = await this.prisma.idempotencyKey.create({
      data: { key, scope, userId, requestHash, status: 'IN_PROGRESS' },
    });
    try {
      const result = await handler();
      await this.prisma.idempotencyKey.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', responseJson: result as any },
      });
      return result;
    } catch (error) {
      await this.prisma.idempotencyKey.delete({ where: { id: record.id } });
      throw error;
    }
  }

  async previewPeopleAchievements(request: any, body: any) {
    this.ensureAdmin(request);
    const input = this.parseRequest(body || {});
    const requestHash = this.hashPayload(input);

    return await this.withIdempotency(request, 'bulk-import:people-achievements:preview', requestHash, async () => {
      const peopleSection: PreviewSection = { totalRows: 0, validRows: 0, invalidRows: 0, sampleErrors: [] };
      const achievementsSection: PreviewSection = { totalRows: 0, validRows: 0, invalidRows: 0, sampleErrors: [] };

      if (input.peopleFileId) {
        const rows = (await this.readWorkbookRows(input.peopleFileId, 'PEOPLE')).rows;
        peopleSection.totalRows = rows.length;
        for (const row of rows) {
          const name = this.normalizePersonName(row.cols[0]);
          if (!name) {
            peopleSection.invalidRows += 1;
            this.pushPreviewError(peopleSection.sampleErrors, row.rowNo, '姓名不能为空');
            continue;
          }
          const workHighlights = this.normalizeText(row.cols[4], 4000);
          const organization = this.normalizeText(row.cols[2], 200);
          if (!workHighlights && !organization) {
            peopleSection.invalidRows += 1;
            this.pushPreviewError(peopleSection.sampleErrors, row.rowNo, '简介与任职单位至少填写一个');
            continue;
          }
          peopleSection.validRows += 1;
        }
      }

      if (input.achievementsFileId) {
        const rows = (await this.readWorkbookRows(input.achievementsFileId, 'ACHIEVEMENTS')).rows;
        achievementsSection.totalRows = rows.length;
        for (const row of rows) {
          const title = this.normalizeText(row.cols[1], 300);
          const description = this.normalizeText(row.cols[6], 12000);
          if (!title) {
            achievementsSection.invalidRows += 1;
            this.pushPreviewError(achievementsSection.sampleErrors, row.rowNo, '成果名称不能为空');
            continue;
          }
          if (!description) {
            achievementsSection.invalidRows += 1;
            this.pushPreviewError(achievementsSection.sampleErrors, row.rowNo, '成果描述不能为空');
            continue;
          }
          achievementsSection.validRows += 1;
        }
      }

      const payload = this.buildPayload(input, peopleSection, achievementsSection);
      await this.audit.log({
        actorUserId: request.auth.userId,
        action: ACTION_PREVIEW,
        targetType: 'BULK_IMPORT',
        targetId: request.auth.userId,
        afterJson: payload,
      });
      return payload;
    });
  }

  private async executePeopleImport(request: any, input: ImportInput, baseUrl: string): Promise<ExecuteSection> {
    const result: ExecuteSection = {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      sampleErrors: [],
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    if (!input.peopleFileId) return result;

    const rows = (await this.readWorkbookRows(input.peopleFileId, 'PEOPLE')).rows;
    result.totalRows = rows.length;

    for (const row of rows) {
      const name = this.normalizePersonName(row.cols[0]);
      const position = this.normalizePosition(row.cols[1]);
      const organization = this.normalizeText(row.cols[2], 200);
      const serviceDirections = this.splitTags(row.cols[3]);
      const workHighlights = this.normalizeText(row.cols[4], 4000);
      const photoRaw = row.cols[5];
      const intro = workHighlights || organization;

      if (!name) {
        result.invalidRows += 1;
        result.skipped += 1;
        this.pushPreviewError(result.sampleErrors, row.rowNo, '姓名不能为空');
        continue;
      }
      if (!intro) {
        result.invalidRows += 1;
        result.skipped += 1;
        this.pushPreviewError(result.sampleErrors, row.rowNo, '简介与任职单位至少填写一个');
        continue;
      }
      result.validRows += 1;

      try {
        const existingVerification = await this.prisma.userVerification.findFirst({
          where: { verificationType: 'TECH_MANAGER', displayName: name },
          include: { user: true },
          orderBy: { submittedAt: 'desc' },
        });

        let user = existingVerification?.user || null;
        if (!user) {
          user = await this.prisma.user.findFirst({ where: { nickname: name }, orderBy: { createdAt: 'desc' } });
        }

        let createdUser = false;
        if (!user) {
          user = await this.prisma.user.create({
            data: { role: 'seller', nickname: name, phone: this.buildFakePhone(name, row.rowNo) },
          });
          createdUser = true;
        }

        const avatarUrl = this.normalizeImageUrl(photoRaw, baseUrl);
        if (avatarUrl || String(user.nickname || '').trim() !== name) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { nickname: name, ...(avatarUrl ? { avatarUrl } : {}) },
          });
        }

        const verification = await this.prisma.userVerification.findFirst({
          where: { userId: user.id, verificationType: 'TECH_MANAGER' },
          orderBy: { submittedAt: 'desc' },
        });

        if (verification) {
          await this.prisma.userVerification.update({
            where: { id: verification.id },
            data: {
              verificationStatus: 'APPROVED',
              displayName: name,
              intro,
              regionCode: input.defaultRegionCode,
              reviewedAt: new Date(),
            },
          });
        } else {
          await this.prisma.userVerification.create({
            data: {
              userId: user.id,
              verificationType: 'TECH_MANAGER',
              verificationStatus: 'APPROVED',
              displayName: name,
              intro,
              regionCode: input.defaultRegionCode,
              submittedAt: new Date(),
              reviewedAt: new Date(),
            },
          });
        }

        const existingProfile = await this.prisma.techManagerProfile.findUnique({ where: { userId: user.id } });
        const ratingData: { ratingScore?: number; ratingCount?: number } = {};
        const existingRatingCount = Number(existingProfile?.ratingCount ?? 0);
        if (input.ratingPolicy === 'FORCE_SET') {
          ratingData.ratingScore = input.defaultRatingScore;
          ratingData.ratingCount = input.defaultRatingCount;
        } else if (input.ratingPolicy === 'FILL_MISSING') {
          if (!Number.isFinite(existingRatingCount) || existingRatingCount <= 0) {
            ratingData.ratingScore = input.defaultRatingScore;
            ratingData.ratingCount = input.defaultRatingCount;
          }
        }

        await this.prisma.techManagerProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            intro,
            position,
            organization,
            serviceDirectionsJson: serviceDirections.length ? serviceDirections : Prisma.DbNull,
            serviceTagsJson: serviceDirections.length ? serviceDirections : Prisma.DbNull,
            workHighlights,
            ...ratingData,
          },
          update: {
            intro,
            position,
            organization,
            serviceDirectionsJson: serviceDirections.length ? serviceDirections : Prisma.DbNull,
            serviceTagsJson: serviceDirections.length ? serviceDirections : Prisma.DbNull,
            workHighlights,
            ...ratingData,
          },
        });

        if (createdUser) result.created += 1;
        else result.updated += 1;
      } catch (error: any) {
        result.failed += 1;
        this.pushPreviewError(result.sampleErrors, row.rowNo, error?.message || '导入失败');
      }
    }

    return result;
  }

  private async executeAchievementsImport(
    request: any,
    input: ImportInput,
    baseUrl: string,
    regionMatchers: RegionMatchers,
  ): Promise<ExecuteSection> {
    const result: ExecuteSection = {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      sampleErrors: [],
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
    if (!input.achievementsFileId) return result;

    const rows = (await this.readWorkbookRows(input.achievementsFileId, 'ACHIEVEMENTS')).rows;
    result.totalRows = rows.length;
    const coverFileCache = new Map<string, string | null>();

    for (const row of rows) {
      const rawExternalId = String(row.cols[0] || '').trim();
      const title = this.normalizeText(row.cols[1], 300);
      const rawCategory = this.normalizeText(row.cols[2], 200);
      const rawStatus = this.normalizeText(row.cols[3], 120);
      const rawRegion = this.normalizeText(row.cols[4], 120);
      const orgName = this.normalizeText(row.cols[5], 300);
      const description = this.normalizeText(row.cols[6], 12000);
      const rawImage = row.cols[7];

      if (!title) {
        result.invalidRows += 1;
        result.skipped += 1;
        this.pushPreviewError(result.sampleErrors, row.rowNo, '成果名称不能为空');
        continue;
      }
      if (!description) {
        result.invalidRows += 1;
        result.skipped += 1;
        this.pushPreviewError(result.sampleErrors, row.rowNo, '成果描述不能为空');
        continue;
      }
      result.validRows += 1;

      try {
        const externalId = this.buildAchievementExternalId(rawExternalId, title, orgName || '', row.rowNo);
        const maturity = this.mapMaturity(rawStatus);
        const regionCode = this.resolveRegionCode(rawRegion, input.defaultRegionCode, regionMatchers);
        const industryTags = this.splitTags(rawCategory);

        let coverFileId: string | null = null;
        const imageUrl = this.normalizeImageUrl(rawImage, baseUrl);
        if (imageUrl) {
          if (coverFileCache.has(imageUrl)) coverFileId = coverFileCache.get(imageUrl) || null;
          else {
            const createdCoverFileId = await this.ensureImageFileByUrl(request.auth.userId, imageUrl);
            coverFileCache.set(imageUrl, createdCoverFileId);
            coverFileId = createdCoverFileId;
          }
        }

        const existing = await this.prisma.achievement.findUnique({ where: { externalId } });
        const data = {
          publisherUserId: request.auth.userId,
          source: 'PLATFORM' as const,
          externalId,
          title,
          summary: description.slice(0, 240),
          description,
          maturity,
          regionCode,
          industryTagsJson: industryTags.length ? industryTags : Prisma.DbNull,
          keywordsJson: industryTags.length ? industryTags : Prisma.DbNull,
          coverFileId: coverFileId || undefined,
          auditStatus: 'APPROVED' as const,
          status: 'ACTIVE' as const,
          sourceRawCategory: rawCategory || undefined,
          sourceRawStatus: rawStatus || undefined,
          sourceBatch: input.sourceBatch,
          sourceRawRegion: rawRegion || undefined,
          sourceOrgName: orgName || undefined,
        };

        if (existing) {
          await this.prisma.achievement.update({ where: { id: existing.id }, data });
          result.updated += 1;
        } else {
          await this.prisma.achievement.create({ data });
          result.created += 1;
        }
      } catch (error: any) {
        result.failed += 1;
        this.pushPreviewError(result.sampleErrors, row.rowNo, error?.message || '导入失败');
      }
    }
    return result;
  }

  async executePeopleAchievements(request: any, body: any) {
    this.ensureAdmin(request);
    const input = this.parseRequest(body || {});
    const requestHash = this.hashPayload(input);

    return await this.withIdempotency(request, 'bulk-import:people-achievements:execute', requestHash, async () => {
      const baseUrl = String(process.env.BASE_URL || 'https://api.ipmoney.cn').replace(/\/$/, '');
      const regionRecords = await this.prisma.region.findMany({ select: { code: true, name: true } });
      const regionMatchers = this.buildRegionMatchers(regionRecords);

      const people = await this.executePeopleImport(request, input, baseUrl);
      const achievements = await this.executeAchievementsImport(request, input, baseUrl, regionMatchers);

      const payload = this.buildPayload(input, people, achievements);
      await this.audit.log({
        actorUserId: request.auth.userId,
        action: ACTION_EXECUTE,
        targetType: 'BULK_IMPORT',
        targetId: request.auth.userId,
        afterJson: payload,
      });
      return payload;
    });
  }

  async listPeopleAchievementsHistory(request: any, query: any) {
    this.ensureAdmin(request);

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const action = this.parseImportHistoryAction(query?.action);

    const where: any = {
      targetType: 'BULK_IMPORT',
      action:
        action === 'ALL'
          ? { in: [ACTION_PREVIEW, ACTION_EXECUTE] }
          : action === 'PREVIEW'
          ? ACTION_PREVIEW
          : ACTION_EXECUTE,
    };

    if (this.hasOwn(query, 'actorUserId')) {
      where.actorUserId = this.parseUuidStrict(query?.actorUserId, 'actorUserId');
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, nickname: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log: any) => {
        const afterJson = (log.afterJson || {}) as any;
        const input = (afterJson.input || {}) as any;
        const people = (afterJson.people || {}) as any;
        const achievements = (afterJson.achievements || {}) as any;
        return {
          id: log.id,
          action: log.action,
          actorUserId: log.actorUserId,
          actorName: String(log.actor?.nickname || '').trim() || undefined,
          actorPhone: String(log.actor?.phone || '').trim() || undefined,
          createdAt: log.createdAt.toISOString(),
          input: {
            peopleFileId: input.peopleFileId || null,
            achievementsFileId: input.achievementsFileId || null,
            sourceBatch: input.sourceBatch || null,
            defaultRegionCode: input.defaultRegionCode || null,
            ratingPolicy: input.ratingPolicy || null,
            defaultRatingScore: input.defaultRatingScore ?? null,
            defaultRatingCount: input.defaultRatingCount ?? null,
          },
          people: {
            totalRows: Number(people.totalRows || 0),
            validRows: Number(people.validRows || 0),
            invalidRows: Number(people.invalidRows || 0),
            created: Number(people.created || 0),
            updated: Number(people.updated || 0),
            skipped: Number(people.skipped || 0),
            failed: Number(people.failed || 0),
          },
          achievements: {
            totalRows: Number(achievements.totalRows || 0),
            validRows: Number(achievements.validRows || 0),
            invalidRows: Number(achievements.invalidRows || 0),
            created: Number(achievements.created || 0),
            updated: Number(achievements.updated || 0),
            skipped: Number(achievements.skipped || 0),
            failed: Number(achievements.failed || 0),
          },
        };
      }),
      page: { page, pageSize, total },
    };
  }
}
