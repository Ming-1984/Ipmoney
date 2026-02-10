import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryPeriod, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildPublisherMap, mapContentMedia, mapStats, normalizeMediaInput, normalizeStringArray } from '../content-utils';
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

  private parseOptionalInt(value: unknown, fieldName: string, min = 0): number | undefined {
    if (value === undefined || value === null || String(value).trim() === '') return undefined;
    const num = Number(value);
    if (!Number.isFinite(num) || num < min) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return Math.floor(num);
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
    const { contactName, contactTitle, contactPhoneMasked, publisherUserId, coverFileId, updatedAt, ...rest } = dto;
    return rest;
  }

  private async fetchDemand(demandId: string) {
    return await this.prisma.demand.findUnique({
      where: { id: demandId },
      include: { coverFile: true, media: { include: { file: true } }, stats: true },
    });
  }

  async listMine(req: any, query: any): Promise<Paged<any>> {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));

    const [items, total] = await Promise.all([
      this.prisma.demand.findMany({
        where: { publisherUserId: req.auth.userId },
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.demand.count({ where: { publisherUserId: req.auth.userId } }),
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
    const deliveryPeriod = this.normalizeDeliveryPeriod(body?.deliveryPeriod);
    const budgetType = this.normalizePriceType(body?.budgetType);
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);
    const mediaInput = normalizeMediaInput(body?.media);

    const created = await this.prisma.$transaction(async (tx) => {
      const demand = await tx.demand.create({
        data: {
          publisherUserId: req.auth.userId,
          source: 'USER',
          title,
          summary: body?.summary ?? null,
          description: body?.description ?? null,
          keywordsJson: keywords.length > 0 ? keywords : Prisma.DbNull,
          deliveryPeriod: deliveryPeriod ?? null,
          cooperationModesJson: cooperationModes.length > 0 ? cooperationModes : Prisma.DbNull,
          budgetType: budgetType ?? null,
          budgetMinFen: budgetMinFen ?? null,
          budgetMaxFen: budgetMaxFen ?? null,
          contactName: body?.contactName ? String(body.contactName) : null,
          contactTitle: body?.contactTitle ? String(body.contactTitle) : null,
          contactPhoneMasked: body?.contactPhoneMasked ? String(body.contactPhoneMasked) : null,
          coverFileId: body?.coverFileId ? String(body.coverFileId) : null,
          regionCode: body?.regionCode ? String(body.regionCode) : null,
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

    const keywords = hasKeywords ? normalizeStringArray(body?.keywords) : undefined;
    const cooperationModes = hasCooperationModes ? normalizeStringArray(body?.cooperationModes) : undefined;
    const industryTags = hasIndustryTags ? normalizeStringArray(body?.industryTags) : undefined;
    const mediaInput = hasMedia ? normalizeMediaInput(body?.media) : [];

    const deliveryPeriod = this.normalizeDeliveryPeriod(body?.deliveryPeriod);
    const budgetType = this.normalizePriceType(body?.budgetType);
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.demand.update({
        where: { id: demandId },
        data: {
          title: body?.title ?? undefined,
          summary: body?.summary ?? undefined,
          description: body?.description ?? undefined,
          deliveryPeriod: body?.deliveryPeriod !== undefined ? deliveryPeriod ?? null : undefined,
          budgetType: body?.budgetType !== undefined ? budgetType ?? null : undefined,
          budgetMinFen: body?.budgetMinFen !== undefined ? budgetMinFen ?? null : undefined,
          budgetMaxFen: body?.budgetMaxFen !== undefined ? budgetMaxFen ?? null : undefined,
          regionCode: body?.regionCode ?? undefined,
          contactName: hasContactName ? (body?.contactName ? String(body.contactName) : null) : undefined,
          contactTitle: hasContactTitle ? (body?.contactTitle ? String(body.contactTitle) : null) : undefined,
          contactPhoneMasked: hasContactPhone ? (body?.contactPhoneMasked ? String(body.contactPhoneMasked) : null) : undefined,
          coverFileId: hasCoverFileId ? (body?.coverFileId ? String(body.coverFileId) : null) : undefined,
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
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const regionCode = String(query?.regionCode || '').trim();
    const sortBy = String(query?.sortBy || 'NEWEST').trim().toUpperCase();

    const industryTags = normalizeStringArray(query?.industryTags);
    const cooperationModes = normalizeStringArray(query?.cooperationModes);
    const budgetType = this.normalizePriceType(query?.budgetType);

    const budgetMinFen = this.parseOptionalInt(query?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(query?.budgetMaxFen, 'budgetMaxFen', 0);

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

  async getPublic(demandId: string) {
    const item = await this.fetchDemand(demandId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    const publisherMap = await buildPublisherMap(this.prisma, [item.publisherUserId]);
    return this.toPublic(item as DemandRecord, publisherMap);
  }

  async listAdmin(req: any, query: any): Promise<Paged<any>> {
    this.ensureAdmin(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const auditStatus = this.normalizeAuditStatus(query?.auditStatus);
    const status = this.normalizeContentStatus(query?.status);
    const q = String(query?.q || '').trim();
    const source = this.normalizeContentSource(query?.source);

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

    const sourceInput = this.normalizeContentSource(body?.source) ?? 'ADMIN';
    const ownerId = String(body?.publisherUserId || body?.ownerId || req?.auth?.userId || '').trim();
    const keywords = normalizeStringArray(body?.keywords);
    const cooperationModes = normalizeStringArray(body?.cooperationModes);
    const industryTags = normalizeStringArray(body?.industryTags);
    const deliveryPeriod = this.normalizeDeliveryPeriod(body?.deliveryPeriod);
    const budgetType = this.normalizePriceType(body?.budgetType);
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);
    const mediaInput = normalizeMediaInput(body?.media);

    const created = await this.prisma.$transaction(async (tx) => {
      const demand = await tx.demand.create({
        data: {
          publisherUserId: ownerId || req.auth.userId,
          source: sourceInput,
          title,
          summary: body?.summary ?? null,
          description: body?.description ?? null,
          keywordsJson: keywords.length > 0 ? keywords : Prisma.DbNull,
          deliveryPeriod: deliveryPeriod ?? null,
          cooperationModesJson: cooperationModes.length > 0 ? cooperationModes : Prisma.DbNull,
          budgetType: budgetType ?? null,
          budgetMinFen: budgetMinFen ?? null,
          budgetMaxFen: budgetMaxFen ?? null,
          contactName: body?.contactName ? String(body.contactName) : null,
          contactTitle: body?.contactTitle ? String(body.contactTitle) : null,
          contactPhoneMasked: body?.contactPhoneMasked ? String(body.contactPhoneMasked) : null,
          coverFileId: body?.coverFileId ? String(body.coverFileId) : null,
          regionCode: body?.regionCode ? String(body.regionCode) : null,
          industryTagsJson: industryTags.length > 0 ? industryTags : Prisma.DbNull,
          auditStatus: this.normalizeAuditStatus(body?.auditStatus) ?? 'PENDING',
          status: this.normalizeContentStatus(body?.status) ?? 'DRAFT',
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

    const hasKeywords = Object.prototype.hasOwnProperty.call(body || {}, 'keywords');
    const hasCooperationModes = Object.prototype.hasOwnProperty.call(body || {}, 'cooperationModes');
    const hasIndustryTags = Object.prototype.hasOwnProperty.call(body || {}, 'industryTags');
    const hasCoverFileId = Object.prototype.hasOwnProperty.call(body || {}, 'coverFileId');
    const hasContactName = Object.prototype.hasOwnProperty.call(body || {}, 'contactName');
    const hasContactTitle = Object.prototype.hasOwnProperty.call(body || {}, 'contactTitle');
    const hasContactPhone = Object.prototype.hasOwnProperty.call(body || {}, 'contactPhoneMasked');
    const hasMedia = Object.prototype.hasOwnProperty.call(body || {}, 'media');

    const keywords = hasKeywords ? normalizeStringArray(body?.keywords) : undefined;
    const cooperationModes = hasCooperationModes ? normalizeStringArray(body?.cooperationModes) : undefined;
    const industryTags = hasIndustryTags ? normalizeStringArray(body?.industryTags) : undefined;
    const mediaInput = hasMedia ? normalizeMediaInput(body?.media) : [];

    const deliveryPeriod = this.normalizeDeliveryPeriod(body?.deliveryPeriod);
    const budgetType = this.normalizePriceType(body?.budgetType);
    const budgetMinFen = this.parseOptionalInt(body?.budgetMinFen, 'budgetMinFen', 0);
    const budgetMaxFen = this.parseOptionalInt(body?.budgetMaxFen, 'budgetMaxFen', 0);
    const publisherUserId = body?.publisherUserId ? String(body.publisherUserId) : body?.ownerId ? String(body.ownerId) : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.demand.update({
        where: { id: demandId },
        data: {
          publisherUserId: publisherUserId ?? undefined,
          source: body?.source !== undefined ? this.normalizeContentSource(body?.source) ?? item.source : undefined,
          title: body?.title ?? undefined,
          summary: body?.summary ?? undefined,
          description: body?.description ?? undefined,
          deliveryPeriod: body?.deliveryPeriod !== undefined ? deliveryPeriod ?? null : undefined,
          budgetType: body?.budgetType !== undefined ? budgetType ?? null : undefined,
          budgetMinFen: body?.budgetMinFen !== undefined ? budgetMinFen ?? null : undefined,
          budgetMaxFen: body?.budgetMaxFen !== undefined ? budgetMaxFen ?? null : undefined,
          regionCode: body?.regionCode ?? undefined,
          contactName: hasContactName ? (body?.contactName ? String(body.contactName) : null) : undefined,
          contactTitle: hasContactTitle ? (body?.contactTitle ? String(body.contactTitle) : null) : undefined,
          contactPhoneMasked: hasContactPhone ? (body?.contactPhoneMasked ? String(body.contactPhoneMasked) : null) : undefined,
          coverFileId: hasCoverFileId ? (body?.coverFileId ? String(body.coverFileId) : null) : undefined,
          keywordsJson: hasKeywords ? (keywords && keywords.length > 0 ? keywords : Prisma.DbNull) : undefined,
          cooperationModesJson: hasCooperationModes
            ? cooperationModes && cooperationModes.length > 0
              ? cooperationModes
              : Prisma.DbNull
            : undefined,
          industryTagsJson: hasIndustryTags ? (industryTags && industryTags.length > 0 ? industryTags : Prisma.DbNull) : undefined,
          auditStatus: body?.auditStatus !== undefined ? this.normalizeAuditStatus(body?.auditStatus) ?? item.auditStatus : undefined,
          status: body?.status !== undefined ? this.normalizeContentStatus(body?.status) ?? item.status : undefined,
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

