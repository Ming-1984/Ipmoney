import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AchievementMaturity, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  buildPublisherMap,
  mapContentMedia,
  mapStats,
  normalizeMediaInput,
  normalizeStringArray,
  sanitizeIndustryTagNames,
} from '../content-utils';
import { ConfigService, type RecommendationConfig } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

type AchievementRecord = {
  id: string;
  publisherUserId: string;
  source?: string | null;
  title: string;
  summary?: string | null;
  description?: string | null;
  keywordsJson?: unknown;
  maturity?: string | null;
  cooperationModesJson?: unknown;
  coverFileId?: string | null;
  regionCode?: string | null;
  industryTagsJson?: unknown;
  auditStatus: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  coverFile?: { url?: string | null } | null;
  media?: Array<{ fileId: string; type: string; sort: number; file?: any }>;
  stats?: { viewCount?: number; favoriteCount?: number; consultCount?: number; commentCount?: number } | null;
};

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly events: ContentEventService,
    private readonly config: ConfigService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '鏃犳潈闄?' });
  }

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '鏃犳潈闄?' });
  }

  private normalizeContentSource(value: unknown): 'USER' | 'ADMIN' | 'PLATFORM' | undefined {
    const source = String(value || '').trim().toUpperCase();
    if (source === 'USER' || source === 'ADMIN' || source === 'PLATFORM') return source as 'USER' | 'ADMIN' | 'PLATFORM';
    return undefined;
  }

  private normalizeContentStatus(value: unknown): 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | undefined {
    const status = String(value || '').trim().toUpperCase();
    if (status === 'DRAFT' || status === 'ACTIVE' || status === 'OFF_SHELF') {
      return status as 'DRAFT' | 'ACTIVE' | 'OFF_SHELF';
    }
    return undefined;
  }

  private normalizeAuditStatus(value: unknown): 'PENDING' | 'APPROVED' | 'REJECTED' | undefined {
    const status = String(value || '').trim().toUpperCase();
    if (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') {
      return status as 'PENDING' | 'APPROVED' | 'REJECTED';
    }
    return undefined;
  }

  private normalizeMaturity(value: unknown): AchievementMaturity | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return undefined;
    const allowed = ['CONCEPT', 'PROTOTYPE', 'PILOT', 'MASS_PRODUCTION', 'COMMERCIALIZED', 'OTHER'];
    return allowed.includes(v) ? (v as AchievementMaturity) : undefined;
  }

  private hasOwn(body: any, key: string) {
    return Object.prototype.hasOwnProperty.call(body || {}, key);
  }

  private parseNullableRegionCodeStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableCoverFileIdStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableNonEmptyStringStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseOptionalNonEmptyStringStrict(value: unknown, fieldName: string): string | undefined {
    if (value === undefined) return undefined;
    if (value === null) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const raw = String(value).trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseOptionalPublisherUserIdStrict(body: any): string | undefined {
    const candidateKeys: Array<'publisherUserId' | 'ownerId'> = ['publisherUserId', 'ownerId'];
    for (const key of candidateKeys) {
      if (!this.hasOwn(body, key)) continue;
      const value = body?.[key];
      if (value === null || value === undefined) continue;
      const raw = String(value).trim();
      if (!raw) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${key} is invalid` });
      }
      return raw;
    }
    return undefined;
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseContentSourceStrict(value: unknown, fieldName: string): 'USER' | 'ADMIN' | 'PLATFORM' {
    const normalized = this.normalizeContentSource(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseContentStatusStrict(value: unknown, fieldName: string): 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' {
    const normalized = this.normalizeContentStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseAuditStatusStrict(value: unknown, fieldName: string): 'PENDING' | 'APPROVED' | 'REJECTED' {
    const normalized = this.normalizeAuditStatus(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseNullableMaturityStrict(value: unknown, fieldName: string): AchievementMaturity | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const normalized = this.normalizeMaturity(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseContentSortByStrict(value: unknown, fieldName: string): 'RECOMMENDED' | 'NEWEST' {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'RECOMMENDED' || normalized === 'NEWEST') {
      return normalized as 'RECOMMENDED' | 'NEWEST';
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private asArray(value: unknown): string[] {
    return Array.isArray(value) ? (value as string[]) : [];
  }

  private normalizeWeight(value: unknown, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  private computeRecommendationScore(
    item: { createdAt?: Date; regionCode?: string | null; stats?: any },
    config: RecommendationConfig,
    regionCode: string | null,
    nowMs: number,
  ) {
    const weights = config?.weights || {
      time: 1,
      view: 1,
      favorite: 1,
      consult: 1,
      region: 0,
      user: 0,
    };
    const timeWeight = this.normalizeWeight(weights.time, 0);
    const viewWeight = this.normalizeWeight(weights.view, 0);
    const favoriteWeight = this.normalizeWeight(weights.favorite, 0);
    const consultWeight = this.normalizeWeight(weights.consult, 0);
    const regionWeight = this.normalizeWeight(weights.region, 0);
    const userWeight = this.normalizeWeight(weights.user, 0);

    const halfLifeHours = Math.max(1, this.normalizeWeight(config?.timeDecayHalfLifeHours, 72));
    const createdAt = item?.createdAt instanceof Date ? item.createdAt.getTime() : nowMs;
    const ageHours = Math.max(0, (nowMs - createdAt) / (1000 * 3600));
    const decay = Math.pow(0.5, ageHours / halfLifeHours);

    const stats = item?.stats ?? {};
    const viewCount = Math.max(0, this.normalizeWeight(stats.viewCount, 0));
    const favoriteCount = Math.max(0, this.normalizeWeight(stats.favoriteCount, 0));
    const consultCount = Math.max(0, this.normalizeWeight(stats.consultCount, 0));

    const normalizedRegion = regionCode ? String(regionCode) : '';
    const regionMatch = normalizedRegion && item?.regionCode === normalizedRegion ? 1 : 0;
    const tagSimilarity = 0;

    return (
      timeWeight * decay +
      viewWeight * Math.log1p(viewCount) +
      favoriteWeight * Math.log1p(favoriteCount) +
      consultWeight * Math.log1p(consultCount) +
      regionWeight * regionMatch +
      userWeight * tagSimilarity
    );
  }

  private buildAchievementDto(item: AchievementRecord, publisherMap: Record<string, any>) {
    const publisher = publisherMap[item.publisherUserId] ?? {
      userId: item.publisherUserId,
      displayName: 'User',
      verificationType: 'PERSON',
      verificationStatus: 'PENDING',
    };
    return {
      id: item.id,
      source: item.source ?? 'USER',
      title: item.title,
      summary: item.summary ?? null,
      maturity: item.maturity ?? null,
      cooperationModes: this.asArray(item.cooperationModesJson),
      regionCode: item.regionCode ?? null,
      industryTags: this.asArray(item.industryTagsJson),
      keywords: this.asArray(item.keywordsJson),
      publisher,
      stats: mapStats(item.stats),
      auditStatus: item.auditStatus,
      status: item.status,
      coverUrl: item.coverFile?.url ?? null,
      createdAt: item.createdAt.toISOString(),
      publisherUserId: item.publisherUserId,
      description: item.description ?? null,
      coverFileId: item.coverFileId ?? null,
      media: mapContentMedia(item.media ?? []),
      aiParse: null,
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toPublic(item: AchievementRecord, publisherMap: Record<string, any>) {
    const dto = this.buildAchievementDto(item, publisherMap);
    const sanitizedIndustryTags = sanitizeIndustryTagNames(dto.industryTags);
    const { publisherUserId: _publisherUserId, coverFileId: _coverFileId, updatedAt: _updatedAt, ...rest } = dto;
    return { ...rest, industryTags: sanitizedIndustryTags };
  }

  private async fetchAchievement(achievementId: string) {
    return await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      include: { coverFile: true, media: { include: { file: true } }, stats: true },
    });
  }

  async listMine(req: any, query: any): Promise<Paged<any>> {
    this.ensureAuth(req);
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasAuditStatus = this.hasOwn(query, 'auditStatus');
    const hasStatus = this.hasOwn(query, 'status');
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(query?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseContentStatusStrict(query?.status, 'status') : undefined;
    const where: any = { publisherUserId: req.auth.userId };
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
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
      items: items.map((item) => this.buildAchievementDto(item as AchievementRecord, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async getMine(req: any, achievementId: string) {
    this.ensureAuth(req);
    const item = await this.fetchAchievement(achievementId);
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愭灉涓嶅瓨鍦?' });
    }
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildAchievementDto(item as AchievementRecord, publisherMap);
  }

  async create(req: any, body: any) {
    this.ensureAuth(req);
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const keywords = normalizeStringArray(body?.keywords);
    const cooperationModes = normalizeStringArray(body?.cooperationModes);
    const industryTags = normalizeStringArray(body?.industryTags);
    const hasCoverFileId = this.hasOwn(body, 'coverFileId');
    const hasMaturity = this.hasOwn(body, 'maturity');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasSummary = this.hasOwn(body, 'summary');
    const hasDescription = this.hasOwn(body, 'description');
    const maturity = hasMaturity ? this.parseNullableMaturityStrict(body?.maturity, 'maturity') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : null;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : null;
    const mediaInput = normalizeMediaInput(body?.media);

    const created = await this.prisma.$transaction(async (tx) => {
      const achievement = await tx.achievement.create({
        data: {
          publisherUserId: req.auth.userId,
          source: 'USER',
          title,
          summary,
          description,
          keywordsJson: keywords.length > 0 ? keywords : Prisma.DbNull,
          maturity: maturity === undefined ? null : maturity,
          cooperationModesJson: cooperationModes.length > 0 ? cooperationModes : Prisma.DbNull,
          coverFileId: hasCoverFileId ? coverFileId : null,
          regionCode: hasRegionCode ? regionCode : null,
          industryTagsJson: industryTags.length > 0 ? industryTags : Prisma.DbNull,
        },
      });

      if (mediaInput.length > 0) {
        await tx.achievementMedia.createMany({
          data: mediaInput.map((item) => ({
            achievementId: achievement.id,
            fileId: item.fileId,
            type: item.type as any,
            sort: item.sort,
          })),
        });
      }
      return achievement.id;
    });

    const item = await this.fetchAchievement(created);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildAchievementDto(item as AchievementRecord, publisherMap);
  }

  async update(req: any, achievementId: string, body: any) {
    this.ensureAuth(req);
    const item = await this.fetchAchievement(achievementId);
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愭灉涓嶅瓨鍦?' });
    }

    const hasKeywords = Object.prototype.hasOwnProperty.call(body || {}, 'keywords');
    const hasCooperationModes = Object.prototype.hasOwnProperty.call(body || {}, 'cooperationModes');
    const hasIndustryTags = Object.prototype.hasOwnProperty.call(body || {}, 'industryTags');
    const hasCoverFileId = Object.prototype.hasOwnProperty.call(body || {}, 'coverFileId');
    const hasMedia = Object.prototype.hasOwnProperty.call(body || {}, 'media');
    const hasMaturity = this.hasOwn(body, 'maturity');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasTitle = this.hasOwn(body, 'title');
    const hasSummary = this.hasOwn(body, 'summary');
    const hasDescription = this.hasOwn(body, 'description');

    const keywords = hasKeywords ? normalizeStringArray(body?.keywords) : undefined;
    const cooperationModes = hasCooperationModes ? normalizeStringArray(body?.cooperationModes) : undefined;
    const industryTags = hasIndustryTags ? normalizeStringArray(body?.industryTags) : undefined;
    const mediaInput = hasMedia ? normalizeMediaInput(body?.media) : [];
    const maturity = hasMaturity ? this.parseNullableMaturityStrict(body?.maturity, 'maturity') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const title = hasTitle ? this.parseOptionalNonEmptyStringStrict(body?.title, 'title') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.achievement.update({
        where: { id: achievementId },
        data: {
          title: hasTitle ? title : undefined,
          summary: hasSummary ? summary : undefined,
          description: hasDescription ? description : undefined,
          maturity: hasMaturity ? maturity : undefined,
          regionCode: hasRegionCode ? regionCode : undefined,
          coverFileId: hasCoverFileId ? coverFileId : undefined,
          keywordsJson: hasKeywords ? (keywords && keywords.length > 0 ? keywords : Prisma.DbNull) : undefined,
          cooperationModesJson: hasCooperationModes
            ? cooperationModes && cooperationModes.length > 0
              ? cooperationModes
              : Prisma.DbNull
            : undefined,
          industryTagsJson: hasIndustryTags ? (industryTags && industryTags.length > 0 ? industryTags : Prisma.DbNull) : undefined,
        },
      });

      if (hasMedia) {
        await tx.achievementMedia.deleteMany({ where: { achievementId } });
        if (mediaInput.length > 0) {
          await tx.achievementMedia.createMany({
            data: mediaInput.map((media) => ({
              achievementId,
              fileId: media.fileId,
              type: media.type as any,
              sort: media.sort,
            })),
          });
        }
      }
    });

    const updated = await this.fetchAchievement(achievementId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }

  async submit(req: any, achievementId: string) {
    this.ensureAuth(req);
    const item = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愭灉涓嶅瓨鍦?' });
    }
    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { status: 'ACTIVE', auditStatus: 'PENDING' },
    });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ACHIEVEMENT_SUBMIT',
      targetType: 'ACHIEVEMENT',
      targetId: achievementId,
      afterJson: { auditStatus: 'PENDING' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }

  async offShelf(req: any, achievementId: string, _body: any) {
    this.ensureAuth(req);
    const item = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愭灉涓嶅瓨鍦?' });
    }
    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { status: 'OFF_SHELF' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }

  async search(query: any): Promise<Paged<any>> {
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const q = String(query?.q || '').trim();
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(query?.regionCode, 'regionCode') : null;
    const hasSortBy = this.hasOwn(query, 'sortBy');
    const sortBy = hasSortBy ? this.parseContentSortByStrict(query?.sortBy, 'sortBy') : 'NEWEST';

    const industryTags = sanitizeIndustryTagNames(query?.industryTags);
    const cooperationModes = normalizeStringArray(query?.cooperationModes);
    const hasMaturity = this.hasOwn(query, 'maturity');
    const maturity = hasMaturity ? this.normalizeMaturity(query?.maturity) : undefined;
    if (hasMaturity && !maturity) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'maturity is invalid' });
    }

    const where: any = { status: 'ACTIVE', auditStatus: 'APPROVED' };
    if (regionCode) where.regionCode = regionCode;
    if (maturity) where.maturity = maturity;
    if (industryTags.length > 0) {
      where.industryTagsJson = { array_contains: industryTags };
    }
    if (cooperationModes.length > 0) {
      where.cooperationModesJson = { array_contains: cooperationModes };
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (sortBy === 'RECOMMENDED') {
      const recommendation = await this.config.getRecommendation();
      if (recommendation?.enabled) {
        const rows = await this.prisma.achievement.findMany({
          where,
          select: {
            id: true,
            createdAt: true,
            regionCode: true,
            stats: { select: { viewCount: true, favoriteCount: true, consultCount: true } },
          },
        });
        const nowMs = Date.now();
        const scored = rows.map((row: any) => ({
          id: row.id,
          score: this.computeRecommendationScore(row, recommendation, regionCode || null, nowMs),
          createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(0),
        }));
        scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.createdAt.getTime() - a.createdAt.getTime()));
        const total = scored.length;
        const start = (page - 1) * pageSize;
        const pageIds = scored.slice(start, start + pageSize).map((item) => item.id);

        const items = pageIds.length
          ? await this.prisma.achievement.findMany({
              where: { id: { in: pageIds } },
              include: { coverFile: true, media: { include: { file: true } }, stats: true },
            })
          : [];

        const itemMap = new Map(items.map((item: any) => [item.id, item]));
        const ordered = pageIds.map((id) => itemMap.get(id)).filter(Boolean) as AchievementRecord[];
        const publisherMap = await buildPublisherMap(
          this.prisma,
          ordered.map((item) => item.publisherUserId),
        );

        return {
          items: ordered.map((item) => this.toPublic(item as AchievementRecord, publisherMap)),
          page: { page, pageSize, total },
        };
      }
    }

    const orderBy: Prisma.AchievementOrderByWithRelationInput = { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
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
      items: items.map((item) => this.toPublic(item as AchievementRecord, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async getPublic(req: any, achievementId: string) {
    const item = await this.fetchAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愭灉涓嶅瓨鍦?' });
    void this.events.recordView(req, 'ACHIEVEMENT', achievementId).catch(() => {});
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.toPublic(item as AchievementRecord, publisherMap);
  }

  async listAdmin(req: any, query: any): Promise<Paged<any>> {
    this.ensureAdmin(req);
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasAuditStatus = this.hasOwn(query, 'auditStatus');
    const hasStatus = this.hasOwn(query, 'status');
    const hasSource = this.hasOwn(query, 'source');
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(query?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseContentStatusStrict(query?.status, 'status') : undefined;
    const q = String(query?.q || '').trim();
    const source = hasSource ? this.parseContentSourceStrict(query?.source, 'source') : undefined;

    const where: any = {};
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) where.status = status;
    if (source) where.source = source;
    if (q) where.title = { contains: q, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
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
      items: items.map((item) => this.buildAchievementDto(item as AchievementRecord, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async adminCreate(req: any, body: any) {
    this.ensureAdmin(req);
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const hasSource = this.hasOwn(body, 'source');
    const hasMaturity = this.hasOwn(body, 'maturity');
    const hasAuditStatus = this.hasOwn(body, 'auditStatus');
    const hasStatus = this.hasOwn(body, 'status');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasCoverFileId = this.hasOwn(body, 'coverFileId');
    const hasSummary = this.hasOwn(body, 'summary');
    const hasDescription = this.hasOwn(body, 'description');
    const sourceInput = hasSource ? this.parseContentSourceStrict(body?.source, 'source') : 'ADMIN';
    const ownerId = this.parseOptionalPublisherUserIdStrict(body) ?? String(req?.auth?.userId || '').trim();
    const keywords = normalizeStringArray(body?.keywords);
    const cooperationModes = normalizeStringArray(body?.cooperationModes);
    const industryTags = normalizeStringArray(body?.industryTags);
    const maturity = hasMaturity ? this.parseNullableMaturityStrict(body?.maturity, 'maturity') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : null;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : null;
    const mediaInput = normalizeMediaInput(body?.media);
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus') : 'PENDING';
    const status = hasStatus ? this.parseContentStatusStrict(body?.status, 'status') : 'DRAFT';

    const created = await this.prisma.$transaction(async (tx) => {
      const achievement = await tx.achievement.create({
        data: {
          publisherUserId: ownerId || req.auth.userId,
          source: sourceInput,
          title,
          summary,
          description,
          keywordsJson: keywords.length > 0 ? keywords : Prisma.DbNull,
          maturity: maturity === undefined ? null : maturity,
          cooperationModesJson: cooperationModes.length > 0 ? cooperationModes : Prisma.DbNull,
          coverFileId: hasCoverFileId ? coverFileId : null,
          regionCode: hasRegionCode ? regionCode : null,
          industryTagsJson: industryTags.length > 0 ? industryTags : Prisma.DbNull,
          auditStatus,
          status,
        },
      });

      if (mediaInput.length > 0) {
        await tx.achievementMedia.createMany({
          data: mediaInput.map((item) => ({
            achievementId: achievement.id,
            fileId: item.fileId,
            type: item.type as any,
            sort: item.sort,
          })),
        });
      }
      return achievement.id;
    });

    const item = await this.fetchAchievement(created);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildAchievementDto(item as AchievementRecord, publisherMap);
  }

  async adminGetById(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = await this.fetchAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildAchievementDto(item as AchievementRecord, publisherMap);
  }

  async adminUpdate(req: any, achievementId: string, body: any) {
    this.ensureAdmin(req);
    const item = await this.fetchAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });

    const hasKeywords = this.hasOwn(body, 'keywords');
    const hasCooperationModes = this.hasOwn(body, 'cooperationModes');
    const hasIndustryTags = this.hasOwn(body, 'industryTags');
    const hasCoverFileId = this.hasOwn(body, 'coverFileId');
    const hasMedia = this.hasOwn(body, 'media');
    const hasSource = this.hasOwn(body, 'source');
    const hasMaturity = this.hasOwn(body, 'maturity');
    const hasAuditStatus = this.hasOwn(body, 'auditStatus');
    const hasStatus = this.hasOwn(body, 'status');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasTitle = this.hasOwn(body, 'title');
    const hasSummary = this.hasOwn(body, 'summary');
    const hasDescription = this.hasOwn(body, 'description');

    const keywords = hasKeywords ? normalizeStringArray(body?.keywords) : undefined;
    const cooperationModes = hasCooperationModes ? normalizeStringArray(body?.cooperationModes) : undefined;
    const industryTags = hasIndustryTags ? normalizeStringArray(body?.industryTags) : undefined;
    const mediaInput = hasMedia ? normalizeMediaInput(body?.media) : [];
    const source = hasSource ? this.parseContentSourceStrict(body?.source, 'source') : undefined;
    const maturity = hasMaturity ? this.parseNullableMaturityStrict(body?.maturity, 'maturity') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const title = hasTitle ? this.parseOptionalNonEmptyStringStrict(body?.title, 'title') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : undefined;
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseContentStatusStrict(body?.status, 'status') : undefined;
    const publisherUserId = this.parseOptionalPublisherUserIdStrict(body);

    await this.prisma.$transaction(async (tx) => {
      await tx.achievement.update({
        where: { id: achievementId },
        data: {
          publisherUserId: publisherUserId ?? undefined,
          source: hasSource ? source : undefined,
          title: hasTitle ? title : undefined,
          summary: hasSummary ? summary : undefined,
          description: hasDescription ? description : undefined,
          maturity: hasMaturity ? maturity : undefined,
          regionCode: hasRegionCode ? regionCode : undefined,
          coverFileId: hasCoverFileId ? coverFileId : undefined,
          keywordsJson: hasKeywords ? (keywords && keywords.length > 0 ? keywords : Prisma.DbNull) : undefined,
          cooperationModesJson: hasCooperationModes
            ? cooperationModes && cooperationModes.length > 0
              ? cooperationModes
              : Prisma.DbNull
            : undefined,
          industryTagsJson: hasIndustryTags ? (industryTags && industryTags.length > 0 ? industryTags : Prisma.DbNull) : undefined,
          auditStatus: hasAuditStatus ? auditStatus : undefined,
          status: hasStatus ? status : undefined,
        },
      });

      if (hasMedia) {
        await tx.achievementMedia.deleteMany({ where: { achievementId } });
        if (mediaInput.length > 0) {
          await tx.achievementMedia.createMany({
            data: mediaInput.map((media) => ({
              achievementId,
              fileId: media.fileId,
              type: media.type as any,
              sort: media.sort,
            })),
          });
        }
      }
    });

    const updated = await this.fetchAchievement(achievementId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }

  async adminPublish(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { status: 'ACTIVE', auditStatus: 'APPROVED' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }

  async adminOffShelf(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { status: 'OFF_SHELF' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }

  async adminApprove(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愰灉涓嶅瓨鍦?' });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ACHIEVEMENT_APPROVE',
      targetType: 'ACHIEVEMENT',
      targetId: achievementId,
      afterJson: { auditStatus: 'APPROVED' },
    });
    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: {
        auditStatus: 'APPROVED',
        status: item.status === 'DRAFT' ? 'ACTIVE' : item.status,
      },
    });
    await this.notifications.create({
      userId: updated.publisherUserId,
      title: '成果审核通过',
      summary: `《${updated.title || '成果'}》已通过审核，可在平台展示。`,
      source: '平台审核',
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }

  async adminReject(req: any, achievementId: string, body: any) {
    this.ensureAdmin(req);
    const item = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愰灉涓嶅瓨鍦?' });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ACHIEVEMENT_REJECT',
      targetType: 'ACHIEVEMENT',
      targetId: achievementId,
      afterJson: { auditStatus: 'REJECTED', reason: body?.reason },
    });
    const updated = await this.prisma.achievement.update({
      where: { id: achievementId },
      data: { auditStatus: 'REJECTED' },
    });
    await this.notifications.create({
      userId: updated.publisherUserId,
      title: '成果审核驳回',
      summary: `《${updated.title || '成果'}》审核未通过${body?.reason ? `，原因：${body.reason}` : '，请修改后重新提交'}。`,
      source: '平台审核',
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildAchievementDto(updated as AchievementRecord, publisherMap);
  }
}

