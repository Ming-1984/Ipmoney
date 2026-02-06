import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { FavoritesService } from './favorites.service';

@Controller()
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/me/favorites')
  async listListingFavorites(@Req() req: any, @Query() query: any) {
    return await this.favorites.listListingFavorites(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/me/favorites/demands')
  async listDemandFavorites(@Req() req: any, @Query() query: any) {
    return await this.favorites.listDemandFavorites(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/me/favorites/achievements')
  async listAchievementFavorites(@Req() req: any, @Query() query: any) {
    return await this.favorites.listAchievementFavorites(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/me/favorites/artworks')
  async listArtworkFavorites(@Req() req: any, @Query() query: any) {
    return await this.favorites.listArtworkFavorites(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/listings/:listingId/favorites')
  async favoriteListing(@Req() req: any, @Param('listingId') listingId: string) {
    return await this.favorites.favoriteListing(req, listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/listings/:listingId/favorites')
  async unfavoriteListing(@Req() req: any, @Param('listingId') listingId: string) {
    return await this.favorites.unfavoriteListing(req, listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/demands/:demandId/favorites')
  async favoriteDemand(@Req() req: any, @Param('demandId') demandId: string) {
    return await this.favorites.favoriteDemand(req, demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/demands/:demandId/favorites')
  async unfavoriteDemand(@Req() req: any, @Param('demandId') demandId: string) {
    return await this.favorites.unfavoriteDemand(req, demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/achievements/:achievementId/favorites')
  async favoriteAchievement(@Req() req: any, @Param('achievementId') achievementId: string) {
    return await this.favorites.favoriteAchievement(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/achievements/:achievementId/favorites')
  async unfavoriteAchievement(@Req() req: any, @Param('achievementId') achievementId: string) {
    return await this.favorites.unfavoriteAchievement(req, achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/artworks/:artworkId/favorites')
  async favoriteArtwork(@Req() req: any, @Param('artworkId') artworkId: string) {
    return await this.favorites.favoriteArtwork(req, artworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/artworks/:artworkId/favorites')
  async unfavoriteArtwork(@Req() req: any, @Param('artworkId') artworkId: string) {
    return await this.favorites.unfavoriteArtwork(req, artworkId);
  }
}
