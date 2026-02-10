import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ArtworkCategory, CalligraphyScript, PaintingGenre, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapContentMedia, mapStats, normalizeMediaInput, normalizeStringArray } from '../content-utils';
import { NotificationsService } from '../notifications/notifications.service';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

type ArtworkRecord = {
  id: string;
  sellerUserId: string;
  source?: string | null;
  title: string;
  description?: string | null;
  category: string;
  calligraphyScript?: string | null;
  paintingGenre?: string | null;
  creatorName: string;
  creationDate?: Date | null;
  creationYear?: number | null;
  certificateNo?: string | null;
  certificateFileIdsJson?: unknown;
  priceType: string;
  priceAmountFen?: number | null;
  depositAmountFen: number;
  regionCode?: string | null;
  material?: string | null;
  size?: string | null;
  coverFileId?: string | null;
  auditStatus: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  coverFile?: { url?: string | null } | null;
  media?: Array<{ fileId: string; type: string; sort: number; file?: any }>;
  stats?: { viewCount?: number; favoriteCount?: number; consultCount?: number; commentCount?: number } | null;
  seller?: { id: string; nickname?: string | null; avatarUrl?: string | null; role?: string | null } | null;
};

@Injectable()
export class ArtworksService {
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

  private normalizeAuditStatus(value: unknown): 'PENDING' | 'APPROVED' | 'REJECTED' | undefined {
    const status = String(value || '').trim().toUpperCase();
    if (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') {
      return status as 'PENDING' | 'APPROVED' | 'REJECTED';
    }
    return undefined;
  }

