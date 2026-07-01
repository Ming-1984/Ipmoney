import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { ContentMediaType, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveRegionCodeForStorage } from '../../common/region-code';
import { WechatContentSecurityService } from '../../common/wechat-content-security.service';
import {
  buildPublisherMap,
  mapContentMedia,
  mapStats,
  normalizeMediaInput,
  normalizeDisplayText,
  normalizeStringArray,
  resolvePublicFileUrl,
  sanitizeIndustryTagNames,
} from '../content-utils';

type ContentStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF';
type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ContentSource = 'USER' | 'PLATFORM' | 'ADMIN';
type AchievementMaturity =
  | 'CONCEPT'
  | 'PROTOTYPE'
  | 'PILOT'
  | 'MASS_PRODUCTION'
  | 'COMMERCIALIZED'
  | 'OTHER';
type ContentSortBy = 'RECOMMENDED' | 'NEWEST';
type ConsultChannel = 'FORM' | 'PHONE' | 'WECHAT_CS';

const STATUS_SET = new Set(['DRAFT', 'ACTIVE', 'OFF_SHELF']);
const AUDIT_STATUS_SET = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const SOURCE_SET = new Set(['USER', 'PLATFORM', 'ADMIN']);
const MATURITY_SET = new Set(['CONCEPT', 'PROTOTYPE', 'PILOT', 'MASS_PRODUCTION', 'COMMERCIALIZED', 'OTHER']);
const SORT_SET = new Set(['RECOMMENDED', 'NEWEST']);
const CONSULT_CHANNEL_SET = new Set(['FORM', 'PHONE', 'WECHAT_CS']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGION_CODE_RE = /^[0-9]{6}$/;

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: ContentEventService,
    private readonly contentSecurity: WechatContentSecurityService,
  ) {}

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableUuidStrict(value: unknown, fieldName: string): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (!UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseSetValueStrict(value: any, set: Set<string>, field: string) {
    const v = String(value || '').trim().toUpperCase();
    if (!set.has(v)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return v;
  }

  private parseStatusStrict(value: any, field: string): ContentStatus {
    return this.parseSetValueStrict(value, STATUS_SET, field) as ContentStatus;
  }

  private parseAuditStatusStrict(value: any, field: string): AuditStatus {
    return this.parseSetValueStrict(value, AUDIT_STATUS_SET, field) as AuditStatus;
  }

  private parseSourceStrict(value: any, field: string): ContentSource {
    return this.parseSetValueStrict(value, SOURCE_SET, field) as ContentSource;
  }

  private parseMaturityStrict(value: any, field: string): AchievementMaturity {
    return this.parseSetValueStrict(value, MATURITY_SET, field) as AchievementMaturity;
  }

  private parseNullableMaturityStrict(value: unknown, field: string): AchievementMaturity | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    return this.parseSetValueStrict(raw, MATURITY_SET, field) as AchievementMaturity;
  }

  private parseSortByStrict(value: any, field: string): ContentSortBy {
    return this.parseSetValueStrict(value, SORT_SET, field) as ContentSortBy;
  }

  private parseConsultChannelStrict(value: unknown, fieldName: string): ConsultChannel {
    return this.parseSetValueStrict(value, CONSULT_CHANNEL_SET, fieldName) as ConsultChannel;
  }

  private parseRegionCodeFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (!REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableRegionCodeStrict(value: unknown, fieldName: string): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (!REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableTrimmedString(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    return raw || null;
  }

  private normalizeKeywords(input: unknown) {
    return normalizeStringArray(input).slice(0, 30);
  }

  private normalizeCooperationModes(input: unknown) {
    return normalizeStringArray(input);
  }

  private async assertOwnedFiles(userId: string, fileIds: string[], label: string) {
    if (!fileIds || fileIds.length === 0) return;
    const files = await this.prisma.file.findMany({ where: { id: { in: fileIds } } });
    if (files.length !== fileIds.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${label} is invalid` });
    }
    const notOwned = files.filter((f: any) => String(f.ownerId || '') !== userId);
    if (notOwned.length > 0) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private buildPublisherFallback(userId: string) {
    return {
      userId,
      displayName: '',
      verificationType: null,
      verificationStatus: null,
      orgCategory: null,
      regionCode: null,
      logoUrl: null,
      intro: null,
      stats: undefined,
      verifiedAt: null,
    };
  }

  private resolvePublisherSummary(it: any, publisherMap: Record<string, any>) {
    const publisher = publisherMap[it.publisherUserId] ?? this.buildPublisherFallback(it.publisherUserId);
    const fallbackDisplayName = normalizeDisplayText(it?.sourceOrgName) ?? null;
    if (publisher?.displayName || !fallbackDisplayName) return publisher;
    return {
      ...publisher,
      displayName: fallbackDisplayName,
    };
  }

  private toSummaryDto(it: any, publisherMap: Record<string, any>) {
    return {
      id: it.id,
      source: it.source ?? 'USER',
      externalId: it.externalId ?? null,
      sourceRawCategory: it.sourceRawCategory ?? null,
      sourceRawStatus: it.sourceRawStatus ?? null,
      sourceBatch: it.sourceBatch ?? null,
      sourceRawRegion: it.sourceRawRegion ?? null,
      sourceOrgName: normalizeDisplayText(it.sourceOrgName) ?? null,
      title: it.title,
      summary: it.summary ?? null,
      maturity: it.maturity ?? null,
      cooperationModes: normalizeStringArray(it.cooperationModesJson),
      regionCode: it.regionCode ?? null,
      industryTags: sanitizeIndustryTagNames(it.industryTagsJson),
      keywords: normalizeStringArray(it.keywordsJson),
      publisher: this.resolvePublisherSummary(it, publisherMap),
      stats: mapStats(it.stats),
      auditStatus: it.auditStatus,
      status: it.status,
      coverUrl: resolvePublicFileUrl(it.coverFile),
      createdAt: it.createdAt.toISOString(),
    };
  }

  private toDetailDto(it: any, publisherMap: Record<string, any>) {
    return {
      ...this.toSummaryDto(it, publisherMap),
      description: it.description ?? null,
      media: mapContentMedia(it.media),
      aiParse: null,
    };
  }

  private toEditDto(it: any, publisherMap: Record<string, any>) {
    return {
      ...this.toSummaryDto(it, publisherMap),
      description: it.description ?? null,
      keywords: normalizeStringArray(it.keywordsJson),
      cooperationModes: normalizeStringArray(it.cooperationModesJson),
      coverFileId: it.coverFileId ?? null,
      media: mapContentMedia(it.media),
    };
  }

  private matchesSearchSummary(summary: any, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return true;

    const candidates = [
      normalizeDisplayText(summary?.title),
      normalizeDisplayText(summary?.summary),
      normalizeDisplayText(summary?.sourceOrgName),
      normalizeDisplayText(summary?.publisher?.displayName),
      normalizeDisplayText(summary?.publisher?.intro),
      normalizeDisplayText(summary?.externalId),
      normalizeDisplayText(summary?.sourceRawCategory),
      normalizeDisplayText(summary?.sourceRawStatus),
      normalizeDisplayText(summary?.sourceBatch),
      normalizeDisplayText(summary?.sourceRawRegion),
      normalizeDisplayText(summary?.regionCode),
      normalizeDisplayText(summary?.maturity),
      ...normalizeStringArray(summary?.keywords),
      ...normalizeStringArray(summary?.industryTags),
      ...normalizeStringArray(summary?.cooperationModes),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return candidates.some((candidate) => candidate.includes(normalizedKeyword));
  }

  private scoreSearchSummary(summary: any, keyword: string): number {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return 0;

    const title = normalizeDisplayText(summary?.title)?.toLowerCase() ?? '';
    const sourceOrgName = normalizeDisplayText(summary?.sourceOrgName)?.toLowerCase() ?? '';
    const publisherDisplayName = normalizeDisplayText(summary?.publisher?.displayName)?.toLowerCase() ?? '';
    const summaryText = normalizeDisplayText(summary?.summary)?.toLowerCase() ?? '';
    const externalId = normalizeDisplayText(summary?.externalId)?.toLowerCase() ?? '';
    const keywords = normalizeStringArray(summary?.keywords).map((item) => item.toLowerCase());
    const industryTags = normalizeStringArray(summary?.industryTags).map((item) => item.toLowerCase());
    const cooperationModes = normalizeStringArray(summary?.cooperationModes).map((item) => item.toLowerCase());

    let score = 0;

    if (title === normalizedKeyword) score += 1200;
    else if (title.startsWith(normalizedKeyword)) score += 1000;
    else if (title.includes(normalizedKeyword)) score += 800;

    const shouldScorePublisherDisplayName = Boolean(publisherDisplayName) && publisherDisplayName !== sourceOrgName;
    if (shouldScorePublisherDisplayName) {
      if (publisherDisplayName === normalizedKeyword) score += 900;
      else if (publisherDisplayName.startsWith(normalizedKeyword)) score += 760;
      else if (publisherDisplayName.includes(normalizedKeyword)) score += 580;
    }

    if (sourceOrgName === normalizedKeyword) score += 860;
    else if (sourceOrgName.startsWith(normalizedKeyword)) score += 720;
    else if (sourceOrgName.includes(normalizedKeyword)) score += 520;

    if (externalId === normalizedKeyword) score += 320;
    else if (externalId.includes(normalizedKeyword)) score += 220;

    if (summaryText.includes(normalizedKeyword)) score += 120;
    if (keywords.some((item) => item === normalizedKeyword)) score += 220;
    else if (keywords.some((item) => item.includes(normalizedKeyword))) score += 140;

    if (industryTags.some((item) => item === normalizedKeyword)) score += 180;
    else if (industryTags.some((item) => item.includes(normalizedKeyword))) score += 100;

    if (cooperationModes.some((item) => item.includes(normalizedKeyword))) score += 70;

    return score;
  }

  private hasStrongSearchMatch(summary: any, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return false;

    const title = normalizeDisplayText(summary?.title)?.toLowerCase() ?? '';
    const sourceOrgName = normalizeDisplayText(summary?.sourceOrgName)?.toLowerCase() ?? '';
    const publisherDisplayName = normalizeDisplayText(summary?.publisher?.displayName)?.toLowerCase() ?? '';

    return (
      (Boolean(title) && (title === normalizedKeyword || title.startsWith(normalizedKeyword))) ||
      (Boolean(sourceOrgName) && (sourceOrgName === normalizedKeyword || sourceOrgName.startsWith(normalizedKeyword))) ||
      (Boolean(publisherDisplayName) &&
        (publisherDisplayName === normalizedKeyword || publisherDisplayName.startsWith(normalizedKeyword)))
    );
  }

  private paginateItems<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
  }

  private compareCreatedAtDesc(a: { createdAt?: string | null }, b: { createdAt?: string | null }): number {
    const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  }

  private comparePublicBaseOrder(a: any, b: any, sortBy: ContentSortBy): number {
    if (sortBy === 'RECOMMENDED') {
      const consultDiff = (b?.stats?.consultCount ?? 0) - (a?.stats?.consultCount ?? 0);
      if (consultDiff !== 0) return consultDiff;
      const favoriteDiff = (b?.stats?.favoriteCount ?? 0) - (a?.stats?.favoriteCount ?? 0);
      if (favoriteDiff !== 0) return favoriteDiff;
      const viewDiff = (b?.stats?.viewCount ?? 0) - (a?.stats?.viewCount ?? 0);
      if (viewDiff !== 0) return viewDiff;
    }
    return this.compareCreatedAtDesc(a, b);
  }

  async listAdmin(query: any) {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const q = String(query?.q || '').trim();

    const hasAuditStatus = this.hasOwn(query, 'auditStatus');
    const hasStatus = this.hasOwn(query, 'status');
    const hasSource = this.hasOwn(query, 'source');
    const hasPublisherUserId = this.hasOwn(query, 'publisherUserId');
    const hasRegionCode = this.hasOwn(query, 'regionCode');

    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(query?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseStatusStrict(query?.status, 'status') : undefined;
    const source = hasSource ? this.parseSourceStrict(query?.source, 'source') : undefined;
    const publisherUserId = hasPublisherUserId
      ? this.parseUuidStrict(query?.publisherUserId, 'publisherUserId')
      : undefined;
    const regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : undefined;

    const where: any = {};
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) where.status = status;
    if (source) where.source = source;
    if (publisherUserId) where.publisherUserId = publisherUserId;
    if (regionCode) where.regionCode = regionCode;
    if (q) {
      const rows = await this.prisma.achievement.findMany({
        where,
        include: { stats: true, coverFile: true },
        orderBy: { createdAt: 'desc' },
      });
      const publisherMap = await buildPublisherMap(
        this.prisma,
        rows.map((item) => item.publisherUserId),
      );
      const summaries = rows.map((item) => this.toSummaryDto(item, publisherMap));
      const matched = summaries.filter((item) => this.matchesSearchSummary(item, q));
      const strongMatches = matched.filter((item) => this.hasStrongSearchMatch(item, q));
      const searchPool = strongMatches.length ? strongMatches : matched;
      const ordered = [...searchPool].sort((a, b) => {
        const scoreDiff = this.scoreSearchSummary(b, q) - this.scoreSearchSummary(a, q);
        if (scoreDiff !== 0) return scoreDiff;
        return this.compareCreatedAtDesc(a, b);
      });
      const paginated = this.paginateItems(ordered, page, pageSize);
      return {
        items: paginated.items,
        page: { page, pageSize, total: paginated.total },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        include: { stats: true, coverFile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.achievement.count({ where }),
    ]);

    const publisherMap = await buildPublisherMap(
      this.prisma,
      items.map((item) => item.publisherUserId),
    );

    return {
      items: items.map((item) => this.toSummaryDto(item, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async adminCreate(req: any, body: any) {
    this.ensureAdmin(req);
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const source = this.hasOwn(body, 'source') ? this.parseSourceStrict(body?.source, 'source') : 'ADMIN';
    const publisherUserId = this.hasOwn(body, 'publisherUserId')
      ? this.parseUuidStrict(body?.publisherUserId, 'publisherUserId')
      : req?.auth?.userId;
    const auditStatus = this.hasOwn(body, 'auditStatus')
      ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus')
      : 'PENDING';
    const status = this.hasOwn(body, 'status') ? this.parseStatusStrict(body?.status, 'status') : 'DRAFT';

    const summary = this.parseNullableTrimmedString(body?.summary);
    const description = this.parseNullableTrimmedString(body?.description);
    const maturity = this.hasOwn(body, 'maturity') ? this.parseNullableMaturityStrict(body?.maturity, 'maturity') : null;
    const regionCode = this.hasOwn(body, 'regionCode')
      ? await resolveRegionCodeForStorage(this.prisma, body?.regionCode, 'regionCode', { allowEmpty: true })
      : null;

    const industryTags = sanitizeIndustryTagNames(body?.industryTags);
    const keywords = this.normalizeKeywords(body?.keywords);
    const cooperationModes = this.normalizeCooperationModes(body?.cooperationModes);
    const coverFileId = this.hasOwn(body, 'coverFileId')
      ? this.parseNullableUuidStrict(body?.coverFileId, 'coverFileId')
      : null;
    const externalId = this.hasOwn(body, 'externalId') ? this.parseNullableTrimmedString(body?.externalId) : null;
    const sourceRawCategory = this.hasOwn(body, 'sourceRawCategory')
      ? this.parseNullableTrimmedString(body?.sourceRawCategory)
      : null;
    const sourceRawStatus = this.hasOwn(body, 'sourceRawStatus')
      ? this.parseNullableTrimmedString(body?.sourceRawStatus)
      : null;
    const sourceBatch = this.hasOwn(body, 'sourceBatch') ? this.parseNullableTrimmedString(body?.sourceBatch) : null;
    const sourceRawRegion = this.hasOwn(body, 'sourceRawRegion')
      ? this.parseNullableTrimmedString(body?.sourceRawRegion)
      : null;
    const sourceOrgName = this.hasOwn(body, 'sourceOrgName') ? this.parseNullableTrimmedString(body?.sourceOrgName) : null;
    const mediaInput: Array<{ fileId: string; type: ContentMediaType; sort: number }> = this.hasOwn(body, 'media')
      ? normalizeMediaInput(body?.media)
      : [];

    const created = await this.prisma.achievement.create({
      data: {
        publisherUserId,
        source,
        externalId: externalId ?? undefined,
        sourceRawCategory: sourceRawCategory ?? undefined,
        sourceRawStatus: sourceRawStatus ?? undefined,
        sourceBatch: sourceBatch ?? undefined,
        sourceRawRegion: sourceRawRegion ?? undefined,
        sourceOrgName: sourceOrgName ?? undefined,
        title,
        summary,
        description,
        maturity,
        regionCode,
        auditStatus,
        status,
        coverFileId,
        industryTagsJson: industryTags.length ? industryTags : Prisma.DbNull,
        keywordsJson: keywords.length ? keywords : Prisma.DbNull,
        cooperationModesJson: cooperationModes.length ? cooperationModes : Prisma.DbNull,
        media: mediaInput.length
          ? {
              createMany: {
                data: mediaInput.map((m) => ({ fileId: m.fileId, type: m.type as ContentMediaType, sort: m.sort })),
              },
            }
          : undefined,
      },
      include: { stats: true, coverFile: true, media: { include: { file: true } } },
    });

    const publisherMap = await buildPublisherMap(this.prisma, [created.publisherUserId]);
    return this.toEditDto(created, publisherMap);
  }

  async listMine(req: any, query: any) {
    this.ensureAuth(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasAuditStatus = this.hasOwn(query, 'auditStatus');
    const hasStatus = this.hasOwn(query, 'status');
    const hasExcludeStatus = this.hasOwn(query, 'excludeStatus');
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(query?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseStatusStrict(query?.status, 'status') : undefined;
    const excludeStatus = hasExcludeStatus ? this.parseStatusStrict(query?.excludeStatus, 'excludeStatus') : undefined;

    const where: any = { publisherUserId: req.auth.userId };
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) {
      where.status = status;
    } else if (excludeStatus) {
      where.status = { not: excludeStatus };
    }

    const [items, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        include: { stats: true, coverFile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.achievement.count({ where }),
    ]);

    const publisherMap = await buildPublisherMap(
      this.prisma,
      items.map((item) => item.publisherUserId),
    );

    return {
      items: items.map((item) => this.toSummaryDto(item, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async getMine(req: any, achievementId: string) {
    this.ensureAuth(req);
    const it = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      include: { stats: true, coverFile: true, media: { include: { file: true } } },
    });
    if (!it || it.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    }
    const publisherMap = await buildPublisherMap(this.prisma, [it.publisherUserId]);
    return this.toEditDto(it, publisherMap);
  }

  async createAchievement(req: any, body: any) {
    this.ensureAuth(req);
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const summary = this.parseNullableTrimmedString(body?.summary);
    const description = this.parseNullableTrimmedString(body?.description);
    const maturity = this.hasOwn(body, 'maturity') ? this.parseNullableMaturityStrict(body?.maturity, 'maturity') : null;
    const regionCode = this.hasOwn(body, 'regionCode')
      ? await resolveRegionCodeForStorage(this.prisma, body?.regionCode, 'regionCode', { allowEmpty: true })
      : null;
    const industryTags = sanitizeIndustryTagNames(body?.industryTags);
    const keywords = this.normalizeKeywords(body?.keywords);
    const cooperationModes = this.normalizeCooperationModes(body?.cooperationModes);
    const coverFileId = this.hasOwn(body, 'coverFileId')
      ? this.parseNullableUuidStrict(body?.coverFileId, 'coverFileId')
      : null;
    const mediaInput: Array<{ fileId: string; type: ContentMediaType; sort: number }> = this.hasOwn(body, 'media')
      ? normalizeMediaInput(body?.media)
      : [];

    const ownedFileIds = [
      ...(coverFileId ? [coverFileId] : []),
      ...mediaInput.map((m) => m.fileId),
    ];
    await this.assertOwnedFiles(req.auth.userId, ownedFileIds, 'media');
    await this.contentSecurity.assertSafeTexts([title, summary, description, ...keywords], {
      requestMeta: {
        actorUserId: req.auth.userId,
        targetType: 'ACHIEVEMENT',
        targetId: req.auth.userId,
      },
    });
    await this.contentSecurity.ensureReferencedFilesReady({
      userId: req.auth.userId,
      fileIds: ownedFileIds,
      label: 'achievement media',
      allowPending: true,
      requestMeta: {
        actorUserId: req.auth.userId,
        targetType: 'ACHIEVEMENT',
        targetId: req.auth.userId,
      },
    });

    const created = await this.prisma.achievement.create({
      data: {
        publisherUserId: req.auth.userId,
        source: 'USER',
        title,
        summary,
        description,
        maturity,
        regionCode,
        auditStatus: 'PENDING',
        status: 'DRAFT',
        coverFileId,
        industryTagsJson: industryTags.length ? industryTags : Prisma.DbNull,
        keywordsJson: keywords.length ? keywords : Prisma.DbNull,
        cooperationModesJson: cooperationModes.length ? cooperationModes : Prisma.DbNull,
        media: mediaInput.length
          ? {
              createMany: {
                data: mediaInput.map((m) => ({ fileId: m.fileId, type: m.type as ContentMediaType, sort: m.sort })),
              },
            }
          : undefined,
      },
      include: { stats: true, coverFile: true, media: { include: { file: true } } },
    });

    const publisherMap = await buildPublisherMap(this.prisma, [created.publisherUserId]);
    return this.toEditDto(created, publisherMap);
  }

  async updateAchievement(req: any, achievementId: string, body: any) {
    this.ensureAuth(req);
    const it = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!it || it.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    }

    const hasTitle = this.hasOwn(body, 'title');
    const title = hasTitle ? String(body?.title || '').trim() : it.title;
    if (hasTitle && !title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const summary = this.hasOwn(body, 'summary') ? this.parseNullableTrimmedString(body?.summary) : it.summary ?? null;
    const description = this.hasOwn(body, 'description')
      ? this.parseNullableTrimmedString(body?.description)
      : it.description ?? null;
    const maturity = this.hasOwn(body, 'maturity')
      ? this.parseNullableMaturityStrict(body?.maturity, 'maturity')
      : it.maturity ?? null;
    const regionCode = this.hasOwn(body, 'regionCode')
      ? await resolveRegionCodeForStorage(this.prisma, body?.regionCode, 'regionCode', { allowEmpty: true })
      : it.regionCode ?? null;
    const industryTags = this.hasOwn(body, 'industryTags')
      ? sanitizeIndustryTagNames(body?.industryTags)
      : sanitizeIndustryTagNames(it.industryTagsJson);
    const keywords = this.hasOwn(body, 'keywords') ? this.normalizeKeywords(body?.keywords) : normalizeStringArray(it.keywordsJson);
    const cooperationModes = this.hasOwn(body, 'cooperationModes')
      ? this.normalizeCooperationModes(body?.cooperationModes)
      : normalizeStringArray(it.cooperationModesJson);
    const coverFileId = this.hasOwn(body, 'coverFileId')
      ? this.parseNullableUuidStrict(body?.coverFileId, 'coverFileId')
      : it.coverFileId ?? null;
    const mediaInput: Array<{ fileId: string; type: ContentMediaType; sort: number }> | undefined = this.hasOwn(
      body,
      'media',
    )
      ? normalizeMediaInput(body?.media)
      : undefined;

    const ownedFileIds = [
      ...(coverFileId ? [coverFileId] : []),
      ...(mediaInput ? mediaInput.map((m) => m.fileId) : []),
    ];
    await this.assertOwnedFiles(req.auth.userId, ownedFileIds, 'media');
    await this.contentSecurity.assertSafeTexts([title, summary, description, ...keywords], {
      requestMeta: {
        actorUserId: req.auth.userId,
        targetType: 'ACHIEVEMENT',
        targetId: achievementId,
      },
    });
    await this.contentSecurity.ensureReferencedFilesReady({
      userId: req.auth.userId,
      fileIds: ownedFileIds,
      label: 'achievement media',
      allowPending: true,
      requestMeta: {
        actorUserId: req.auth.userId,
        targetType: 'ACHIEVEMENT',
        targetId: achievementId,
      },
    });

    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: {
        title,
        summary,
        description,
        maturity,
        regionCode,
        coverFileId,
        industryTagsJson: industryTags.length ? industryTags : Prisma.DbNull,
        keywordsJson: keywords.length ? keywords : Prisma.DbNull,
        cooperationModesJson: cooperationModes.length ? cooperationModes : Prisma.DbNull,
      },
    });

    if (mediaInput) {
      await this.prisma.achievementMedia.deleteMany({ where: { achievementId } });
      if (mediaInput.length) {
        await this.prisma.achievementMedia.createMany({
          data: mediaInput.map((m) => ({
            achievementId,
            fileId: m.fileId,
            type: m.type as ContentMediaType,
            sort: m.sort,
          })),
        });
      }
    }

    const withMedia = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      include: { stats: true, coverFile: true, media: { include: { file: true } } },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.toEditDto(withMedia, publisherMap);
  }

  async submitAchievement(req: any, achievementId: string) {
    this.ensureAuth(req);
    const it = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!it || it.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    }
    const media = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      select: {
        coverFileId: true,
        media: { select: { fileId: true } },
        title: true,
        summary: true,
        description: true,
        keywordsJson: true,
      },
    });
    await this.contentSecurity.assertSafeTexts(
      [media?.title, media?.summary, media?.description, ...normalizeStringArray(media?.keywordsJson)],
      {
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'ACHIEVEMENT',
          targetId: achievementId,
        },
      },
    );
    await this.contentSecurity.ensureReferencedFilesReady({
      userId: req.auth.userId,
      fileIds: [
        ...(media?.coverFileId ? [media.coverFileId] : []),
        ...((media?.media || []).map((item: any) => String(item.fileId || ''))),
      ],
      label: 'achievement media',
      allowPending: true,
      requestMeta: {
        actorUserId: req.auth.userId,
        targetType: 'ACHIEVEMENT',
        targetId: achievementId,
      },
    });

    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { auditStatus: 'PENDING', status: 'ACTIVE' },
    });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ACHIEVEMENT_SUBMIT',
      targetType: 'ACHIEVEMENT',
      targetId: achievementId,
      afterJson: { auditStatus: 'PENDING' },
    });
    return updated;
  }

  async offShelf(req: any, achievementId: string) {
    this.ensureAuth(req);
    const it = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!it || it.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    }
    return await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { status: 'OFF_SHELF' },
    });
  }

  async searchPublic(query: any) {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const q = String(query?.q || '').trim();
    const hasSortBy = this.hasOwn(query, 'sortBy');
    const sortBy = hasSortBy ? this.parseSortByStrict(query?.sortBy, 'sortBy') : 'NEWEST';
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    const regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : '';
    const hasMaturity = this.hasOwn(query, 'maturity');
    const maturity = hasMaturity ? this.parseMaturityStrict(query?.maturity, 'maturity') : undefined;
    const industryTags = sanitizeIndustryTagNames(query?.industryTags);

    const where: any = { auditStatus: 'APPROVED', status: 'ACTIVE' };
    if (regionCode) where.regionCode = regionCode;
    if (maturity) where.maturity = maturity;
    if (industryTags.length > 0) where.industryTagsJson = { array_contains: industryTags };
    const orderBy: Prisma.AchievementOrderByWithRelationInput[] =
      sortBy === 'RECOMMENDED'
        ? [
            { stats: { consultCount: Prisma.SortOrder.desc } },
            { stats: { favoriteCount: Prisma.SortOrder.desc } },
            { stats: { viewCount: Prisma.SortOrder.desc } },
            { createdAt: Prisma.SortOrder.desc },
          ]
        : [{ createdAt: Prisma.SortOrder.desc }];

    if (q) {
      const rows = await this.prisma.achievement.findMany({
        where,
        include: { stats: true, coverFile: true },
        orderBy,
      });
      const publisherMap = await buildPublisherMap(
        this.prisma,
        rows.map((item) => item.publisherUserId),
      );
      const summaries = rows.map((item) => this.toSummaryDto(item, publisherMap));
      const matched = summaries.filter((item) => this.matchesSearchSummary(item, q));
      const strongMatches = matched.filter((item) => this.hasStrongSearchMatch(item, q));
      const searchPool = strongMatches.length ? strongMatches : matched;
      const ordered = [...searchPool].sort((a, b) => {
        const scoreDiff = this.scoreSearchSummary(b, q) - this.scoreSearchSummary(a, q);
        if (scoreDiff !== 0) return scoreDiff;
        return this.comparePublicBaseOrder(a, b, sortBy);
      });
      const paginated = this.paginateItems(ordered, page, pageSize);
      return {
        items: paginated.items,
        page: { page, pageSize, total: paginated.total },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        include: { stats: true, coverFile: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.achievement.count({ where }),
    ]);

    const publisherMap = await buildPublisherMap(
      this.prisma,
      items.map((item) => item.publisherUserId),
    );

    return {
      items: items.map((item) => this.toSummaryDto(item, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async getPublicById(req: any, achievementId: string) {
    const it = await this.prisma.achievement.findFirst({
      where: {
        id: achievementId,
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      },
      include: { stats: true, coverFile: true, media: { include: { file: true } } },
    });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    void this.events.recordView(req, 'ACHIEVEMENT', achievementId).catch(() => {});
    const publisherMap = await buildPublisherMap(this.prisma, [it.publisherUserId]);
    return this.toDetailDto(it, publisherMap);
  }

  async getAdminById(achievementId: string) {
    const it = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      include: { stats: true, coverFile: true, media: { include: { file: true } } },
    });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [it.publisherUserId]);
    return this.toEditDto(it, publisherMap);
  }

  async adminUpdate(req: any, achievementId: string, body: any) {
    this.ensureAdmin(req);
    const it = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });

    const hasTitle = this.hasOwn(body, 'title');
    const title = hasTitle ? String(body?.title || '').trim() : it.title;
    if (hasTitle && !title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const summary = this.hasOwn(body, 'summary') ? this.parseNullableTrimmedString(body?.summary) : it.summary ?? null;
    const description = this.hasOwn(body, 'description')
      ? this.parseNullableTrimmedString(body?.description)
      : it.description ?? null;
    const maturity = this.hasOwn(body, 'maturity')
      ? this.parseNullableMaturityStrict(body?.maturity, 'maturity')
      : it.maturity ?? null;
    const regionCode = this.hasOwn(body, 'regionCode')
      ? await resolveRegionCodeForStorage(this.prisma, body?.regionCode, 'regionCode', { allowEmpty: true })
      : it.regionCode ?? null;
    const industryTags = this.hasOwn(body, 'industryTags')
      ? sanitizeIndustryTagNames(body?.industryTags)
      : sanitizeIndustryTagNames(it.industryTagsJson);
    const keywords = this.hasOwn(body, 'keywords') ? this.normalizeKeywords(body?.keywords) : normalizeStringArray(it.keywordsJson);
    const cooperationModes = this.hasOwn(body, 'cooperationModes')
      ? this.normalizeCooperationModes(body?.cooperationModes)
      : normalizeStringArray(it.cooperationModesJson);
    const coverFileId = this.hasOwn(body, 'coverFileId')
      ? this.parseNullableUuidStrict(body?.coverFileId, 'coverFileId')
      : it.coverFileId ?? null;
    const mediaInput: Array<{ fileId: string; type: ContentMediaType; sort: number }> | undefined = this.hasOwn(
      body,
      'media',
    )
      ? normalizeMediaInput(body?.media)
      : undefined;
    const source = this.hasOwn(body, 'source') ? this.parseSourceStrict(body?.source, 'source') : it.source;
    const publisherUserId = this.hasOwn(body, 'publisherUserId')
      ? this.parseUuidStrict(body?.publisherUserId, 'publisherUserId')
      : it.publisherUserId;
    const auditStatus = this.hasOwn(body, 'auditStatus')
      ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus')
      : it.auditStatus;
    const status = this.hasOwn(body, 'status') ? this.parseStatusStrict(body?.status, 'status') : it.status;
    const externalId = this.hasOwn(body, 'externalId')
      ? this.parseNullableTrimmedString(body?.externalId)
      : it.externalId ?? null;
    const sourceRawCategory = this.hasOwn(body, 'sourceRawCategory')
      ? this.parseNullableTrimmedString(body?.sourceRawCategory)
      : it.sourceRawCategory ?? null;
    const sourceRawStatus = this.hasOwn(body, 'sourceRawStatus')
      ? this.parseNullableTrimmedString(body?.sourceRawStatus)
      : it.sourceRawStatus ?? null;
    const sourceBatch = this.hasOwn(body, 'sourceBatch')
      ? this.parseNullableTrimmedString(body?.sourceBatch)
      : it.sourceBatch ?? null;
    const sourceRawRegion = this.hasOwn(body, 'sourceRawRegion')
      ? this.parseNullableTrimmedString(body?.sourceRawRegion)
      : it.sourceRawRegion ?? null;
    const sourceOrgName = this.hasOwn(body, 'sourceOrgName')
      ? this.parseNullableTrimmedString(body?.sourceOrgName)
      : it.sourceOrgName ?? null;

    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: {
        externalId,
        sourceRawCategory,
        sourceRawStatus,
        sourceBatch,
        sourceRawRegion,
        sourceOrgName,
        title,
        summary,
        description,
        maturity,
        regionCode,
        coverFileId,
        industryTagsJson: industryTags.length ? industryTags : Prisma.DbNull,
        keywordsJson: keywords.length ? keywords : Prisma.DbNull,
        cooperationModesJson: cooperationModes.length ? cooperationModes : Prisma.DbNull,
        source,
        publisherUserId,
        auditStatus,
        status,
      },
    });

    if (mediaInput) {
      await this.prisma.achievementMedia.deleteMany({ where: { achievementId } });
      if (mediaInput.length) {
        await this.prisma.achievementMedia.createMany({
          data: mediaInput.map((m) => ({
            achievementId,
            fileId: m.fileId,
            type: m.type as ContentMediaType,
            sort: m.sort,
          })),
        });
      }
    }

    const withMedia = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      include: { stats: true, coverFile: true, media: { include: { file: true } } },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.toEditDto(withMedia, publisherMap);
  }

  async adminPublish(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const it = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    return await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { status: 'ACTIVE', auditStatus: 'APPROVED' },
    });
  }

  async adminOffShelf(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const it = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    return await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { status: 'OFF_SHELF' },
    });
  }

  async approve(achievementId: string, reviewerId: string | null, reason?: string) {
    let it: any;
    try {
      it = await this.prisma.achievement.update({
        where: { id: achievementId },
        data: { auditStatus: 'APPROVED' },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
      }
      throw error;
    }
    if (reviewerId) {
      await this.audit.log({
        actorUserId: reviewerId,
        action: 'ACHIEVEMENT_APPROVE',
        targetType: 'ACHIEVEMENT',
        targetId: achievementId,
        afterJson: { auditStatus: 'APPROVED', reason },
      });
    }
    return it;
  }

  async reject(achievementId: string, reviewerId: string | null, reason?: string) {
    let it: any;
    try {
      it = await this.prisma.achievement.update({
        where: { id: achievementId },
        data: { auditStatus: 'REJECTED' },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
      }
      throw error;
    }
    if (reviewerId) {
      await this.audit.log({
        actorUserId: reviewerId,
        action: 'ACHIEVEMENT_REJECT',
        targetType: 'ACHIEVEMENT',
        targetId: achievementId,
        afterJson: { auditStatus: 'REJECTED', reason },
      });
    }
    return it;
  }

  async createConsultation(req: any, achievementId: string, payload: any) {
    this.ensureAuth(req);
    const it = await this.prisma.achievement.findFirst({
      where: {
        id: achievementId,
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      },
    });
    if (!it) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const hasChannel = this.hasOwn(payload, 'channel');
    if (hasChannel) {
      this.parseConsultChannelStrict(payload?.channel, 'channel');
    }
    await this.events.recordConsult(req, 'ACHIEVEMENT', achievementId);
    return { ok: true };
  }
}
