import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { ConversationsService } from './conversations.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  private parseUuidParam(value: string, fieldName: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  @UseGuards(BearerAuthGuard)
  @Get('/me/conversations')
  async listMine(@Req() req: any, @Query() query: any) {
    return await this.conversations.listMine(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/listings/:listingId/conversations')
  async createListingConversation(@Req() req: any, @Param('listingId') listingId: string) {
    const normalizedListingId = this.parseUuidParam(listingId, 'listingId');
    return await this.conversations.createListingConversation(req, normalizedListingId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/achievements/:achievementId/conversations')
  async createAchievementConversation(@Req() req: any, @Param('achievementId') achievementId: string) {
    const normalizedAchievementId = this.parseUuidParam(achievementId, 'achievementId');
    return await this.conversations.createAchievementConversation(req, normalizedAchievementId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/tech-managers/:techManagerId/conversations')
  async createTechManagerConversation(@Req() req: any, @Param('techManagerId') techManagerId: string) {
    const normalizedTechManagerId = this.parseUuidParam(techManagerId, 'techManagerId');
    return await this.conversations.createTechManagerConversation(req, normalizedTechManagerId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/support/conversations')
  async createSupportConversation(@Req() req: any) {
    return await this.conversations.createSupportConversation(req);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/orders/:orderId/dispute-conversations')
  async createOrderDisputeConversation(@Req() req: any, @Param('orderId') orderId: string) {
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    return await this.conversations.createOrderDisputeConversation(req, normalizedOrderId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/patent-maintenance/orders/:orderId/conversations')
  async createMaintenanceConversation(@Req() req: any, @Param('orderId') orderId: string) {
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    return await this.conversations.createMaintenanceConversation(req, normalizedOrderId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/conversations/:conversationId/messages')
  async listMessages(@Req() req: any, @Param('conversationId') conversationId: string, @Query() query: any) {
    const normalizedConversationId = this.parseUuidParam(conversationId, 'conversationId');
    return await this.conversations.listMessages(req, normalizedConversationId, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/conversations/:conversationId/messages')
  async sendMessage(@Req() req: any, @Param('conversationId') conversationId: string, @Body() body: any) {
    const normalizedConversationId = this.parseUuidParam(conversationId, 'conversationId');
    return await this.conversations.sendMessage(req, normalizedConversationId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/conversations/:conversationId/read')
  async markRead(@Req() req: any, @Param('conversationId') conversationId: string) {
    const normalizedConversationId = this.parseUuidParam(conversationId, 'conversationId');
    return await this.conversations.markRead(req, normalizedConversationId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/conversations/platform')
  async listPlatformConversations(@Req() req: any, @Query() query: any) {
    this.ensureAdmin(req);
    requirePermission(req, 'conversation.platform.manage');
    return await this.conversations.listPlatformConversations(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/conversations/:conversationId/agents')
  async assignPlatformAgent(@Req() req: any, @Param('conversationId') conversationId: string, @Body() body: any) {
    this.ensureAdmin(req);
    requirePermission(req, 'conversation.platform.manage');
    const normalizedConversationId = this.parseUuidParam(conversationId, 'conversationId');
    return await this.conversations.assignPlatformAgent(req, normalizedConversationId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/admin/conversations/:conversationId/agents/:userId')
  async removePlatformAgent(@Req() req: any, @Param('conversationId') conversationId: string, @Param('userId') userId: string) {
    this.ensureAdmin(req);
    requirePermission(req, 'conversation.platform.manage');
    const normalizedConversationId = this.parseUuidParam(conversationId, 'conversationId');
    const normalizedUserId = this.parseUuidParam(userId, 'userId');
    return await this.conversations.removePlatformAgent(req, normalizedConversationId, normalizedUserId);
  }
}
