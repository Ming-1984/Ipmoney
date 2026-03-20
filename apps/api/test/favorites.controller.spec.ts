import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FavoritesController } from '../src/modules/favorites/favorites.controller';

const VALID_UUID = '99999999-9999-4999-8999-999999999999';

describe('FavoritesController delegation suite', () => {
  let favorites: any;
  let controller: FavoritesController;

  beforeEach(() => {
    favorites = {
      listListingFavorites: vi.fn(),
      listAchievementFavorites: vi.fn(),
      favoriteListing: vi.fn(),
      unfavoriteListing: vi.fn(),
      favoriteAchievement: vi.fn(),
      unfavoriteAchievement: vi.fn(),
    };
    controller = new FavoritesController(favorites);
  });

  it('delegates listing favorites list queries', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.listListingFavorites.mockResolvedValueOnce({ items: [{ id: VALID_UUID }] });

    await expect(controller.listListingFavorites(req, { page: '1' })).resolves.toEqual({ items: [{ id: VALID_UUID }] });

    expect(favorites.listListingFavorites).toHaveBeenCalledWith(req, { page: '1' });
  });

  it('delegates achievement favorites list queries', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.listAchievementFavorites.mockResolvedValueOnce({ items: [] });

    await expect(controller.listAchievementFavorites(req, { pageSize: '10' })).resolves.toEqual({ items: [] });

    expect(favorites.listAchievementFavorites).toHaveBeenCalledWith(req, { pageSize: '10' });
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

  it('delegates achievement favorite/unfavorite actions', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    favorites.favoriteAchievement.mockResolvedValueOnce({ ok: true });
    favorites.unfavoriteAchievement.mockResolvedValueOnce({ ok: true });

    await expect(controller.favoriteAchievement(req, VALID_UUID)).resolves.toEqual({ ok: true });
    await expect(controller.unfavoriteAchievement(req, VALID_UUID)).resolves.toEqual({ ok: true });

    expect(favorites.favoriteAchievement).toHaveBeenCalledWith(req, VALID_UUID);
    expect(favorites.unfavoriteAchievement).toHaveBeenCalledWith(req, VALID_UUID);
  });
});
