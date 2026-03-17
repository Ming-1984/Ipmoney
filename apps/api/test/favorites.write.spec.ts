import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FavoritesService } from '../src/modules/favorites/favorites.service';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';

type FavoriteCase = {
  name: string;
  entityField: string;
  eventType: 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK';
  notFoundMessage: string;
  favoriteMethod:
    | 'favoriteListing'
    | 'favoriteDemand'
    | 'favoriteAchievement'
    | 'favoriteArtwork';
  unfavoriteMethod:
    | 'unfavoriteListing'
    | 'unfavoriteDemand'
    | 'unfavoriteAchievement'
    | 'unfavoriteArtwork';
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

describe('FavoritesService write-first suite', () => {
  let prisma: any;
  let events: any;
  let service: FavoritesService;

  beforeEach(() => {
    prisma = {
      listing: { findUnique: vi.fn() },
      listingFavorite: { create: vi.fn(), deleteMany: vi.fn() },
      demand: { findUnique: vi.fn() },
      demandFavorite: { create: vi.fn(), deleteMany: vi.fn() },
      achievement: { findUnique: vi.fn() },
      achievementFavorite: { create: vi.fn(), deleteMany: vi.fn() },
      artwork: { findUnique: vi.fn() },
      artworkFavorite: { create: vi.fn(), deleteMany: vi.fn() },
    };
    events = {
      adjustFavoriteCount: vi.fn().mockResolvedValue(undefined),
      recordFavorite: vi.fn().mockResolvedValue(undefined),
    };
    service = new FavoritesService(prisma, events);
  });

  const authedReq = { auth: { userId: USER_ID } };

  const cases: FavoriteCase[] = [
    {
      name: 'listing',
      entityField: 'listingId',
      eventType: 'LISTING',
      notFoundMessage: 'listing not found',
      favoriteMethod: 'favoriteListing',
      unfavoriteMethod: 'unfavoriteListing',
      findUnique: prisma?.listing?.findUnique,
      create: prisma?.listingFavorite?.create,
      deleteMany: prisma?.listingFavorite?.deleteMany,
    },
    {
      name: 'demand',
      entityField: 'demandId',
      eventType: 'DEMAND',
      notFoundMessage: '闇€姹備笉瀛樺湪',
      favoriteMethod: 'favoriteDemand',
      unfavoriteMethod: 'unfavoriteDemand',
      findUnique: prisma?.demand?.findUnique,
      create: prisma?.demandFavorite?.create,
      deleteMany: prisma?.demandFavorite?.deleteMany,
    },
    {
      name: 'achievement',
      entityField: 'achievementId',
      eventType: 'ACHIEVEMENT',
      notFoundMessage: '鎴愭灉涓嶅瓨鍦?',
      favoriteMethod: 'favoriteAchievement',
      unfavoriteMethod: 'unfavoriteAchievement',
      findUnique: prisma?.achievement?.findUnique,
      create: prisma?.achievementFavorite?.create,
      deleteMany: prisma?.achievementFavorite?.deleteMany,
    },
    {
      name: 'artwork',
      entityField: 'artworkId',
      eventType: 'ARTWORK',
      notFoundMessage: '浣滃搧涓嶅瓨鍦?',
      favoriteMethod: 'favoriteArtwork',
      unfavoriteMethod: 'unfavoriteArtwork',
      findUnique: prisma?.artwork?.findUnique,
      create: prisma?.artworkFavorite?.create,
      deleteMany: prisma?.artworkFavorite?.deleteMany,
    },
  ];

  function bindCase(caseName: FavoriteCase['name']): FavoriteCase {
    if (caseName === 'listing') {
      return {
        ...cases[0],
        findUnique: prisma.listing.findUnique,
        create: prisma.listingFavorite.create,
        deleteMany: prisma.listingFavorite.deleteMany,
      };
    }
    if (caseName === 'demand') {
      return {
        ...cases[1],
        findUnique: prisma.demand.findUnique,
        create: prisma.demandFavorite.create,
        deleteMany: prisma.demandFavorite.deleteMany,
      };
    }
    if (caseName === 'achievement') {
      return {
        ...cases[2],
        findUnique: prisma.achievement.findUnique,
        create: prisma.achievementFavorite.create,
        deleteMany: prisma.achievementFavorite.deleteMany,
      };
    }
    return {
      ...cases[3],
      findUnique: prisma.artwork.findUnique,
      create: prisma.artworkFavorite.create,
      deleteMany: prisma.artworkFavorite.deleteMany,
    };
  }

  for (const c of cases) {
    describe(`${c.name} favorite/unfavorite`, () => {
      it('rejects invalid uuid on favorite', async () => {
        const bound = bindCase(c.name);
        await expect((service as any)[bound.favoriteMethod](authedReq, 'invalid-id')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });

      it('rejects missing target on favorite', async () => {
        const bound = bindCase(c.name);
        bound.findUnique.mockResolvedValueOnce(null);

        await expect((service as any)[bound.favoriteMethod](authedReq, VALID_UUID)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('creates favorite and emits counters on favorite success', async () => {
        const bound = bindCase(c.name);
        bound.findUnique.mockResolvedValueOnce({ id: VALID_UUID });
        bound.create.mockResolvedValueOnce({ id: 'fav-1' });

        const result = await (service as any)[bound.favoriteMethod](authedReq, VALID_UUID);

        expect(result).toEqual({ ok: true });
        expect(bound.create).toHaveBeenCalledWith({
          data: { [bound.entityField]: VALID_UUID, userId: USER_ID },
        });
        expect(events.adjustFavoriteCount).toHaveBeenCalledWith(bound.eventType, VALID_UUID, 1);
        expect(events.recordFavorite).toHaveBeenCalledWith(authedReq, bound.eventType, VALID_UUID);
      });

      it('treats duplicate as idempotent success on favorite', async () => {
        const bound = bindCase(c.name);
        bound.findUnique.mockResolvedValueOnce({ id: VALID_UUID });
        bound.create.mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }),
        );

        const result = await (service as any)[bound.favoriteMethod](authedReq, VALID_UUID);

        expect(result).toEqual({ ok: true });
        expect(events.adjustFavoriteCount).not.toHaveBeenCalled();
        expect(events.recordFavorite).not.toHaveBeenCalled();
      });

      it('rejects invalid uuid on unfavorite', async () => {
        const bound = bindCase(c.name);
        await expect((service as any)[bound.unfavoriteMethod](authedReq, 'bad-id')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });

      it('decrements stats when unfavorite removes rows', async () => {
        const bound = bindCase(c.name);
        bound.deleteMany.mockResolvedValueOnce({ count: 1 });

        const result = await (service as any)[bound.unfavoriteMethod](authedReq, VALID_UUID);

        expect(result).toEqual({ ok: true });
        expect(bound.deleteMany).toHaveBeenCalledWith({
          where: { [bound.entityField]: VALID_UUID, userId: USER_ID },
        });
        expect(events.adjustFavoriteCount).toHaveBeenCalledWith(bound.eventType, VALID_UUID, -1);
      });

      it('is idempotent when unfavorite removes nothing', async () => {
        const bound = bindCase(c.name);
        bound.deleteMany.mockResolvedValueOnce({ count: 0 });

        const result = await (service as any)[bound.unfavoriteMethod](authedReq, VALID_UUID);

        expect(result).toEqual({ ok: true });
        expect(events.adjustFavoriteCount).not.toHaveBeenCalled();
      });
    });
  }

  it('rejects unauthenticated favorite', async () => {
    await expect(service.favoriteListing({}, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
