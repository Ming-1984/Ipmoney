import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapStats, sanitizeIndustryTagNames } from '../content-utils';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ContentEventService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
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
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
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
}
