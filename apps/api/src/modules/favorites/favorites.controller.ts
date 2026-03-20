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
  @Post('/listings/:listingId/favorites')
  async favoriteListing(@Req() req: any, @Param('listingId') listingId: string) {
    return await this.favorites.favoriteListing(req, listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/listings/:listingId/favorites')
  async unfavoriteListing(@Req() req: any, @Param('listingId') listingId: string) {
    return await this.favorites.unfavoriteListing(req, listingId);
  }
}
