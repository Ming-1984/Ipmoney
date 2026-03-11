import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildPublisherMap, mapStats, sanitizeIndustryTagNames } from '../content-utils';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ContentEventService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '鏃犳潈闄?' });
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
    if (!Number.isInteger(parsed) || parsed <= 0) {
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

  private parsePagination(query: any) {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    return { page, pageSize };
  }

  private asArray(value: unknown): string[] {
    return Array.isArray(value) ? (value as string[]) : [];
  }

  private toDemandSummary(item: any, publisherMap: Record<string, any>) {
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
      industryTags: sanitizeIndustryTagNames(item.industryTagsJson),
      keywords: this.asArray(item.keywordsJson),
      deliveryPeriod: item.deliveryPeriod ?? null,
      publisher,
      stats: mapStats(item.stats),
      auditStatus: item.auditStatus,
      status: item.status,
      coverUrl: item.coverFile?.url ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toAchievementSummary(item: any, publisherMap: Record<string, any>) {
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
      industryTags: sanitizeIndustryTagNames(item.industryTagsJson),
      keywords: this.asArray(item.keywordsJson),
      publisher,
      stats: mapStats(item.stats),
      auditStatus: item.auditStatus,
      status: item.status,
      coverUrl: item.coverFile?.url ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toArtworkSummary(item: any) {
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
    };
  }

  async listListingFavorites(req: any, query: any): Promise<Paged<any>> {
    this.ensureAuth(req);
    const { page, pageSize } = this.parsePagination(query);
    const [items, total] = await Promise.all([
      this.prisma.listingFavorite.findMany({
        where: { userId: req.auth.userId },
        include: { listing: { include: { patent: true, stats: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listingFavorite.count({ where: { userId: req.auth.userId } }),
    ]);

    const mapped = items.map((fav) => {
      const listing = fav.listing;
      return {
        id: listing.id,
        title: listing.title,
        coverUrl: null,
        patentType: listing.patent?.patentType,
        tradeMode: listing.tradeMode,
        priceType: listing.priceType,
        priceAmountFen: listing.priceAmount ?? null,
        depositAmountFen: listing.depositAmount,
        regionCode: listing.regionCode ?? null,
        industryTags: sanitizeIndustryTagNames(listing.industryTagsJson),
        featuredLevel: listing.featuredLevel,
        featuredRegionCode: listing.featuredRegionCode ?? null,
        inventorNames: [],
        stats: mapStats(listing.stats),
      };
    });

    return { items: mapped, page: { page, pageSize, total } };
  }

  async listDemandFavorites(req: any, query: any): Promise<Paged<any>> {
    this.ensureAuth(req);
    const { page, pageSize } = this.parsePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.demandFavorite.findMany({
        where: { userId: req.auth.userId },
        include: { demand: { include: { coverFile: true, stats: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.demandFavorite.count({ where: { userId: req.auth.userId } }),
    ]);

    const demands = items.map((fav) => fav.demand).filter(Boolean);
    const publisherMap = await buildPublisherMap(
      this.prisma,
      demands.map((item: any) => item.publisherUserId),
    );

    return {
      items: items.map((fav) => this.toDemandSummary(fav.demand, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async listAchievementFavorites(req: any, query: any): Promise<Paged<any>> {
    this.ensureAuth(req);
    const { page, pageSize } = this.parsePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.achievementFavorite.findMany({
        where: { userId: req.auth.userId },
        include: { achievement: { include: { coverFile: true, stats: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.achievementFavorite.count({ where: { userId: req.auth.userId } }),
    ]);

    const achievements = items.map((fav) => fav.achievement).filter(Boolean);
    const publisherMap = await buildPublisherMap(
      this.prisma,
      achievements.map((item: any) => item.publisherUserId),
    );

    return {
      items: items.map((fav) => this.toAchievementSummary(fav.achievement, publisherMap)),
      page: { page, pageSize, total },
    };
  }

  async listArtworkFavorites(req: any, query: any): Promise<Paged<any>> {
    this.ensureAuth(req);
    const { page, pageSize } = this.parsePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.artworkFavorite.findMany({
        where: { userId: req.auth.userId },
        include: { artwork: { include: { coverFile: true, stats: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.artworkFavorite.count({ where: { userId: req.auth.userId } }),
    ]);

    return {
      items: items.map((fav) => this.toArtworkSummary(fav.artwork)),
      page: { page, pageSize, total },
    };
  }

  async favoriteListing(req: any, listingId: string) {
    this.ensureAuth(req);
    const normalizedListingId = this.parseUuidStrict(listingId, 'listingId');
    const listing = await this.prisma.listing.findUnique({ where: { id: normalizedListingId } });
    if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    try {
      await this.prisma.listingFavorite.create({
        data: { listingId: normalizedListingId, userId: req.auth.userId },
      });
      await this.events.adjustFavoriteCount('LISTING', normalizedListingId, 1);
      void this.events.recordFavorite(req, 'LISTING', normalizedListingId).catch(() => {});
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ok: true };
      }
      throw e;
    }
    return { ok: true };
  }

  async unfavoriteListing(req: any, listingId: string) {
    this.ensureAuth(req);
    const normalizedListingId = this.parseUuidStrict(listingId, 'listingId');
    const removed = await this.prisma.listingFavorite.deleteMany({
      where: { listingId: normalizedListingId, userId: req.auth.userId },
    });
    if (removed.count > 0) {
      await this.events.adjustFavoriteCount('LISTING', normalizedListingId, -1);
    }
    return { ok: true };
  }

  async favoriteDemand(req: any, demandId: string) {
    this.ensureAuth(req);
    const normalizedDemandId = this.parseUuidStrict(demandId, 'demandId');
    const demand = await this.prisma.demand.findUnique({ where: { id: normalizedDemandId } });
    if (!demand) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    try {
      await this.prisma.demandFavorite.create({
        data: { demandId: normalizedDemandId, userId: req.auth.userId },
      });
      await this.events.adjustFavoriteCount('DEMAND', normalizedDemandId, 1);
      void this.events.recordFavorite(req, 'DEMAND', normalizedDemandId).catch(() => {});
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ok: true };
      }
      throw e;
    }
    return { ok: true };
  }

  async unfavoriteDemand(req: any, demandId: string) {
    this.ensureAuth(req);
    const normalizedDemandId = this.parseUuidStrict(demandId, 'demandId');
    const removed = await this.prisma.demandFavorite.deleteMany({
      where: { demandId: normalizedDemandId, userId: req.auth.userId },
    });
    if (removed.count > 0) {
      await this.events.adjustFavoriteCount('DEMAND', normalizedDemandId, -1);
    }
    return { ok: true };
  }

  async favoriteAchievement(req: any, achievementId: string) {
    this.ensureAuth(req);
    const normalizedAchievementId = this.parseUuidStrict(achievementId, 'achievementId');
    const achievement = await this.prisma.achievement.findUnique({ where: { id: normalizedAchievementId } });
    if (!achievement) throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愭灉涓嶅瓨鍦?' });
    try {
      await this.prisma.achievementFavorite.create({
        data: { achievementId: normalizedAchievementId, userId: req.auth.userId },
      });
      await this.events.adjustFavoriteCount('ACHIEVEMENT', normalizedAchievementId, 1);
      void this.events.recordFavorite(req, 'ACHIEVEMENT', normalizedAchievementId).catch(() => {});
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ok: true };
      }
      throw e;
    }
    return { ok: true };
  }

  async unfavoriteAchievement(req: any, achievementId: string) {
    this.ensureAuth(req);
    const normalizedAchievementId = this.parseUuidStrict(achievementId, 'achievementId');
    const removed = await this.prisma.achievementFavorite.deleteMany({
      where: { achievementId: normalizedAchievementId, userId: req.auth.userId },
    });
    if (removed.count > 0) {
      await this.events.adjustFavoriteCount('ACHIEVEMENT', normalizedAchievementId, -1);
    }
    return { ok: true };
  }

  async favoriteArtwork(req: any, artworkId: string) {
    this.ensureAuth(req);
    const normalizedArtworkId = this.parseUuidStrict(artworkId, 'artworkId');
    const artwork = await this.prisma.artwork.findUnique({ where: { id: normalizedArtworkId } });
    if (!artwork) throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    try {
      await this.prisma.artworkFavorite.create({
        data: { artworkId: normalizedArtworkId, userId: req.auth.userId },
      });
      await this.events.adjustFavoriteCount('ARTWORK', normalizedArtworkId, 1);
      void this.events.recordFavorite(req, 'ARTWORK', normalizedArtworkId).catch(() => {});
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ok: true };
      }
      throw e;
    }
    return { ok: true };
  }

  async unfavoriteArtwork(req: any, artworkId: string) {
    this.ensureAuth(req);
    const normalizedArtworkId = this.parseUuidStrict(artworkId, 'artworkId');
    const removed = await this.prisma.artworkFavorite.deleteMany({
      where: { artworkId: normalizedArtworkId, userId: req.auth.userId },
    });
    if (removed.count > 0) {
      await this.events.adjustFavoriteCount('ARTWORK', normalizedArtworkId, -1);
    }
    return { ok: true };
  }
}

