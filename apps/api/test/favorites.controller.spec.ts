import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FavoritesController } from '../src/modules/favorites/favorites.controller';

const VALID_UUID = '99999999-9999-4999-8999-999999999999';

describe('FavoritesController delegation suite', () => {
  let favorites: any;
  let controller: FavoritesController;

  beforeEach(() => {
    favorites = {
      listListingFavorites: vi.fn(),
      listDemandFavorites: vi.fn(),
      listAchievementFavorites: vi.fn(),
      listArtworkFavorites: vi.fn(),
      favoriteListing: vi.fn(),
      unfavoriteListing: vi.fn(),
      favoriteDemand: vi.fn(),
      unfavoriteDemand: vi.fn(),
      favoriteAchievement: vi.fn(),
      unfavoriteAchievement: vi.fn(),
      favoriteArtwork: vi.fn(),
      unfavoriteArtwork: vi.fn(),
    };
    controller = new FavoritesController(favorites);
  });

  it('delegates listing and demand favorites list queries', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.listListingFavorites.mockResolvedValueOnce({ items: [{ id: VALID_UUID }] });
    favorites.listDemandFavorites.mockResolvedValueOnce({ items: [] });

    await expect(controller.listListingFavorites(req, { page: '1' })).resolves.toEqual({ items: [{ id: VALID_UUID }] });
    await expect(controller.listDemandFavorites(req, { page: '2' })).resolves.toEqual({ items: [] });

    expect(favorites.listListingFavorites).toHaveBeenCalledWith(req, { page: '1' });
    expect(favorites.listDemandFavorites).toHaveBeenCalledWith(req, { page: '2' });
  });

  it('delegates achievement and artwork favorites list queries', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.listAchievementFavorites.mockResolvedValueOnce({ items: [] });
    favorites.listArtworkFavorites.mockResolvedValueOnce({ items: [{ id: VALID_UUID }] });

    await expect(controller.listAchievementFavorites(req, { pageSize: '10' })).resolves.toEqual({ items: [] });
    await expect(controller.listArtworkFavorites(req, { pageSize: '5' })).resolves.toEqual({
      items: [{ id: VALID_UUID }],
    });

    expect(favorites.listAchievementFavorites).toHaveBeenCalledWith(req, { pageSize: '10' });
    expect(favorites.listArtworkFavorites).toHaveBeenCalledWith(req, { pageSize: '5' });
  });

  it('delegates listing favorite/unfavorite actions', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.favoriteListing.mockResolvedValueOnce({ ok: true });
    favorites.unfavoriteListing.mockResolvedValueOnce({ ok: true });

    await expect(controller.favoriteListing(req, VALID_UUID)).resolves.toEqual({ ok: true });
    await expect(controller.unfavoriteListing(req, VALID_UUID)).resolves.toEqual({ ok: true });

    expect(favorites.favoriteListing).toHaveBeenCalledWith(req, VALID_UUID);
    expect(favorites.unfavoriteListing).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates demand favorite/unfavorite actions', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.favoriteDemand.mockResolvedValueOnce({ ok: true });
    favorites.unfavoriteDemand.mockResolvedValueOnce({ ok: true });

    await expect(controller.favoriteDemand(req, VALID_UUID)).resolves.toEqual({ ok: true });
    await expect(controller.unfavoriteDemand(req, VALID_UUID)).resolves.toEqual({ ok: true });

    expect(favorites.favoriteDemand).toHaveBeenCalledWith(req, VALID_UUID);
    expect(favorites.unfavoriteDemand).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates achievement and artwork favorite/unfavorite actions', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.favoriteAchievement.mockResolvedValueOnce({ ok: true });
    favorites.unfavoriteAchievement.mockResolvedValueOnce({ ok: true });
    favorites.favoriteArtwork.mockResolvedValueOnce({ ok: true });
    favorites.unfavoriteArtwork.mockResolvedValueOnce({ ok: true });

    await expect(controller.favoriteAchievement(req, VALID_UUID)).resolves.toEqual({ ok: true });
    await expect(controller.unfavoriteAchievement(req, VALID_UUID)).resolves.toEqual({ ok: true });
    await expect(controller.favoriteArtwork(req, VALID_UUID)).resolves.toEqual({ ok: true });
    await expect(controller.unfavoriteArtwork(req, VALID_UUID)).resolves.toEqual({ ok: true });

    expect(favorites.favoriteAchievement).toHaveBeenCalledWith(req, VALID_UUID);
    expect(favorites.unfavoriteAchievement).toHaveBeenCalledWith(req, VALID_UUID);
    expect(favorites.favoriteArtwork).toHaveBeenCalledWith(req, VALID_UUID);
    expect(favorites.unfavoriteArtwork).toHaveBeenCalledWith(req, VALID_UUID);
  });
});
