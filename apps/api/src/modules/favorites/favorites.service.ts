import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { buildPublisherMap, mapStats } from '../content-utils';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '鏃犳潈闄?' });
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
      industryTags: this.asArray(item.industryTagsJson),
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
      industryTags: this.asArray(item.industryTagsJson),
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
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
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
        industryTags: Array.isArray(listing.industryTagsJson) ? listing.industryTagsJson : [],
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
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));

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
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));

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
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));

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
    await this.prisma.listing.findUnique({ where: { id: listingId } });
    await this.prisma.listingFavorite.upsert({
      where: { listingId_userId: { listingId, userId: req.auth.userId } },
      create: { listingId, userId: req.auth.userId },
      update: {},
    });
    return { ok: true };
  }

  async unfavoriteListing(req: any, listingId: string) {
    this.ensureAuth(req);
    await this.prisma.listingFavorite.deleteMany({ where: { listingId, userId: req.auth.userId } });
    return { ok: true };
  }

  async favoriteDemand(req: any, demandId: string) {
    this.ensureAuth(req);
    const demand = await this.prisma.demand.findUnique({ where: { id: demandId } });
    if (!demand) throw new NotFoundException({ code: 'NOT_FOUND', message: '闇€姹備笉瀛樺湪' });
    await this.prisma.demandFavorite.upsert({
      where: { demandId_userId: { demandId, userId: req.auth.userId } },
      create: { demandId, userId: req.auth.userId },
      update: {},
    });
    return { ok: true };
  }

  async unfavoriteDemand(req: any, demandId: string) {
    this.ensureAuth(req);
    await this.prisma.demandFavorite.deleteMany({ where: { demandId, userId: req.auth.userId } });
    return { ok: true };
  }

  async favoriteAchievement(req: any, achievementId: string) {
    this.ensureAuth(req);
    const achievement = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!achievement) throw new NotFoundException({ code: 'NOT_FOUND', message: '鎴愭灉涓嶅瓨鍦?' });
    await this.prisma.achievementFavorite.upsert({
      where: { achievementId_userId: { achievementId, userId: req.auth.userId } },
      create: { achievementId, userId: req.auth.userId },
      update: {},
    });
    return { ok: true };
  }

  async unfavoriteAchievement(req: any, achievementId: string) {
    this.ensureAuth(req);
    await this.prisma.achievementFavorite.deleteMany({ where: { achievementId, userId: req.auth.userId } });
    return { ok: true };
  }

  async favoriteArtwork(req: any, artworkId: string) {
    this.ensureAuth(req);
    const artwork = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!artwork) throw new NotFoundException({ code: 'NOT_FOUND', message: '浣滃搧涓嶅瓨鍦?' });
    await this.prisma.artworkFavorite.upsert({
      where: { artworkId_userId: { artworkId, userId: req.auth.userId } },
      create: { artworkId, userId: req.auth.userId },
      update: {},
    });
    return { ok: true };
  }

  async unfavoriteArtwork(req: any, artworkId: string) {
    this.ensureAuth(req);
    await this.prisma.artworkFavorite.deleteMany({ where: { artworkId, userId: req.auth.userId } });
    return { ok: true };
  }
}