  private normalizeArtworkStatus(value: unknown): 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD' | undefined {
    const status = String(value || '').trim().toUpperCase();
    if (status === 'DRAFT' || status === 'ACTIVE' || status === 'OFF_SHELF' || status === 'SOLD') {
      return status as 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
    }
    return undefined;
  }

  private normalizePriceType(value: unknown): 'FIXED' | 'NEGOTIABLE' | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (v === 'FIXED' || v === 'NEGOTIABLE') return v as 'FIXED' | 'NEGOTIABLE';
    return undefined;
  }

  private normalizeCategory(value: unknown): ArtworkCategory | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (v === 'CALLIGRAPHY' || v === 'PAINTING') return v as ArtworkCategory;
    return undefined;
  }

  private normalizeCalligraphyScript(value: unknown): CalligraphyScript | undefined {
    const v = String(value || '').trim().toUpperCase();
    const allowed = ['KAISHU', 'XINGSHU', 'CAOSHU', 'LISHU', 'ZHUANSHU'];
    return allowed.includes(v) ? (v as CalligraphyScript) : undefined;
  }

  private normalizePaintingGenre(value: unknown): PaintingGenre | undefined {
    const v = String(value || '').trim().toUpperCase();
    const allowed = ['FIGURE', 'LANDSCAPE', 'BIRD_FLOWER', 'OTHER'];
    return allowed.includes(v) ? (v as PaintingGenre) : undefined;
  }

  private parseOptionalInt(value: unknown, fieldName: string, min = 0): number | undefined {
    if (value === undefined || value === null || String(value).trim() === '') return undefined;
    const num = Number(value);
    if (!Number.isFinite(num) || num < min) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return Math.floor(num);
  }

  private parseOptionalDate(value: unknown, fieldName: string) {
    if (value === undefined || value === null || String(value).trim() === '') return undefined;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return new Date(date.toISOString().slice(0, 10));
  }

  private normalizeFileIds(input: unknown): string[] {
    return Array.from(new Set(normalizeStringArray(input).map((v) => String(v || '').trim()).filter((v) => v.length > 0)));
  }

  private asArray(value: unknown): string[] {
    return Array.isArray(value) ? (value as string[]) : [];
  }

  private async assertOwnedFiles(userId: string, fileIds: string[], label: string) {
    if (!fileIds || fileIds.length === 0) return;
    const files = await this.prisma.file.findMany({ where: { id: { in: fileIds } } });
    if (files.length !== fileIds.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${label} is invalid` });
    }
    const notOwned = files.filter((f: { ownerId?: string | null }) => String(f.ownerId || '') !== userId);
    if (notOwned.length > 0) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private validateArtworkForSubmit(item: ArtworkRecord) {
    const errors: string[] = [];
    if (!item?.title) errors.push('title');
    if (!item?.creatorName) errors.push('creatorName');
    if (!item?.certificateNo) errors.push('certificateNo');
    if (!item?.creationDate && !item?.creationYear) errors.push('creationDate');
    if (!item?.description) errors.push('description');
    const media = Array.isArray(item?.media) ? item.media : [];
    if (media.length === 0) errors.push('media');
    if (errors.length > 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `missing fields: ${errors.join(', ')}` });
    }
  }

  private buildArtworkDto(item: ArtworkRecord) {
    const creationDate = item.creationDate ? item.creationDate.toISOString().slice(0, 10) : null;
    return {
      id: item.id,
      source: item.source ?? 'USER',
      title: item.title,
      category: item.category,
      calligraphyScript: item.calligraphyScript ?? null,
      paintingGenre: item.paintingGenre ?? null,
      creatorName: item.creatorName,
      creationDate,
      creationYear: item.creationYear ?? null,
      certificateNo: item.certificateNo ?? null,
      priceType: item.priceType,
      priceAmountFen: item.priceAmountFen ?? null,
      depositAmountFen: item.depositAmountFen ?? 0,
      regionCode: item.regionCode ?? null,
      material: item.material ?? null,
      size: item.size ?? null,
      coverUrl: item.coverFile?.url ?? null,
      stats: mapStats(item.stats),
      auditStatus: item.auditStatus,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      sellerUserId: item.sellerUserId,
      description: item.description ?? null,
      certificateFileIds: this.asArray(item.certificateFileIdsJson),
      coverFileId: item.coverFileId ?? null,
      media: mapContentMedia(item.media ?? []),
      aiParse: null,
    };
  }

  private toPublic(item: ArtworkRecord) {
    const dto = this.buildArtworkDto(item);
    const { sellerUserId, certificateNo, certificateFileIds, coverFileId, ...rest } = dto;
    return {
      ...rest,
      seller: item.seller
        ? {
            id: item.seller.id,
            nickname: item.seller.nickname ?? null,
            avatarUrl: item.seller.avatarUrl ?? null,
            role: item.seller.role ?? null,
          }
        : null,
    };
  }

  private async fetchArtwork(artworkId: string, includeSeller = false) {
    return await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        coverFile: true,
        media: { include: { file: true } },
        stats: true,
        seller: includeSeller,
      },
    });
  }

  async listMine(req: any, query: any): Promise<Paged<any>> {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const status = this.normalizeArtworkStatus(query?.status);
    const auditStatus = this.normalizeAuditStatus(query?.auditStatus);

    const where: any = { sellerUserId: req.auth.userId };
    if (status) where.status = status;
    if (auditStatus) where.auditStatus = auditStatus;

    const [items, total] = await Promise.all([
      this.prisma.artwork.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.artwork.count({ where }),
    ]);

    return {
      items: items.map((item) => this.buildArtworkDto(item as ArtworkRecord)),
      page: { page, pageSize, total },
    };
  }

  async getMine(req: any, artworkId: string) {
    this.ensureAuth(req);
    const item = await this.fetchArtwork(artworkId);
    if (!item || item.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    }
    return this.buildArtworkDto(item as ArtworkRecord);
  }

  async create(req: any, body: any) {
    this.ensureAuth(req);
    const title = String(body?.title || '').trim();
    const category = this.normalizeCategory(body?.category);
    const creatorName = String(body?.creatorName || '').trim();
    const priceType = this.normalizePriceType(body?.priceType);

    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });
    if (!category) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'category is required' });
    if (!creatorName) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'creatorName is required' });
    if (!priceType) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'priceType is required' });

    const calligraphyScript = this.normalizeCalligraphyScript(body?.calligraphyScript);
    const paintingGenre = this.normalizePaintingGenre(body?.paintingGenre);
    const creationDate = this.parseOptionalDate(body?.creationDate, 'creationDate');
    const creationYear = this.parseOptionalInt(body?.creationYear, 'creationYear', 0);
    const priceAmountFen = this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0);
    const depositAmountFen = this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0);
    const certificateFileIds = this.normalizeFileIds(body?.certificateFileIds);
    const mediaInput = normalizeMediaInput(body?.media);

    const created = await this.prisma.$transaction(async (tx) => {
      const artwork = await tx.artwork.create({
        data: {
          sellerUserId: req.auth.userId,
          source: 'USER',
          title,
          description: body?.description ?? null,
          category,
          calligraphyScript: calligraphyScript ?? null,
          paintingGenre: paintingGenre ?? null,
          creatorName,
          creationDate: creationDate ?? null,
          creationYear: creationYear ?? null,
          certificateNo: body?.certificateNo ? String(body.certificateNo) : null,
          certificateFileIdsJson: certificateFileIds.length > 0 ? certificateFileIds : Prisma.DbNull,
          priceType,
          priceAmountFen: priceAmountFen ?? null,
          depositAmountFen: depositAmountFen ?? 0,
          regionCode: body?.regionCode ? String(body.regionCode) : null,
          material: body?.material ? String(body.material) : null,
          size: body?.size ? String(body.size) : null,
          coverFileId: body?.coverFileId ? String(body.coverFileId) : null,
        },
      });

      if (mediaInput.length > 0) {
        await tx.artworkMedia.createMany({
          data: mediaInput.map((item) => ({
            artworkId: artwork.id,
            fileId: item.fileId,
            type: item.type as any,
            sort: item.sort,
          })),
        });
      }
      return artwork.id;
    });

    const item = await this.fetchArtwork(created);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return this.buildArtworkDto(item as ArtworkRecord);
  }

  async update(req: any, artworkId: string, body: any) {
    this.ensureAuth(req);
    const item = await this.fetchArtwork(artworkId);
    if (!item || item.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    }

    const hasCertificateFileIds = Object.prototype.hasOwnProperty.call(body || {}, 'certificateFileIds');
    const hasCoverFileId = Object.prototype.hasOwnProperty.call(body || {}, 'coverFileId');
    const hasMedia = Object.prototype.hasOwnProperty.call(body || {}, 'media');

    const category = body?.category !== undefined ? this.normalizeCategory(body?.category) : undefined;
    const calligraphyScript = body?.calligraphyScript !== undefined ? this.normalizeCalligraphyScript(body?.calligraphyScript) : undefined;
    const paintingGenre = body?.paintingGenre !== undefined ? this.normalizePaintingGenre(body?.paintingGenre) : undefined;
    const creationDate = body?.creationDate !== undefined ? this.parseOptionalDate(body?.creationDate, 'creationDate') : undefined;
    const creationYear = body?.creationYear !== undefined ? this.parseOptionalInt(body?.creationYear, 'creationYear', 0) : undefined;
    const priceType = body?.priceType !== undefined ? this.normalizePriceType(body?.priceType) : undefined;
    const priceAmountFen = body?.priceAmountFen !== undefined ? this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0) : undefined;
    const depositAmountFen = body?.depositAmountFen !== undefined ? this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0) : undefined;
    const certificateFileIds = hasCertificateFileIds ? this.normalizeFileIds(body?.certificateFileIds) : undefined;
    const mediaInput = hasMedia ? normalizeMediaInput(body?.media) : [];

    await this.prisma.$transaction(async (tx) => {
      await tx.artwork.update({
        where: { id: artworkId },
        data: {
          title: body?.title ?? undefined,
          description: body?.description ?? undefined,
          category: category ?? undefined,
          calligraphyScript: calligraphyScript ?? null,
          paintingGenre: paintingGenre ?? null,
          creatorName: body?.creatorName ?? undefined,
          creationDate: creationDate ?? null,
          creationYear: creationYear ?? null,
          certificateNo: body?.certificateNo ?? undefined,
          certificateFileIdsJson: hasCertificateFileIds
            ? certificateFileIds && certificateFileIds.length > 0
              ? certificateFileIds
              : Prisma.DbNull
            : undefined,
          priceType: priceType ?? undefined,
          priceAmountFen: priceAmountFen ?? null,
          depositAmountFen: depositAmountFen ?? undefined,
          regionCode: body?.regionCode ?? undefined,
          material: body?.material ?? undefined,
          size: body?.size ?? undefined,
          coverFileId: hasCoverFileId ? (body?.coverFileId ? String(body.coverFileId) : null) : undefined,
        },
      });

      if (hasMedia) {
        await tx.artworkMedia.deleteMany({ where: { artworkId } });
        if (mediaInput.length > 0) {
          await tx.artworkMedia.createMany({
            data: mediaInput.map((media) => ({
              artworkId,
              fileId: media.fileId,
              type: media.type as any,
              sort: media.sort,
            })),
          });
        }
      }
    });

    const updated = await this.fetchArtwork(artworkId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }

  async submit(req: any, artworkId: string) {
    this.ensureAuth(req);
    const item = await this.fetchArtwork(artworkId);
    if (!item || item.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    }
    this.validateArtworkForSubmit(item as ArtworkRecord);
    const certificateFileIds = this.normalizeFileIds((item as ArtworkRecord).certificateFileIdsJson);
    await this.assertOwnedFiles(req.auth.userId, certificateFileIds, 'certificateFileIds');
    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { status: 'ACTIVE', auditStatus: 'PENDING' },
    });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ARTWORK_SUBMIT',
      targetType: 'ARTWORK',
      targetId: artworkId,
      afterJson: { auditStatus: 'PENDING' },
    });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }

  async offShelf(req: any, artworkId: string, _body: any) {
    this.ensureAuth(req);
    const item = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!item || item.sellerUserId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    }
    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { status: 'OFF_SHELF' },
    });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }

  async search(query: any): Promise<Paged<any>> {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const category = this.normalizeCategory(query?.category || query?.artworkCategory);
    const calligraphyScript = this.normalizeCalligraphyScript(query?.calligraphyScript);
    const paintingGenre = this.normalizePaintingGenre(query?.paintingGenre);
    const creator = String(query?.creator || query?.creatorName || '').trim();
    const priceType = this.normalizePriceType(query?.priceType);
    const regionCode = String(query?.regionCode || '').trim();
    const sortBy = String(query?.sortBy || 'NEWEST').trim().toUpperCase();

    const creationYearStart = this.parseOptionalInt(query?.creationYearStart, 'creationYearStart', 0);
    const creationYearEnd = this.parseOptionalInt(query?.creationYearEnd, 'creationYearEnd', 0);
    const priceMin = this.parseOptionalInt(query?.priceMin, 'priceMin', 0);
    const priceMax = this.parseOptionalInt(query?.priceMax, 'priceMax', 0);
    const depositMin = this.parseOptionalInt(query?.depositMin, 'depositMin', 0);
    const depositMax = this.parseOptionalInt(query?.depositMax, 'depositMax', 0);

    const where: any = { status: 'ACTIVE', auditStatus: 'APPROVED' };
    if (category) where.category = category;
    if (calligraphyScript) where.calligraphyScript = calligraphyScript;
    if (paintingGenre) where.paintingGenre = paintingGenre;
    if (creator) where.creatorName = { contains: creator, mode: 'insensitive' };
    if (regionCode) where.regionCode = regionCode;
    if (priceType) where.priceType = priceType;

    if (priceMin !== undefined) {
      where.priceAmountFen = { gte: priceMin };
    }
    if (priceMax !== undefined) {
      where.priceAmountFen = { ...(where.priceAmountFen || {}), lte: priceMax };
    }
    if (depositMin !== undefined) {
      where.depositAmountFen = { gte: depositMin };
    }
    if (depositMax !== undefined) {
      where.depositAmountFen = { ...(where.depositAmountFen || {}), lte: depositMax };
    }

    const andFilters: any[] = [];
    if (creationYearStart !== undefined || creationYearEnd !== undefined) {
      const yearRange: any = {};
      if (creationYearStart !== undefined) yearRange.gte = creationYearStart;
      if (creationYearEnd !== undefined) yearRange.lte = creationYearEnd;

      const dateRange: any = {};
      if (creationYearStart !== undefined) dateRange.gte = new Date(`${creationYearStart}-01-01`);
      if (creationYearEnd !== undefined) dateRange.lte = new Date(`${creationYearEnd}-12-31`);

      andFilters.push({
        OR: [{ creationYear: yearRange }, { creationYear: null, creationDate: dateRange }],
      });
    }
    if (q) {
      andFilters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { creatorName: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (andFilters.length > 0) where.AND = andFilters;

    const orderBy: any =
      sortBy === 'PRICE_ASC'
        ? { priceAmountFen: 'asc' }
        : sortBy === 'PRICE_DESC'
          ? { priceAmountFen: 'desc' }
          : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.artwork.findMany({
        where,
        include: { coverFile: true, stats: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.artwork.count({ where }),
    ]);

    return {
      items: items.map((item) => this.buildArtworkDto(item as ArtworkRecord)),
      page: { page, pageSize, total },
    };
  }

  async getPublic(artworkId: string) {
    const item = await this.fetchArtwork(artworkId, true);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    return this.toPublic(item as ArtworkRecord);
  }

  async listAdmin(req: any, query: any): Promise<Paged<any>> {
    this.ensureAdmin(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const auditStatus = this.normalizeAuditStatus(query?.auditStatus);
    const status = this.normalizeArtworkStatus(query?.status);
    const q = String(query?.q || '').trim();
    const source = this.normalizeContentSource(query?.source);

    const where: any = {};
    if (auditStatus) where.auditStatus = auditStatus;
    if (status) where.status = status;
    if (source) where.source = source;
    if (q) where.title = { contains: q, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.artwork.findMany({
        where,
        include: { coverFile: true, media: { include: { file: true } }, stats: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.artwork.count({ where }),
    ]);

    return {
      items: items.map((item) => this.buildArtworkDto(item as ArtworkRecord)),
      page: { page, pageSize, total },
    };
  }

  async adminCreate(req: any, body: any) {
    this.ensureAdmin(req);
    const title = String(body?.title || '').trim();
    const category = this.normalizeCategory(body?.category);
    const creatorName = String(body?.creatorName || '').trim();
    const priceType = this.normalizePriceType(body?.priceType);

    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });
    if (!category) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'category is required' });
    if (!creatorName) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'creatorName is required' });
    if (!priceType) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'priceType is required' });

    const sourceInput = this.normalizeContentSource(body?.source) ?? 'ADMIN';
    const ownerId = String(body?.sellerUserId || body?.publisherUserId || body?.ownerId || req?.auth?.userId || '').trim();
    const calligraphyScript = this.normalizeCalligraphyScript(body?.calligraphyScript);
    const paintingGenre = this.normalizePaintingGenre(body?.paintingGenre);
    const creationDate = this.parseOptionalDate(body?.creationDate, 'creationDate');
    const creationYear = this.parseOptionalInt(body?.creationYear, 'creationYear', 0);
    const priceAmountFen = this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0);
    const depositAmountFen = this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0);
    const certificateFileIds = this.normalizeFileIds(body?.certificateFileIds);
    const mediaInput = normalizeMediaInput(body?.media);

    const created = await this.prisma.$transaction(async (tx) => {
      const artwork = await tx.artwork.create({
        data: {
          sellerUserId: ownerId || req.auth.userId,
          source: sourceInput,
          title,
          description: body?.description ?? null,
          category,
          calligraphyScript: calligraphyScript ?? null,
          paintingGenre: paintingGenre ?? null,
          creatorName,
          creationDate: creationDate ?? null,
          creationYear: creationYear ?? null,
          certificateNo: body?.certificateNo ? String(body.certificateNo) : null,
          certificateFileIdsJson: certificateFileIds.length > 0 ? certificateFileIds : Prisma.DbNull,
          priceType,
          priceAmountFen: priceAmountFen ?? null,
          depositAmountFen: depositAmountFen ?? 0,
          regionCode: body?.regionCode ? String(body.regionCode) : null,
          material: body?.material ? String(body.material) : null,
          size: body?.size ? String(body.size) : null,
          coverFileId: body?.coverFileId ? String(body.coverFileId) : null,
          auditStatus: this.normalizeAuditStatus(body?.auditStatus) ?? 'PENDING',
          status: this.normalizeArtworkStatus(body?.status) ?? 'DRAFT',
        },
      });

      if (mediaInput.length > 0) {
        await tx.artworkMedia.createMany({
          data: mediaInput.map((item) => ({
            artworkId: artwork.id,
            fileId: item.fileId,
            type: item.type as any,
            sort: item.sort,
          })),
        });
      }
      return artwork.id;
    });

    const item = await this.fetchArtwork(created);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return this.buildArtworkDto(item as ArtworkRecord);
  }

  async adminGetById(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = await this.fetchArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return this.buildArtworkDto(item as ArtworkRecord);
  }

  async adminUpdate(req: any, artworkId: string, body: any) {
    this.ensureAdmin(req);
    const item = await this.fetchArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });

    const hasCertificateFileIds = Object.prototype.hasOwnProperty.call(body || {}, 'certificateFileIds');
    const hasCoverFileId = Object.prototype.hasOwnProperty.call(body || {}, 'coverFileId');
    const hasMedia = Object.prototype.hasOwnProperty.call(body || {}, 'media');

    const category = body?.category !== undefined ? this.normalizeCategory(body?.category) : undefined;
    const calligraphyScript = body?.calligraphyScript !== undefined ? this.normalizeCalligraphyScript(body?.calligraphyScript) : undefined;
    const paintingGenre = body?.paintingGenre !== undefined ? this.normalizePaintingGenre(body?.paintingGenre) : undefined;
    const creationDate = body?.creationDate !== undefined ? this.parseOptionalDate(body?.creationDate, 'creationDate') : undefined;
    const creationYear = body?.creationYear !== undefined ? this.parseOptionalInt(body?.creationYear, 'creationYear', 0) : undefined;
    const priceType = body?.priceType !== undefined ? this.normalizePriceType(body?.priceType) : undefined;
    const priceAmountFen = body?.priceAmountFen !== undefined ? this.parseOptionalInt(body?.priceAmountFen, 'priceAmountFen', 0) : undefined;
    const depositAmountFen = body?.depositAmountFen !== undefined ? this.parseOptionalInt(body?.depositAmountFen, 'depositAmountFen', 0) : undefined;
    const certificateFileIds = hasCertificateFileIds ? this.normalizeFileIds(body?.certificateFileIds) : undefined;
    const mediaInput = hasMedia ? normalizeMediaInput(body?.media) : [];
    const sellerUserId = body?.sellerUserId
      ? String(body.sellerUserId)
      : body?.publisherUserId
        ? String(body.publisherUserId)
        : body?.ownerId
          ? String(body.ownerId)
          : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.artwork.update({
        where: { id: artworkId },
        data: {
          sellerUserId: sellerUserId ?? undefined,
          source: body?.source !== undefined ? this.normalizeContentSource(body?.source) ?? item.source : undefined,
          title: body?.title ?? undefined,
          description: body?.description ?? undefined,
          category: category ?? undefined,
          calligraphyScript: calligraphyScript ?? null,
          paintingGenre: paintingGenre ?? null,
          creatorName: body?.creatorName ?? undefined,
          creationDate: creationDate ?? null,
          creationYear: creationYear ?? null,
          certificateNo: body?.certificateNo ?? undefined,
          certificateFileIdsJson: hasCertificateFileIds
            ? certificateFileIds && certificateFileIds.length > 0
              ? certificateFileIds
              : Prisma.DbNull
            : undefined,
          priceType: priceType ?? undefined,
          priceAmountFen: priceAmountFen ?? null,
          depositAmountFen: depositAmountFen ?? undefined,
          regionCode: body?.regionCode ?? undefined,
          material: body?.material ?? undefined,
          size: body?.size ?? undefined,
          coverFileId: hasCoverFileId ? (body?.coverFileId ? String(body.coverFileId) : null) : undefined,
          auditStatus: body?.auditStatus !== undefined ? this.normalizeAuditStatus(body?.auditStatus) ?? item.auditStatus : undefined,
          status: body?.status !== undefined ? this.normalizeArtworkStatus(body?.status) ?? item.status : undefined,
        },
      });

      if (hasMedia) {
        await tx.artworkMedia.deleteMany({ where: { artworkId } });
        if (mediaInput.length > 0) {
          await tx.artworkMedia.createMany({
            data: mediaInput.map((media) => ({
              artworkId,
              fileId: media.fileId,
              type: media.type as any,
              sort: media.sort,
            })),
          });
        }
      }
    });

    const updated = await this.fetchArtwork(artworkId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }

  async adminPublish(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { status: 'ACTIVE', auditStatus: 'APPROVED' },
    });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }

  async adminOffShelf(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { status: 'OFF_SHELF' },
    });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }

  async adminApprove(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ARTWORK_APPROVE',
      targetType: 'ARTWORK',
      targetId: artworkId,
      afterJson: { auditStatus: 'APPROVED' },
    });
    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: {
        auditStatus: 'APPROVED',
        status: item.status === 'DRAFT' ? 'ACTIVE' : item.status,
      },
    });
    await this.notifications.create({
      userId: updated.sellerUserId,
      title: '书画审核通过',
      summary: `《${updated.title || '书画作品'}》已通过审核，可在平台展示。`,
      source: '平台审核',
    });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }

  async adminReject(req: any, artworkId: string, body: any) {
    this.ensureAdmin(req);
    const item = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ARTWORK_REJECT',
      targetType: 'ARTWORK',
      targetId: artworkId,
      afterJson: { auditStatus: 'REJECTED', reason: body?.reason },
    });
    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { auditStatus: 'REJECTED' },
    });
    await this.notifications.create({
      userId: updated.sellerUserId,
      title: '书画审核驳回',
      summary: `《${updated.title || '书画作品'}》审核未通过${body?.reason ? `，原因：${body.reason}` : '，请修改后重新提交'}。`,
      source: '平台审核',
    });
    return this.buildArtworkDto(updated as ArtworkRecord);
  }
}
