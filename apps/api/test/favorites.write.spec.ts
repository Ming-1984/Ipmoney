import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FavoritesService } from '../src/modules/favorites/favorites.service';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';

describe('FavoritesService write-first suite', () => {
  let prisma: any;
  let events: any;
  let service: FavoritesService;

  beforeEach(() => {
    prisma = {
      listing: { findUnique: vi.fn() },
      listingFavorite: { create: vi.fn(), deleteMany: vi.fn() },
    };
    events = {
      adjustFavoriteCount: vi.fn().mockResolvedValue(undefined),
      recordFavorite: vi.fn().mockResolvedValue(undefined),
    };
    service = new FavoritesService(prisma, events);
  });

  const authedReq = { auth: { userId: USER_ID } };

  it('rejects invalid uuid on favorite', async () => {
    await expect(service.favoriteListing(authedReq, 'invalid-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing target on favorite', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);

    await expect(service.favoriteListing(authedReq, VALID_UUID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates favorite and emits counters on favorite success', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce({ id: VALID_UUID });
    prisma.listingFavorite.create.mockResolvedValueOnce({ id: 'fav-1' });

    const result = await service.favoriteListing(authedReq, VALID_UUID);

    expect(result).toEqual({ ok: true });
    expect(prisma.listingFavorite.create).toHaveBeenCalledWith({
      data: { listingId: VALID_UUID, userId: USER_ID },
    });
    expect(events.adjustFavoriteCount).toHaveBeenCalledWith('LISTING', VALID_UUID, 1);
    expect(events.recordFavorite).toHaveBeenCalledWith(authedReq, 'LISTING', VALID_UUID);
  });

  it('treats duplicate as idempotent success on favorite', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce({ id: VALID_UUID });
    prisma.listingFavorite.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }),
    );

    const result = await service.favoriteListing(authedReq, VALID_UUID);

    expect(result).toEqual({ ok: true });
    expect(events.adjustFavoriteCount).not.toHaveBeenCalled();
    expect(events.recordFavorite).not.toHaveBeenCalled();
  });

  it('rejects invalid uuid on unfavorite', async () => {
    await expect(service.unfavoriteListing(authedReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('decrements stats when unfavorite removes rows', async () => {
    prisma.listingFavorite.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.unfavoriteListing(authedReq, VALID_UUID);

    expect(result).toEqual({ ok: true });
    expect(prisma.listingFavorite.deleteMany).toHaveBeenCalledWith({
      where: { listingId: VALID_UUID, userId: USER_ID },
    });
    expect(events.adjustFavoriteCount).toHaveBeenCalledWith('LISTING', VALID_UUID, -1);
  });

  it('is idempotent when unfavorite removes nothing', async () => {
    prisma.listingFavorite.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.unfavoriteListing(authedReq, VALID_UUID);

    expect(result).toEqual({ ok: true });
    expect(events.adjustFavoriteCount).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated favorite', async () => {
    await expect(service.favoriteListing({}, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
