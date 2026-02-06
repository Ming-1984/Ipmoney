import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { CommentsService } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('/public/listings/:listingId/comments')
  async listListingComments(@Param('listingId') listingId: string, @Query() query: any) {
    return await this.comments.listThreads('LISTING', listingId, query);
  }

  @Get('/public/demands/:demandId/comments')
  async listDemandComments(@Param('demandId') demandId: string, @Query() query: any) {
    return await this.comments.listThreads('DEMAND', demandId, query);
  }

  @Get('/public/achievements/:achievementId/comments')
  async listAchievementComments(@Param('achievementId') achievementId: string, @Query() query: any) {
    return await this.comments.listThreads('ACHIEVEMENT', achievementId, query);
  }

  @Get('/public/artworks/:artworkId/comments')
  async listArtworkComments(@Param('artworkId') artworkId: string, @Query() query: any) {
    return await this.comments.listThreads('ARTWORK', artworkId, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/listings/:listingId/comments')
  async createListingComment(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    return await this.comments.createComment(req, 'LISTING', listingId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/demands/:demandId/comments')
  async createDemandComment(@Req() req: any, @Param('demandId') demandId: string, @Body() body: any) {
    return await this.comments.createComment(req, 'DEMAND', demandId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/achievements/:achievementId/comments')
  async createAchievementComment(@Req() req: any, @Param('achievementId') achievementId: string, @Body() body: any) {
    return await this.comments.createComment(req, 'ACHIEVEMENT', achievementId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/artworks/:artworkId/comments')
  async createArtworkComment(@Req() req: any, @Param('artworkId') artworkId: string, @Body() body: any) {
    return await this.comments.createComment(req, 'ARTWORK', artworkId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/comments/:commentId')
  async editComment(@Req() req: any, @Param('commentId') commentId: string, @Body() body: any) {
    return await this.comments.editComment(req, commentId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/comments/:commentId')
  async deleteComment(@Req() req: any, @Param('commentId') commentId: string) {
    return await this.comments.deleteComment(req, commentId);
  }
}
