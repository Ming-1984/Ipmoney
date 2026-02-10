import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

type ConversationContentType = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK' | 'TECH_MANAGER';
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

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
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
    if (contentType === 'LISTING') {
      const listing = await this.prisma.listing.findUnique({ where: { id: contentId } });
      if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
      return {
        sellerUserId: listing.sellerUserId,
        contentTitle: listing.title ?? 'Consultation',
        listingId: listing.id,
        listingTitle: listing.title ?? null,
      };
    }

    if (contentType === 'DEMAND') {
      const demand = await this.prisma.demand.findUnique({ where: { id: contentId } });
      if (!demand) throw new NotFoundException({ code: 'NOT_FOUND', message: 'demand not found' });
      return {
        sellerUserId: demand.publisherUserId,
        contentTitle: demand.title ?? 'Consultation',
      };
    }

    if (contentType === 'ACHIEVEMENT') {
      const achievement = await this.prisma.achievement.findUnique({ where: { id: contentId } });
      if (!achievement) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
      return {
        sellerUserId: achievement.publisherUserId,
        contentTitle: achievement.title ?? 'Consultation',
      };
    }

    if (contentType === 'ARTWORK') {
      const artwork = await this.prisma.artwork.findUnique({ where: { id: contentId } });
      if (!artwork) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
      return {
        sellerUserId: artwork.sellerUserId,
        contentTitle: artwork.title ?? 'Consultation',
      };
    }

    const verification = await this.prisma.userVerification.findFirst({
      where: {
        userId: contentId,
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
    const buyerUserId = req.auth.userId;
    const { sellerUserId, contentTitle, listingId, listingTitle } = await this.resolveContentMeta(contentType, contentId);

    let conversation = await this.prisma.conversation.findFirst({
      where: { contentType, contentId, buyerUserId, sellerUserId },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contentType,
          contentId,
          listingId: listingId ?? null,
          buyerUserId,
          sellerUserId,
        },
      });
    }

    return this.toConversationDto(conversation, contentTitle, listingTitle);
  }

  async listMine(req: any, query: any): Promise<PagedConversationSummary> {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: {
          OR: [{ buyerUserId: req.auth.userId }, { sellerUserId: req.auth.userId }],
        },
        include: { listing: true, buyer: true, seller: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conversation.count({
        where: { OR: [{ buyerUserId: req.auth.userId }, { sellerUserId: req.auth.userId }] },
      }),
    ]);

    const demandIds = new Set<string>();
    const achievementIds = new Set<string>();
    const artworkIds = new Set<string>();
    const techManagerIds = new Set<string>();

    for (const it of items as any[]) {
      const type = (it.contentType || 'LISTING') as ConversationContentType;
      const id = String(it.contentId || it.listingId || '');
      if (!id) continue;
      if (type === 'DEMAND') demandIds.add(id);
      if (type === 'ACHIEVEMENT') achievementIds.add(id);
      if (type === 'ARTWORK') artworkIds.add(id);
      if (type === 'TECH_MANAGER') techManagerIds.add(id);
    }

    const [demands, achievements, artworks, techManagers] = await Promise.all([
      demandIds.size
        ? this.prisma.demand.findMany({
            where: { id: { in: Array.from(demandIds) } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      achievementIds.size
        ? this.prisma.achievement.findMany({
            where: { id: { in: Array.from(achievementIds) } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      artworkIds.size
        ? this.prisma.artwork.findMany({
            where: { id: { in: Array.from(artworkIds) } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      techManagerIds.size
        ? this.prisma.userVerification.findMany({
            where: {
              userId: { in: Array.from(techManagerIds) },
              verificationType: 'TECH_MANAGER',
              verificationStatus: 'APPROVED',
            },
            include: { user: true },
          })
        : Promise.resolve([]),
    ]);

    const demandMap = new Map(demands.map((item: any) => [item.id, item.title]));
    const achievementMap = new Map(achievements.map((item: any) => [item.id, item.title]));
    const artworkMap = new Map(artworks.map((item: any) => [item.id, item.title]));
    const techManagerMap = new Map(
      techManagers.map((item: any) => [item.userId, item.displayName ?? item.user?.nickname ?? 'Tech Manager']),
    );

    const mapped = items.map((it: any) => {
      const contentType = (it.contentType || 'LISTING') as ConversationContentType;
      const contentId = String(it.contentId || it.listingId || '');
      const contentTitle =
        contentType === 'LISTING'
          ? it.listing?.title ?? 'Consultation'
          : contentType === 'DEMAND'
            ? demandMap.get(contentId) ?? 'Consultation'
            : contentType === 'ACHIEVEMENT'
              ? achievementMap.get(contentId) ?? 'Consultation'
              : contentType === 'ARTWORK'
                ? artworkMap.get(contentId) ?? 'Consultation'
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

  async createDemandConversation(req: any, demandId: string) {
    return await this.upsertConversation(req, 'DEMAND', demandId);
  }

  async createAchievementConversation(req: any, achievementId: string) {
    return await this.upsertConversation(req, 'ACHIEVEMENT', achievementId);
  }

  async createArtworkConversation(req: any, artworkId: string) {
    return await this.upsertConversation(req, 'ARTWORK', artworkId);
  }

  async createTechManagerConversation(req: any, techManagerId: string) {
    return await this.upsertConversation(req, 'TECH_MANAGER', techManagerId);
  }

  async listMessages(req: any, conversationId: string, _query: any): Promise<PagedConversationMessage> {
    this.ensureAuth(req);
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    if (conv.buyerUserId !== req.auth.userId && conv.sellerUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId },
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
    const type = String(body?.type || 'TEXT').trim().toUpperCase();
    if (type !== 'TEXT' && type !== 'EMOJI') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid message type' });
    }
    const text = String(body?.text || '').trim();
    if (!text) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'text is required' });

    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    if (conv.buyerUserId !== req.auth.userId && conv.sellerUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }

    const msg = await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        senderUserId: req.auth.userId,
        type: type as ConversationMessageType,
        text,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
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
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: req.auth.userId },
    });
    if (participant) {
      await this.prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastReadAt: new Date() },
      });
    } else {
      await this.prisma.conversationParticipant.create({
        data: { conversationId, userId: req.auth.userId, lastReadAt: new Date() },
      });
    }
    return { ok: true };
  }
}
