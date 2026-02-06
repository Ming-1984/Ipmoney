import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { ConversationsService } from './conversations.service';

@Controller()
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/me/conversations')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.conversations.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/listings/:listingId/conversations')
  async createListingConversation(@Req() req: any, @Param('listingId') listingId: string) {
    return await this.conversations.createListingConversation(req, listingId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/demands/:demandId/conversations')
  async createDemandConversation(@Req() req: any, @Param('demandId') demandId: string) {
    return await this.conversations.createVirtualConversation(req, 'DEMAND', demandId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/achievements/:achievementId/conversations')
  async createAchievementConversation(@Req() req: any, @Param('achievementId') achievementId: string) {
    return await this.conversations.createVirtualConversation(req, 'ACHIEVEMENT', achievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/artworks/:artworkId/conversations')
  async createArtworkConversation(@Req() req: any, @Param('artworkId') artworkId: string) {
    return await this.conversations.createVirtualConversation(req, 'ARTWORK', artworkId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/tech-managers/:techManagerId/conversations')
  async createTechManagerConversation(@Req() req: any, @Param('techManagerId') techManagerId: string) {
    return await this.conversations.createVirtualConversation(req, 'TECH_MANAGER', techManagerId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/conversations/:conversationId/messages')
  async listMessages(@Req() req: any, @Param('conversationId') conversationId: string, @Query() query: any) {
    return await this.conversations.listMessages(req, conversationId, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/conversations/:conversationId/messages')
  async sendMessage(@Req() req: any, @Param('conversationId') conversationId: string, @Body() body: any) {
    return await this.conversations.sendMessage(req, conversationId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/conversations/:conversationId/read')
  async markRead(@Req() req: any, @Param('conversationId') conversationId: string) {
    return await this.conversations.markRead(req, conversationId);
  }
}
