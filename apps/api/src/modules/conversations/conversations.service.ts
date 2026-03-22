import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type ConversationContentType = 'LISTING' | 'ACHIEVEMENT' | 'TECH_MANAGER';
type ConversationMessageType = 'TEXT' | 'EMOJI' | 'IMAGE' | 'FILE' | 'SYSTEM';

type ConversationDto = {
  id: string;
  contentType: ConversationContentType;
  contentId: string;
  contentTitle?: string | null;
  listingId?: string | null;
  listingTitle?: string | null;
  orderId?: string | null;
  buyerUserId: string;
  sellerUserId: string;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ConversationSummary = {
  id: string;
  contentType: ConversationContentType;
  contentId: string;
  contentTitle: string;
  listingId?: string | null;
  listingTitle?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  counterpart: {
    id: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
  };
  assignedAgentUserIds?: string[];
};

type PagedConversationSummary = {
  items: ConversationSummary[];
  page: { page: number; pageSize: number; total: number };
};

type ConversationMessageDto = {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: ConversationMessageType;
  text?: string | null;
  createdAt: string;
};

type PagedConversationMessage = { items: ConversationMessageDto[]; nextCursor?: string | null };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ContentEventService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private async isConversationAgent(conversationId: string, userId: string): Promise<boolean> {
    const assignment = await this.prisma.conversationAgent.findFirst({
      where: { conversationId, operatorUserId: userId, active: true },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  private async assertConversationAccessible(conv: any, userId: string): Promise<void> {
    if (conv.buyerUserId === userId || conv.sellerUserId === userId) return;
    const isAgent = await this.isConversationAgent(conv.id, userId);
    if (!isAgent) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private toConversationDto(conv: any, contentTitle?: string | null, listingTitle?: string | null): ConversationDto {
    return {
      id: conv.id,
      contentType: conv.contentType as ConversationContentType,
      contentId: conv.contentId,
      contentTitle: contentTitle ?? null,
      listingId: conv.listingId ?? null,
      listingTitle: listingTitle ?? null,
      orderId: conv.orderId ?? null,
      buyerUserId: conv.buyerUserId,
      sellerUserId: conv.sellerUserId,
      lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    };
  }

  private async resolveContentMeta(contentType: ConversationContentType, contentId: string) {
    const normalizedContentId = this.parseUuidStrict(contentId, 'contentId');
    if (contentType === 'LISTING') {
      const listing = await this.prisma.listing.findUnique({ where: { id: normalizedContentId } });
      if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
      return {
        sellerUserId: listing.sellerUserId,
        contentTitle: listing.title ?? 'Consultation',
        listingId: listing.id,
        listingTitle: listing.title ?? null,
      };
    }
    if (contentType === 'ACHIEVEMENT') {
      const achievement = await this.prisma.achievement.findUnique({ where: { id: normalizedContentId } });
      if (!achievement) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
      return {
        sellerUserId: achievement.publisherUserId,
        contentTitle: achievement.title ?? 'Consultation',
      };
    }

    const verification = await this.prisma.userVerification.findFirst({
      where: {
        userId: normalizedContentId,
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
      },
      include: { user: true },
    });
    if (!verification) throw new NotFoundException({ code: 'NOT_FOUND', message: 'tech manager not found' });
    return {
      sellerUserId: verification.userId,
      contentTitle: verification.displayName ?? verification.user?.nickname ?? 'Tech Manager',
    };
  }

  private async upsertConversation(req: any, contentType: ConversationContentType, contentId: string) {
    this.ensureAuth(req);
    const normalizedContentId = this.parseUuidStrict(contentId, 'contentId');
    const buyerUserId = req.auth.userId;
    const { sellerUserId, contentTitle, listingId, listingTitle } = await this.resolveContentMeta(
      contentType,
      normalizedContentId,
    );

    let conversation = await this.prisma.conversation.findFirst({
      where: { contentType, contentId: normalizedContentId, buyerUserId, sellerUserId },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contentType,
          contentId: normalizedContentId,
          listingId: listingId ?? null,
          buyerUserId,
          sellerUserId,
        },
      });
    }

    if (contentType === 'LISTING') {
      void this.events.recordConsult(req, 'LISTING', normalizedContentId).catch(() => {});
    } else if (contentType === 'ACHIEVEMENT') {
      void this.events.recordConsult(req, 'ACHIEVEMENT', normalizedContentId).catch(() => {});
    }

    return this.toConversationDto(conversation, contentTitle, listingTitle);
  }

  async listMine(req: any, query: any): Promise<PagedConversationSummary> {
    this.ensureAuth(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: {
          OR: [
            { buyerUserId: req.auth.userId },
            { sellerUserId: req.auth.userId },
            { agents: { some: { operatorUserId: req.auth.userId, active: true } } },
          ],
        },
        include: { listing: true, buyer: true, seller: true, agents: { where: { active: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conversation.count({
        where: {
          OR: [
            { buyerUserId: req.auth.userId },
            { sellerUserId: req.auth.userId },
            { agents: { some: { operatorUserId: req.auth.userId, active: true } } },
          ],
        },
      }),
    ]);

    const techManagerIds = new Set<string>();
    const achievementIds = new Set<string>();

    for (const it of items as any[]) {
      const type = (it.contentType || 'LISTING') as ConversationContentType;
      const id = String(it.contentId || it.listingId || '');
      if (!id) continue;
      if (type === 'TECH_MANAGER') techManagerIds.add(id);
      if (type === 'ACHIEVEMENT') achievementIds.add(id);
    }

    const techManagers = techManagerIds.size
      ? await this.prisma.userVerification.findMany({
          where: {
            userId: { in: Array.from(techManagerIds) },
            verificationType: 'TECH_MANAGER',
            verificationStatus: 'APPROVED',
          },
          include: { user: true },
        })
      : [];

    const techManagerMap = new Map(
      techManagers.map((item: any) => [item.userId, item.displayName ?? item.user?.nickname ?? 'Tech Manager']),
    );

    const achievements = achievementIds.size
      ? await this.prisma.achievement.findMany({
          where: { id: { in: Array.from(achievementIds) } },
          select: { id: true, title: true },
        })
      : [];
    const achievementMap = new Map(achievements.map((item: any) => [item.id, item.title ?? 'Consultation']));

    const mapped = items.map((it: any) => {
      const contentType = (it.contentType || 'LISTING') as ConversationContentType;
      const contentId = String(it.contentId || it.listingId || '');
      const contentTitle =
        contentType === 'LISTING'
          ? it.listing?.title ?? 'Consultation'
          : contentType === 'ACHIEVEMENT'
            ? achievementMap.get(contentId) ?? 'Consultation'
            : techManagerMap.get(contentId) ?? 'Consultation';

      const counterpart = it.buyerUserId === req.auth.userId ? it.seller : it.buyer;
      const counterpartId = counterpart?.id ?? (it.buyerUserId === req.auth.userId ? it.sellerUserId : it.buyerUserId);
      const lastMessageAt = (it.lastMessageAt || it.updatedAt || it.createdAt) as Date;
      return {
        id: it.id,
        contentType,
        contentId,
        contentTitle,
        listingId: contentType === 'LISTING' ? (it.listingId ?? null) : null,
        listingTitle: contentType === 'LISTING' ? (it.listing?.title ?? null) : null,
        lastMessagePreview: null,
        lastMessageAt: lastMessageAt.toISOString(),
        unreadCount: 0,
        counterpart: {
          id: counterpartId,
          nickname: counterpart?.nickname ?? 'User',
          avatarUrl: counterpart?.avatarUrl ?? null,
          role: counterpart?.role ?? null,
        },
        assignedAgentUserIds: Array.isArray(it.agents)
          ? it.agents.map((agent: any) => String(agent.operatorUserId || '')).filter((id: string) => Boolean(id))
          : [],
      } satisfies ConversationSummary;
    });

    return {
      items: mapped,
      page: { page, pageSize, total },
    };
  }

  async createListingConversation(req: any, listingId: string) {
    return await this.upsertConversation(req, 'LISTING', listingId);
  }

  async createAchievementConversation(req: any, achievementId: string) {
    return await this.upsertConversation(req, 'ACHIEVEMENT', achievementId);
  }

  async createTechManagerConversation(req: any, techManagerId: string) {
    return await this.upsertConversation(req, 'TECH_MANAGER', techManagerId);
  }

  async listMessages(req: any, conversationId: string, _query: any): Promise<PagedConversationMessage> {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const conv = await this.prisma.conversation.findUnique({ where: { id: normalizedConversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    await this.assertConversationAccessible(conv, req.auth.userId);
    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId: normalizedConversationId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderUserId: m.senderUserId,
        type: m.type as ConversationMessageType,
        text: m.text ?? undefined,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor: null,
    };
  }

  async sendMessage(req: any, conversationId: string, body: any) {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const hasType = Object.prototype.hasOwnProperty.call(body || {}, 'type');
    const type = hasType ? String(body?.type ?? '').trim().toUpperCase() : 'TEXT';
    if (type !== 'TEXT' && type !== 'EMOJI') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid message type' });
    }
    const text = String(body?.text || '').trim();
    if (!text) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'text is required' });

    const conv = await this.prisma.conversation.findUnique({ where: { id: normalizedConversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    await this.assertConversationAccessible(conv, req.auth.userId);

    const msg = await this.prisma.conversationMessage.create({
      data: {
        conversationId: normalizedConversationId,
        senderUserId: req.auth.userId,
        type: type as ConversationMessageType,
        text,
      },
    });

    await this.prisma.conversation.update({
      where: { id: normalizedConversationId },
      data: { lastMessageAt: msg.createdAt },
    });

    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderUserId: msg.senderUserId,
      type: msg.type as ConversationMessageType,
      text: msg.text,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  async markRead(req: any, conversationId: string) {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const conv = await this.prisma.conversation.findUnique({ where: { id: normalizedConversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    await this.assertConversationAccessible(conv, req.auth.userId);
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId: normalizedConversationId, userId: req.auth.userId },
    });
    if (participant) {
      await this.prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastReadAt: new Date() },
      });
    } else {
      await this.prisma.conversationParticipant.create({
        data: { conversationId: normalizedConversationId, userId: req.auth.userId, lastReadAt: new Date() },
      });
    }
    return { ok: true };
  }

  async listPlatformConversations(req: any, query: any): Promise<PagedConversationSummary> {
    this.ensureAuth(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const mineOnly = this.hasOwn(query, 'mineOnly') ? String(query?.mineOnly || '').trim() === 'true' : false;
    const where: any = {
      contentType: 'LISTING',
      listing: { consultationRouting: 'PLATFORM' },
    };
    if (mineOnly) {
      where.agents = { some: { operatorUserId: req.auth.userId, active: true } };
    }

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: { listing: true, buyer: true, seller: true, agents: { where: { active: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items: items.map((it: any) => {
        const lastMessageAt = (it.lastMessageAt || it.updatedAt || it.createdAt) as Date;
        return {
          id: it.id,
          contentType: 'LISTING',
          contentId: String(it.contentId || it.listingId || ''),
          contentTitle: it.listing?.title ?? 'Consultation',
          listingId: it.listingId ?? null,
          listingTitle: it.listing?.title ?? null,
          lastMessagePreview: null,
          lastMessageAt: lastMessageAt.toISOString(),
          unreadCount: 0,
          counterpart: {
            id: it.buyer?.id || it.buyerUserId,
            nickname: it.buyer?.nickname ?? 'User',
            avatarUrl: it.buyer?.avatarUrl ?? null,
            role: it.buyer?.role ?? null,
          },
          assignedAgentUserIds: Array.isArray(it.agents)
            ? it.agents.map((agent: any) => String(agent.operatorUserId || '')).filter((id: string) => Boolean(id))
            : [],
        } satisfies ConversationSummary;
      }),
      page: { page, pageSize, total },
    };
  }

  async assignPlatformAgent(req: any, conversationId: string, body: any) {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const operatorUserId = this.hasOwn(body, 'userId')
      ? this.parseUuidStrict(body?.userId, 'userId')
      : this.parseUuidStrict(req?.auth?.userId, 'userId');
    const conv = await this.prisma.conversation.findUnique({
      where: { id: normalizedConversationId },
      include: { listing: { select: { consultationRouting: true } } },
    });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    if (conv.contentType !== 'LISTING' || conv.listing?.consultationRouting !== 'PLATFORM') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'conversation is not a platform listing consultation' });
    }
    const operator = await this.prisma.user.findUnique({ where: { id: operatorUserId }, select: { id: true } });
    if (!operator) throw new NotFoundException({ code: 'NOT_FOUND', message: 'user not found' });
    const assigned = await this.prisma.conversationAgent.upsert({
      where: {
        conversationId_operatorUserId: {
          conversationId: normalizedConversationId,
          operatorUserId,
        },
      },
      create: {
        conversationId: normalizedConversationId,
        operatorUserId,
        assignedByUserId: req.auth.userId,
        active: true,
      },
      update: {
        assignedByUserId: req.auth.userId,
        active: true,
      },
    });
    return {
      id: assigned.id,
      conversationId: assigned.conversationId,
      userId: assigned.operatorUserId,
      active: assigned.active,
      assignedAt: assigned.assignedAt.toISOString(),
    };
  }

  async removePlatformAgent(req: any, conversationId: string, userId: string) {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const normalizedUserId = this.parseUuidStrict(userId, 'userId');
    const assignment = await this.prisma.conversationAgent.findUnique({
      where: {
        conversationId_operatorUserId: {
          conversationId: normalizedConversationId,
          operatorUserId: normalizedUserId,
        },
      },
    });
    if (!assignment) throw new NotFoundException({ code: 'NOT_FOUND', message: 'agent assignment not found' });
    const updated = await this.prisma.conversationAgent.update({
      where: { id: assignment.id },
      data: { active: false, assignedByUserId: req.auth.userId },
    });
    return {
      id: updated.id,
      conversationId: updated.conversationId,
      userId: updated.operatorUserId,
      active: updated.active,
      assignedAt: updated.assignedAt.toISOString(),
    };
  }
}
