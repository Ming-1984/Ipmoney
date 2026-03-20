import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard';
import { CommentsService } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('/public/listings/:listingId/comments')
  async listListingComments(@Param('listingId') listingId: string, @Query() query: any) {
    return await this.comments.listThreads('LISTING', listingId, query);
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Post('/listings/:listingId/comments')
  async createListingComment(@Req() req: any, @Param('listingId') listingId: string, @Body() body: any) {
    return await this.comments.createComment(req, 'LISTING', listingId, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Patch('/comments/:commentId')
  async editComment(@Req() req: any, @Param('commentId') commentId: string, @Body() body: any) {
    return await this.comments.editComment(req, commentId, body || {});
  }

  @UseGuards(BearerAuthGuard, VerifiedUserGuard)
  @Delete('/comments/:commentId')
  async deleteComment(@Req() req: any, @Param('commentId') commentId: string) {
    return await this.comments.deleteComment(req, commentId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/comments')
  async adminList(@Req() req: any, @Query() query: any) {
    return await this.comments.adminList(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/comments/:commentId')
  async adminUpdate(@Req() req: any, @Param('commentId') commentId: string, @Body() body: any) {
    return await this.comments.adminUpdate(req, commentId, body || {});
  }
}
