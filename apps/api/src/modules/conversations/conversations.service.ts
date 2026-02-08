import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
type ConversationMessageType = 'TEXT' | 'IMAGE' | 'FILE';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

type ConversationSummary = {
  id: string;
  listingId?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  listingTitle?: string | null;
  contentTitle?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number | null;
  counterpart?: {
    id?: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
  } | null;
};

type PagedConversationSummary = {
  items: ConversationSummary[];
  page: { page: number; pageSize: number; total: number };
};

type ConversationMessageDto = {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: ConversationMessageType | 'TEXT';
  text?: string | null;
  createdAt: string;
};

type PagedConversationMessage = { items: ConversationMessageDto[]; nextCursor?: string | null };

type VirtualConversation = {
  id: string;
  userId: string;
  contentType: string;
  contentId: string;
  createdAt: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
};

type VirtualMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  text: string;
  createdAt: string;
};

const VIRTUAL_CONVERSATIONS = new Map<string, VirtualConversation>();
const VIRTUAL_MESSAGES = new Map<string, VirtualMessage[]>();

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
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

    const mapped = items.map((it: {
      id: string;
      listingId?: string | null;
      buyerUserId: string;
      sellerUserId: string;
      lastMessageAt?: Date | null;
      listing?: { title?: string | null } | null;
      buyer?: { id: string; nickname?: string | null; avatarUrl?: string | null; role?: string | null } | null;
      seller?: { id: string; nickname?: string | null; avatarUrl?: string | null; role?: string | null } | null;
    }) => {
      const counterpart = it.buyerUserId === req.auth.userId ? it.seller : it.buyer;
      return {
        id: it.id,
        listingId: it.listingId,
        contentType: 'LISTING',
        contentId: it.listingId,
        listingTitle: it.listing?.title ?? null,
        contentTitle: it.listing?.title ?? null,
        lastMessagePreview: null,
        lastMessageAt: it.lastMessageAt ? it.lastMessageAt.toISOString() : null,
        unreadCount: 0,
        counterpart: counterpart
          ? { id: counterpart.id, nickname: counterpart.nickname, avatarUrl: counterpart.avatarUrl, role: counterpart.role }
          : null,
      } satisfies ConversationSummary;
    });

    const virtual = [...VIRTUAL_CONVERSATIONS.values()].filter((c) => c.userId === req.auth.userId);
    const virtualSummaries: ConversationSummary[] = virtual.map((c) => ({
      id: c.id,
      contentType: c.contentType,
      contentId: c.contentId,
      contentTitle: '咨询内容',
      lastMessagePreview: c.lastMessagePreview ?? null,
      lastMessageAt: c.lastMessageAt ?? null,
      unreadCount: 0,
      counterpart: { nickname: '平台客服', role: 'cs', avatarUrl: null },
    }));

    return {
      items: [...mapped, ...virtualSummaries],
      page: { page, pageSize, total: total + virtualSummaries.length },
    } as PagedConversationSummary;
  }

  async createListingConversation(req: any, listingId: string) {
    this.ensureAuth(req);
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: '挂牌不存在' });

    const buyerUserId = req.auth.userId;
    const sellerUserId = listing.sellerUserId;

    let conv = await this.prisma.conversation.findFirst({
      where: { listingId, buyerUserId, sellerUserId },
    });
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          listingId,
          buyerUserId,
          sellerUserId,
        },
      });
    }
    return { id: conv.id };
  }

  async createVirtualConversation(req: any, contentType: string, contentId: string) {
    this.ensureAuth(req);
    const id = randomUUID();
    VIRTUAL_CONVERSATIONS.set(id, {
      id,
      userId: req.auth.userId,
      contentType,
      contentId,
      createdAt: new Date().toISOString(),
    });
    VIRTUAL_MESSAGES.set(id, []);
    return { id };
  }

  async listMessages(req: any, conversationId: string, _query: any): Promise<PagedConversationMessage> {
    this.ensureAuth(req);
    if (VIRTUAL_CONVERSATIONS.has(conversationId)) {
      const list = VIRTUAL_MESSAGES.get(conversationId) || [];
      return { items: list.map((m: VirtualMessage) => ({ ...m, type: 'TEXT' })), nextCursor: null };
    }
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: '会话不存在' });
    if (conv.buyerUserId !== req.auth.userId && conv.sellerUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: messages.map((m: { id: string; conversationId: string; senderUserId: string; type: ConversationMessageType; text?: string | null; createdAt: Date }) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderUserId: m.senderUserId,
        type: m.type,
        text: m.text ?? undefined,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor: null,
    };
  }

  async sendMessage(req: any, conversationId: string, body: any) {
    this.ensureAuth(req);
    const text = String(body?.text || '').trim();
    if (!text) throw new ForbiddenException({ code: 'BAD_REQUEST', message: '消息不能为空' });

    if (VIRTUAL_CONVERSATIONS.has(conversationId)) {
      const msg: VirtualMessage = {
        id: randomUUID(),
        conversationId,
        senderUserId: req.auth.userId,
        text,
        createdAt: new Date().toISOString(),
      };
      const list = VIRTUAL_MESSAGES.get(conversationId) || [];
      list.push(msg);
      VIRTUAL_MESSAGES.set(conversationId, list);
      const conv = VIRTUAL_CONVERSATIONS.get(conversationId);
      if (conv) {
        conv.lastMessagePreview = text;
        conv.lastMessageAt = msg.createdAt;
      }
      return msg;
    }

    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: '会话不存在' });
    if (conv.buyerUserId !== req.auth.userId && conv.sellerUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const msg = await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        senderUserId: req.auth.userId,
        type: 'TEXT',
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
      type: msg.type,
      text: msg.text,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  async markRead(req: any, conversationId: string) {
    this.ensureAuth(req);
    if (VIRTUAL_CONVERSATIONS.has(conversationId)) {
      return { ok: true };
    }
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
