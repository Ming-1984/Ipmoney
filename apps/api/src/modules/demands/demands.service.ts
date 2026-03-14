import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryPeriod, Prisma } from '@prisma/client';

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

type DemandRecord = {
  id: string;
  publisherUserId: string;
  source?: string | null;
  title: string;
  summary?: string | null;
  description?: string | null;
  keywordsJson?: unknown;
  deliveryPeriod?: string | null;
  cooperationModesJson?: unknown;
  budgetType?: string | null;
  budgetMinFen?: number | null;
  budgetMaxFen?: number | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactPhoneMasked?: string | null;
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
export class DemandsService {
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

  private normalizePriceType(value: unknown): 'FIXED' | 'NEGOTIABLE' | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (v === 'FIXED' || v === 'NEGOTIABLE') return v as 'FIXED' | 'NEGOTIABLE';
    return undefined;
  }

  private normalizeDeliveryPeriod(value: unknown): DeliveryPeriod | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return undefined;
    const allowed = ['WITHIN_1_MONTH', 'MONTH_1_3', 'MONTH_3_6', 'OVER_6_MONTHS', 'OTHER'];
    return allowed.includes(v) ? (v as DeliveryPeriod) : undefined;
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

  private parseNullablePriceTypeStrict(value: unknown, fieldName: string): 'FIXED' | 'NEGOTIABLE' | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const normalized = this.normalizePriceType(value);
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private parseNullableDeliveryPeriodStrict(value: unknown, fieldName: string): DeliveryPeriod | null {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const normalized = this.normalizeDeliveryPeriod(value);
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

  private parseOptionalInt(value: unknown, fieldName: string, min = 0): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isInteger(num) || num < min) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return num;
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

  private asArray(value: unknown): string[] {
    return Array.isArray(value) ? (value as string[]) : [];
  }

  private buildDemandDto(item: DemandRecord, publisherMap: Record<string, any>) {
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
      budgetType: item.budgetType ?? null,
      budgetMinFen: item.budgetMinFen ?? null,
      budgetMaxFen: item.budgetMaxFen ?? null,
      cooperationModes: this.asArray(item.cooperationModesJson),
      regionCode: item.regionCode ?? null,
      industryTags: this.asArray(item.industryTagsJson),
      keywords: this.asArray(item.keywordsJson),
      deliveryPeriod: item.deliveryPeriod ?? null,
      publisher,
      stats: mapStats(item.stats),
      auditStatus: item.auditStatus,
      status: item.status,
      coverUrl: item.coverFile?.url ?? null,
      createdAt: item.createdAt.toISOString(),
      publisherUserId: item.publisherUserId,
      description: item.description ?? null,
      contactName: item.contactName ?? null,
      contactTitle: item.contactTitle ?? null,
      contactPhoneMasked: item.contactPhoneMasked ?? null,
      coverFileId: item.coverFileId ?? null,
      media: mapContentMedia(item.media ?? []),
      aiParse: null,
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toPublic(item: DemandRecord, publisherMap: Record<string, any>) {
    const dto = this.buildDemandDto(item, publisherMap);
    const sanitizedIndustryTags = sanitizeIndustryTagNames(dto.industryTags);
    const {
      contactName: _contactName,
      contactTitle: _contactTitle,
      contactPhoneMasked: _contactPhoneMasked,
      publisherUserId: _publisherUserId,
      coverFileId: _coverFileId,
      updatedAt: _updatedAt,
      ...rest
    } = dto;
    return { ...rest, industryTags: sanitizedIndustryTags };
  }

  private async fetchDemand(demandId: string) {
    return await this.prisma.demand.findUnique({
      where: { id: demandId },
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
      this.prisma.demand.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.demand.count({ where }),
    ]);

    const publisherMap = await buildPublisherMap(
      this.prisma,
      items.map((item) => item.publisherUserId),
    );

    return {
      items: items.map((item) => this.buildDemandDto(item as DemandRecord, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async getMine(req: any, demandId: string) {
    this.ensureAuth(req);
    const item = await this.fetchDemand(demandId);
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    }
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildDemandDto(item as DemandRecord, publisherMap);
  }

  async create(req: any, body: any) {
    this.ensureAuth(req);
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const keywords = normalizeStringArray(body?.keywords);
    const cooperationModes = normalizeStringArray(body?.cooperationModes);
    const industryTags = normalizeStringArray(body?.industryTags);
    const hasCoverFileId = this.hasOwn(body, 'coverFileId');
    const hasDeliveryPeriod = this.hasOwn(body, 'deliveryPeriod');
    const hasBudgetType = this.hasOwn(body, 'budgetType');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasSummary = this.hasOwn(body, 'summary');
    const hasDescription = this.hasOwn(body, 'description');
    const hasContactName = this.hasOwn(body, 'contactName');
    const hasContactTitle = this.hasOwn(body, 'contactTitle');
    const hasContactPhone = this.hasOwn(body, 'contactPhoneMasked');
    const deliveryPeriod = hasDeliveryPeriod ? this.parseNullableDeliveryPeriodStrict(body?.deliveryPeriod, 'deliveryPeriod') : undefined;
    const budgetType = hasBudgetType ? this.parseNullablePriceTypeStrict(body?.budgetType, 'budgetType') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : null;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : null;
    const contactName = hasContactName ? this.parseNullableNonEmptyStringStrict(body?.contactName, 'contactName') : null;
    const contactTitle = hasContactTitle ? this.parseNullableNonEmptyStringStrict(body?.contactTitle, 'contactTitle') : null;
    const contactPhoneMasked = hasContactPhone
      ? this.parseNullableNonEmptyStringStrict(body?.contactPhoneMasked, 'contactPhoneMasked')
      : null;
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);
    const mediaInput = normalizeMediaInput(body?.media);

    const created = await this.prisma.$transaction(async (tx) => {
      const demand = await tx.demand.create({
        data: {
          publisherUserId: req.auth.userId,
          source: 'USER',
          title,
          summary,
          description,
          keywordsJson: keywords.length > 0 ? keywords : Prisma.DbNull,
          deliveryPeriod: deliveryPeriod === undefined ? null : deliveryPeriod,
          cooperationModesJson: cooperationModes.length > 0 ? cooperationModes : Prisma.DbNull,
          budgetType: budgetType === undefined ? null : budgetType,
          budgetMinFen: budgetMinFen ?? null,
          budgetMaxFen: budgetMaxFen ?? null,
          contactName,
          contactTitle,
          contactPhoneMasked,
          coverFileId: hasCoverFileId ? coverFileId : null,
          regionCode: hasRegionCode ? regionCode : null,
          industryTagsJson: industryTags.length > 0 ? industryTags : Prisma.DbNull,
        },
      });

      if (mediaInput.length > 0) {
        await tx.demandMedia.createMany({
          data: mediaInput.map((item) => ({
            demandId: demand.id,
            fileId: item.fileId,
            type: item.type as any,
            sort: item.sort,
          })),
        });
      }

      return demand.id;
    });

    const item = await this.fetchDemand(created);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildDemandDto(item as DemandRecord, publisherMap);
  }

  async update(req: any, demandId: string, body: any) {
    this.ensureAuth(req);
    const item = await this.fetchDemand(demandId);
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    }

    const hasKeywords = Object.prototype.hasOwnProperty.call(body || {}, 'keywords');
    const hasCooperationModes = Object.prototype.hasOwnProperty.call(body || {}, 'cooperationModes');
    const hasIndustryTags = Object.prototype.hasOwnProperty.call(body || {}, 'industryTags');
    const hasCoverFileId = Object.prototype.hasOwnProperty.call(body || {}, 'coverFileId');
    const hasContactName = Object.prototype.hasOwnProperty.call(body || {}, 'contactName');
    const hasContactTitle = Object.prototype.hasOwnProperty.call(body || {}, 'contactTitle');
    const hasContactPhone = Object.prototype.hasOwnProperty.call(body || {}, 'contactPhoneMasked');
    const hasMedia = Object.prototype.hasOwnProperty.call(body || {}, 'media');
    const hasDeliveryPeriod = this.hasOwn(body, 'deliveryPeriod');
    const hasBudgetType = this.hasOwn(body, 'budgetType');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasTitle = this.hasOwn(body, 'title');
    const hasSummary = this.hasOwn(body, 'summary');
    const hasDescription = this.hasOwn(body, 'description');

    const keywords = hasKeywords ? normalizeStringArray(body?.keywords) : undefined;
    const cooperationModes = hasCooperationModes ? normalizeStringArray(body?.cooperationModes) : undefined;
    const industryTags = hasIndustryTags ? normalizeStringArray(body?.industryTags) : undefined;
    const mediaInput = hasMedia ? normalizeMediaInput(body?.media) : [];

    const deliveryPeriod = hasDeliveryPeriod ? this.parseNullableDeliveryPeriodStrict(body?.deliveryPeriod, 'deliveryPeriod') : undefined;
    const budgetType = hasBudgetType ? this.parseNullablePriceTypeStrict(body?.budgetType, 'budgetType') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const title = hasTitle ? this.parseOptionalNonEmptyStringStrict(body?.title, 'title') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : undefined;
    const contactName = hasContactName ? this.parseNullableNonEmptyStringStrict(body?.contactName, 'contactName') : undefined;
    const contactTitle = hasContactTitle ? this.parseNullableNonEmptyStringStrict(body?.contactTitle, 'contactTitle') : undefined;
    const contactPhoneMasked = hasContactPhone
      ? this.parseNullableNonEmptyStringStrict(body?.contactPhoneMasked, 'contactPhoneMasked')
      : undefined;
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.demand.update({
        where: { id: demandId },
        data: {
          title: hasTitle ? title : undefined,
          summary: hasSummary ? summary : undefined,
          description: hasDescription ? description : undefined,
          deliveryPeriod: hasDeliveryPeriod ? deliveryPeriod : undefined,
          budgetType: hasBudgetType ? budgetType : undefined,
          budgetMinFen: body?.budgetMinFen !== undefined ? budgetMinFen ?? null : undefined,
          budgetMaxFen: body?.budgetMaxFen !== undefined ? budgetMaxFen ?? null : undefined,
          regionCode: hasRegionCode ? regionCode : undefined,
          contactName: hasContactName ? contactName : undefined,
          contactTitle: hasContactTitle ? contactTitle : undefined,
          contactPhoneMasked: hasContactPhone ? contactPhoneMasked : undefined,
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
        await tx.demandMedia.deleteMany({ where: { demandId } });
        if (mediaInput.length > 0) {
          await tx.demandMedia.createMany({
            data: mediaInput.map((media) => ({
              demandId,
              fileId: media.fileId,
              type: media.type as any,
              sort: media.sort,
            })),
          });
        }
      }
    });

    const updated = await this.fetchDemand(demandId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
  }

  async submit(req: any, demandId: string) {
    this.ensureAuth(req);
    const item = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    }
    const updated = await this.prisma.demand.update({
      where: { id: demandId },
      data: { status: 'ACTIVE', auditStatus: 'PENDING' },
    });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'DEMAND_SUBMIT',
      targetType: 'DEMAND',
      targetId: demandId,
      afterJson: { auditStatus: 'PENDING' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
  }

  async offShelf(req: any, demandId: string, _body: any) {
    this.ensureAuth(req);
    const item = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!item || item.publisherUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    }
    const updated = await this.prisma.demand.update({
      where: { id: demandId },
      data: { status: 'OFF_SHELF' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
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
    const hasBudgetType = this.hasOwn(query, 'budgetType');
    const budgetType = hasBudgetType ? this.normalizePriceType(query?.budgetType) : undefined;
    if (hasBudgetType && !budgetType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'budgetType is invalid' });
    }

    const parseStrictQueryIntFilter = (key: 'budgetMinFen' | 'budgetMaxFen') => {
      if (!this.hasOwn(query, key)) return undefined;
      const raw = query?.[key];
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${key} is invalid` });
      }
      return this.parseOptionalInt(raw, key, 0);
    };
    const budgetMinFen = parseStrictQueryIntFilter('budgetMinFen');
    const budgetMaxFen = parseStrictQueryIntFilter('budgetMaxFen');

    const where: any = { status: 'ACTIVE', auditStatus: 'APPROVED' };
    if (regionCode) where.regionCode = regionCode;
    if (budgetType) where.budgetType = budgetType;
    if (industryTags.length > 0) {
      where.industryTagsJson = { array_contains: industryTags };
    }
    if (cooperationModes.length > 0) {
      where.cooperationModesJson = { array_contains: cooperationModes };
    }
    if (budgetMinFen !== undefined) {
      where.budgetMinFen = { gte: budgetMinFen };
    }
    if (budgetMaxFen !== undefined) {
      where.budgetMaxFen = { lte: budgetMaxFen };
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
        const rows = await this.prisma.demand.findMany({
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
          ? await this.prisma.demand.findMany({
              where: { id: { in: pageIds } },
              include: { coverFile: true, media: { include: { file: true } }, stats: true },
            })
          : [];

        const itemMap = new Map(items.map((item: any) => [item.id, item]));
        const ordered = pageIds.map((id) => itemMap.get(id)).filter(Boolean) as DemandRecord[];
        const publisherMap = await buildPublisherMap(
          this.prisma,
          ordered.map((item) => item.publisherUserId),
        );

        return {
          items: ordered.map((item) => this.toPublic(item as DemandRecord, publisherMap)),
          page: { page, pageSize, total },
        };
      }
    }

    const orderBy: Prisma.DemandOrderByWithRelationInput = { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.demand.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.demand.count({ where }),
    ]);

    const publisherMap = await buildPublisherMap(
      this.prisma,
      items.map((item) => item.publisherUserId),
    );

    return {
      items: items.map((item) => this.toPublic(item as DemandRecord, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async getPublic(req: any, demandId: string) {
    const item = await this.fetchDemand(demandId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    void this.events.recordView(req, 'DEMAND', demandId).catch(() => {});
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.toPublic(item as DemandRecord, publisherMap);
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
      this.prisma.demand.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.demand.count({ where }),
    ]);

    const publisherMap = await buildPublisherMap(
      this.prisma,
      items.map((item) => item.publisherUserId),
    );

    return {
      items: items.map((item) => this.buildDemandDto(item as DemandRecord, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async adminCreate(req: any, body: any) {
    this.ensureAdmin(req);
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    const hasSource = this.hasOwn(body, 'source');
    const sourceInput = hasSource ? this.parseContentSourceStrict(body?.source, 'source') : 'ADMIN';
    const hasDeliveryPeriod = this.hasOwn(body, 'deliveryPeriod');
    const hasBudgetType = this.hasOwn(body, 'budgetType');
    const hasAuditStatus = this.hasOwn(body, 'auditStatus');
    const hasStatus = this.hasOwn(body, 'status');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const hasCoverFileId = this.hasOwn(body, 'coverFileId');
    const hasSummary = this.hasOwn(body, 'summary');
    const hasDescription = this.hasOwn(body, 'description');
    const hasContactName = this.hasOwn(body, 'contactName');
    const hasContactTitle = this.hasOwn(body, 'contactTitle');
    const hasContactPhone = this.hasOwn(body, 'contactPhoneMasked');
    const ownerId = this.parseOptionalPublisherUserIdStrict(body) ?? String(req?.auth?.userId || '').trim();
    const keywords = normalizeStringArray(body?.keywords);
    const cooperationModes = normalizeStringArray(body?.cooperationModes);
    const industryTags = normalizeStringArray(body?.industryTags);
    const deliveryPeriod = hasDeliveryPeriod ? this.parseNullableDeliveryPeriodStrict(body?.deliveryPeriod, 'deliveryPeriod') : undefined;
    const budgetType = hasBudgetType ? this.parseNullablePriceTypeStrict(body?.budgetType, 'budgetType') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : null;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : null;
    const contactName = hasContactName ? this.parseNullableNonEmptyStringStrict(body?.contactName, 'contactName') : null;
    const contactTitle = hasContactTitle ? this.parseNullableNonEmptyStringStrict(body?.contactTitle, 'contactTitle') : null;
    const contactPhoneMasked = hasContactPhone
      ? this.parseNullableNonEmptyStringStrict(body?.contactPhoneMasked, 'contactPhoneMasked')
      : null;
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);
    const mediaInput = normalizeMediaInput(body?.media);
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus') : 'PENDING';
    const status = hasStatus ? this.parseContentStatusStrict(body?.status, 'status') : 'DRAFT';

    const created = await this.prisma.$transaction(async (tx) => {
      const demand = await tx.demand.create({
        data: {
          publisherUserId: ownerId || req.auth.userId,
          source: sourceInput,
          title,
          summary,
          description,
          keywordsJson: keywords.length > 0 ? keywords : Prisma.DbNull,
          deliveryPeriod: deliveryPeriod === undefined ? null : deliveryPeriod,
          cooperationModesJson: cooperationModes.length > 0 ? cooperationModes : Prisma.DbNull,
          budgetType: budgetType === undefined ? null : budgetType,
          budgetMinFen: budgetMinFen ?? null,
          budgetMaxFen: budgetMaxFen ?? null,
          contactName,
          contactTitle,
          contactPhoneMasked,
          coverFileId: hasCoverFileId ? coverFileId : null,
          regionCode: hasRegionCode ? regionCode : null,
          industryTagsJson: industryTags.length > 0 ? industryTags : Prisma.DbNull,
          auditStatus,
          status,
        },
      });

      if (mediaInput.length > 0) {
        await tx.demandMedia.createMany({
          data: mediaInput.map((item) => ({
            demandId: demand.id,
            fileId: item.fileId,
            type: item.type as any,
            sort: item.sort,
          })),
        });
      }
      return demand.id;
    });

    const item = await this.fetchDemand(created);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'demand not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildDemandDto(item as DemandRecord, publisherMap);
  }

  async adminGetById(req: any, demandId: string) {
    this.ensureAdmin(req);
    const item = await this.fetchDemand(demandId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'demand not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.buildDemandDto(item as DemandRecord, publisherMap);
  }

  async adminUpdate(req: any, demandId: string, body: any) {
    this.ensureAdmin(req);
    const item = await this.fetchDemand(demandId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'demand not found' });

    const hasKeywords = this.hasOwn(body, 'keywords');
    const hasCooperationModes = this.hasOwn(body, 'cooperationModes');
    const hasIndustryTags = this.hasOwn(body, 'industryTags');
    const hasCoverFileId = this.hasOwn(body, 'coverFileId');
    const hasContactName = this.hasOwn(body, 'contactName');
    const hasContactTitle = this.hasOwn(body, 'contactTitle');
    const hasContactPhone = this.hasOwn(body, 'contactPhoneMasked');
    const hasMedia = this.hasOwn(body, 'media');
    const hasSource = this.hasOwn(body, 'source');
    const hasDeliveryPeriod = this.hasOwn(body, 'deliveryPeriod');
    const hasBudgetType = this.hasOwn(body, 'budgetType');
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
    const deliveryPeriod = hasDeliveryPeriod ? this.parseNullableDeliveryPeriodStrict(body?.deliveryPeriod, 'deliveryPeriod') : undefined;
    const budgetType = hasBudgetType ? this.parseNullablePriceTypeStrict(body?.budgetType, 'budgetType') : undefined;
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : undefined;
    const title = hasTitle ? this.parseOptionalNonEmptyStringStrict(body?.title, 'title') : undefined;
    const coverFileId = hasCoverFileId ? this.parseNullableCoverFileIdStrict(body?.coverFileId, 'coverFileId') : undefined;
    const summary = hasSummary ? this.parseNullableNonEmptyStringStrict(body?.summary, 'summary') : undefined;
    const description = hasDescription ? this.parseNullableNonEmptyStringStrict(body?.description, 'description') : undefined;
    const contactName = hasContactName ? this.parseNullableNonEmptyStringStrict(body?.contactName, 'contactName') : undefined;
    const contactTitle = hasContactTitle ? this.parseNullableNonEmptyStringStrict(body?.contactTitle, 'contactTitle') : undefined;
    const contactPhoneMasked = hasContactPhone
      ? this.parseNullableNonEmptyStringStrict(body?.contactPhoneMasked, 'contactPhoneMasked')
      : undefined;
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);
    const auditStatus = hasAuditStatus ? this.parseAuditStatusStrict(body?.auditStatus, 'auditStatus') : undefined;
    const status = hasStatus ? this.parseContentStatusStrict(body?.status, 'status') : undefined;
    const publisherUserId = this.parseOptionalPublisherUserIdStrict(body);

    await this.prisma.$transaction(async (tx) => {
      await tx.demand.update({
        where: { id: demandId },
        data: {
          publisherUserId: publisherUserId ?? undefined,
          source: hasSource ? source : undefined,
          title: hasTitle ? title : undefined,
          summary: hasSummary ? summary : undefined,
          description: hasDescription ? description : undefined,
          deliveryPeriod: hasDeliveryPeriod ? deliveryPeriod : undefined,
          budgetType: hasBudgetType ? budgetType : undefined,
          budgetMinFen: body?.budgetMinFen !== undefined ? budgetMinFen ?? null : undefined,
          budgetMaxFen: body?.budgetMaxFen !== undefined ? budgetMaxFen ?? null : undefined,
          regionCode: hasRegionCode ? regionCode : undefined,
          contactName: hasContactName ? contactName : undefined,
          contactTitle: hasContactTitle ? contactTitle : undefined,
          contactPhoneMasked: hasContactPhone ? contactPhoneMasked : undefined,
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
        await tx.demandMedia.deleteMany({ where: { demandId } });
        if (mediaInput.length > 0) {
          await tx.demandMedia.createMany({
            data: mediaInput.map((media) => ({
              demandId,
              fileId: media.fileId,
              type: media.type as any,
              sort: media.sort,
            })),
          });
        }
      }
    });

    const updated = await this.fetchDemand(demandId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'demand not found' });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
  }

  async adminPublish(req: any, demandId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'demand not found' });
    const updated = await this.prisma.demand.update({
      where: { id: demandId },
      data: { status: 'ACTIVE', auditStatus: 'APPROVED' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
  }

  async adminOffShelf(req: any, demandId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'demand not found' });
    const updated = await this.prisma.demand.update({
      where: { id: demandId },
      data: { status: 'OFF_SHELF' },
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
  }

  async adminApprove(req: any, demandId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'DEMAND_APPROVE',
      targetType: 'DEMAND',
      targetId: demandId,
      afterJson: { auditStatus: 'APPROVED' },
    });
    const updated = await this.prisma.demand.update({
      where: { id: demandId },
      data: {
        auditStatus: 'APPROVED',
        status: item.status === 'DRAFT' ? 'ACTIVE' : item.status,
      },
    });
    await this.notifications.create({
      userId: updated.publisherUserId,
      title: '需求审核通过',
      summary: `《${updated.title || '需求'}》已通过审核，可在平台展示。`,
      source: '平台审核',
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
  }

  async adminReject(req: any, demandId: string, body: any) {
    this.ensureAdmin(req);
    const item = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'DEMAND_REJECT',
      targetType: 'DEMAND',
      targetId: demandId,
      afterJson: { auditStatus: 'REJECTED', reason: body?.reason },
    });
    const updated = await this.prisma.demand.update({
      where: { id: demandId },
      data: { auditStatus: 'REJECTED' },
    });
    await this.notifications.create({
      userId: updated.publisherUserId,
      title: '需求审核驳回',
      summary: `《${updated.title || '需求'}》审核未通过${body?.reason ? `，原因：${body.reason}` : '，请修改后重新提交'}。`,
      source: '平台审核',
    });
    const publisherMap = await buildPublisherMap(this.prisma, [updated.publisherUserId]);
    return this.buildDemandDto(updated as DemandRecord, publisherMap);
  }
}

