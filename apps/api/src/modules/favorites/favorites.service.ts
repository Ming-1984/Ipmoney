import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { getAchievement, getArtwork, getDemand, listAchievements, listArtworks, listDemands, seedIfEmpty } from '../content-store';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

const DEMAND_FAVORITES = new Map<string, Set<string>>();
const ACHIEVEMENT_FAVORITES = new Map<string, Set<string>>();
const ARTWORK_FAVORITES = new Map<string, Set<string>>();

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
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
        industryTags: listing.industryTagsJson ?? null,
        featuredLevel: listing.featuredLevel,
        featuredRegionCode: listing.featuredRegionCode ?? null,
        inventorNames: null,
        stats: listing.stats ?? null,
      };
    });

    return { items: mapped, page: { page, pageSize, total } };
  }

  listDemandFavorites(req: any, query: any): Paged<any> {
    this.ensureAuth(req);
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const set = DEMAND_FAVORITES.get(req.auth.userId) || new Set<string>();
    const items = listDemands().filter((d) => set.has(d.id));
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  listAchievementFavorites(req: any, query: any): Paged<any> {
    this.ensureAuth(req);
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const set = ACHIEVEMENT_FAVORITES.get(req.auth.userId) || new Set<string>();
    const items = listAchievements().filter((d) => set.has(d.id));
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  listArtworkFavorites(req: any, query: any): Paged<any> {
    this.ensureAuth(req);
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const set = ARTWORK_FAVORITES.get(req.auth.userId) || new Set<string>();
    const items = listArtworks().filter((d) => set.has(d.id));
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
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

  favoriteDemand(req: any, demandId: string) {
    this.ensureAuth(req);
    if (!getDemand(demandId)) throw new NotFoundException({ code: 'NOT_FOUND', message: '需求不存在' });
    const set = DEMAND_FAVORITES.get(req.auth.userId) || new Set<string>();
    set.add(demandId);
    DEMAND_FAVORITES.set(req.auth.userId, set);
    return { ok: true };
  }

  unfavoriteDemand(req: any, demandId: string) {
    this.ensureAuth(req);
    const set = DEMAND_FAVORITES.get(req.auth.userId) || new Set<string>();
    set.delete(demandId);
    DEMAND_FAVORITES.set(req.auth.userId, set);
    return { ok: true };
  }

  favoriteAchievement(req: any, achievementId: string) {
    this.ensureAuth(req);
    if (!getAchievement(achievementId)) throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    const set = ACHIEVEMENT_FAVORITES.get(req.auth.userId) || new Set<string>();
    set.add(achievementId);
    ACHIEVEMENT_FAVORITES.set(req.auth.userId, set);
    return { ok: true };
  }

  unfavoriteAchievement(req: any, achievementId: string) {
    this.ensureAuth(req);
    const set = ACHIEVEMENT_FAVORITES.get(req.auth.userId) || new Set<string>();
    set.delete(achievementId);
    ACHIEVEMENT_FAVORITES.set(req.auth.userId, set);
    return { ok: true };
  }

  favoriteArtwork(req: any, artworkId: string) {
    this.ensureAuth(req);
    if (!getArtwork(artworkId)) throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    const set = ARTWORK_FAVORITES.get(req.auth.userId) || new Set<string>();
    set.add(artworkId);
    ARTWORK_FAVORITES.set(req.auth.userId, set);
    return { ok: true };
  }

  unfavoriteArtwork(req: any, artworkId: string) {
    this.ensureAuth(req);
    const set = ARTWORK_FAVORITES.get(req.auth.userId) || new Set<string>();
    set.delete(artworkId);
    ARTWORK_FAVORITES.set(req.auth.userId, set);
    return { ok: true };
  }
}
