import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type ConversationContentType = 'LISTING' | 'ACHIEVEMENT' | 'TECH_MANAGER' | 'SUPPORT' | 'DISPUTE' | 'MAINTENANCE';
type UpsertableConversationContentType = 'LISTING' | 'ACHIEVEMENT' | 'TECH_MANAGER';
type ConversationMessageType = 'TEXT' | 'EMOJI' | 'IMAGE' | 'FILE' | 'SYSTEM';
type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'FIVE_STAR' | 'OPEN_LICENSE';
type PlatformAssignedFilter = 'ALL' | 'MINE' | 'ASSIGNED' | 'UNASSIGNED';
type PlatformConversationChannel = 'ALL' | 'CONSULTATION' | 'SUPPORT' | 'DISPUTE' | 'MAINTENANCE';

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
  listingTopics?: ListingTopic[];
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
const DEFAULT_CS_USER_ID = '00000000-0000-0000-0000-000000000002';
const LISTING_TOPIC_SET = new Set<ListingTopic>([
  'HIGH_TECH_RETIRED',
  'SLEEPING',
  'AWARD_WINNING',
  'FIVE_STAR',
  'OPEN_LICENSE',
]);

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

  private parseDateTimeStrict(value: unknown, fieldName: string): Date {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseBooleanStrict(value: unknown, fieldName: string): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseListingTopicStrict(value: unknown, fieldName: string): ListingTopic {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!LISTING_TOPIC_SET.has(normalized as ListingTopic)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized as ListingTopic;
  }

  private parsePlatformAssignedFilterStrict(value: unknown, fieldName: string): PlatformAssignedFilter {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'ALL' || normalized === 'MINE' || normalized === 'ASSIGNED' || normalized === 'UNASSIGNED') {
      return normalized as PlatformAssignedFilter;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parsePlatformConversationChannelStrict(value: unknown, fieldName: string): PlatformConversationChannel {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (
      normalized === 'ALL' ||
      normalized === 'CONSULTATION' ||
      normalized === 'SUPPORT' ||
      normalized === 'DISPUTE' ||
      normalized === 'MAINTENANCE'
    ) {
      return normalized as PlatformConversationChannel;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private normalizeListingTopics(input: unknown): ListingTopic[] {
    const values = Array.isArray(input) ? input : [];
    return Array.from(
      new Set(
        values
          .map((it) => String(it || '').trim().toUpperCase())
          .filter((it) => LISTING_TOPIC_SET.has(it as ListingTopic)),
      ),
    ) as ListingTopic[];
  }

  private summarizeLastMessage(message: any): string | null {
    if (!message) return null;
    const text = String(message.text || '').trim();
    if (text) return text;
    return `[${String(message.type || 'TEXT')}]`;
  }

  private resolveDisputeTitle(order: any): string {
    const orderId = String(order?.id || '').trim();
    const shortOrderId = orderId ? orderId.slice(0, 8) : '';
    const listingTitle = String(order?.listing?.title || '').trim();
    if (shortOrderId && listingTitle) return `订单争议#${shortOrderId} · ${listingTitle}`;
    if (shortOrderId) return `订单争议#${shortOrderId}`;
    if (listingTitle) return `订单争议 · ${listingTitle}`;
    return '订单争议';
  }

  private resolveMaintenanceTitle(order: any): string {
    const orderId = String(order?.id || '').trim();
    const shortOrderId = orderId ? orderId.slice(0, 8) : '';
    const patentTitle = String(order?.schedule?.patent?.title || '').trim();
    const yearNo = Number(order?.schedule?.yearNo || 0);
    const yearText = Number.isSafeInteger(yearNo) && yearNo > 0 ? `第${yearNo}年` : '';
    if (shortOrderId && patentTitle && yearText) return `年费代缴#${shortOrderId} · ${patentTitle} · ${yearText}`;
    if (shortOrderId && patentTitle) return `年费代缴#${shortOrderId} · ${patentTitle}`;
    if (shortOrderId) return `年费代缴#${shortOrderId}`;
    if (patentTitle && yearText) return `年费代缴 · ${patentTitle} · ${yearText}`;
    if (patentTitle) return `年费代缴 · ${patentTitle}`;
    return '年费代缴';
  }

  private buildMineWhere(userId: string) {
    return {
      OR: [
        { buyerUserId: userId },
        { sellerUserId: userId },
        { agents: { some: { operatorUserId: userId, active: true } } },
      ],
    };
  }

  private async countUnreadMessages(conversationId: string, userId: string, lastReadAt?: Date | null): Promise<number> {
    const where: any = {
      conversationId,
      senderUserId: { not: userId },
    };
    if (lastReadAt) {
      where.createdAt = { gt: lastReadAt };
    }
    return await this.prisma.conversationMessage.count({ where });
  }

  private async ensureDefaultCsUserId(): Promise<string> {
    const existing = await this.prisma.user.findFirst({
      where: { role: 'cs' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (existing?.id) return existing.id;

    const created = await this.prisma.user.upsert({
      where: { id: DEFAULT_CS_USER_ID },
      update: {
        role: 'cs',
        nickname: 'Default CS',
      },
      create: {
        id: DEFAULT_CS_USER_ID,
        role: 'cs',
        nickname: 'Default CS',
      },
      select: { id: true },
    });
    return created.id;
  }

  private async appendSystemMessage(conversationId: string, senderUserId: string, text: string): Promise<void> {
    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        senderUserId,
        type: 'SYSTEM',
        text: String(text || '').trim() || '系统消息',
      },
      select: { createdAt: true },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });
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

  private async resolveContentMeta(contentType: UpsertableConversationContentType, contentId: string) {
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

  private async upsertConversation(req: any, contentType: UpsertableConversationContentType, contentId: string) {
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

  private async ensurePlatformManageableConversation(conversationId: string) {
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: normalizedConversationId },
      include: { listing: { select: { consultationRouting: true } } },
    });
    if (!conversation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    const isPlatformConsultation =
      conversation.contentType === 'LISTING' && conversation.listing?.consultationRouting === 'PLATFORM';
    const isPlatformSupport =
      conversation.contentType === 'SUPPORT' ||
      conversation.contentType === 'DISPUTE' ||
      conversation.contentType === 'MAINTENANCE';
    if (!isPlatformConsultation && !isPlatformSupport) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'conversation is not managed by platform inbox' });
    }
    return conversation;
  }

  async listMine(req: any, query: any): Promise<PagedConversationSummary> {
    this.ensureAuth(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const mineWhere = this.buildMineWhere(req.auth.userId);

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: mineWhere,
        include: {
          listing: true,
          order: { include: { listing: { select: { id: true, title: true } } } },
          buyer: true,
          seller: true,
          agents: { where: { active: true } },
          participants: { where: { userId: req.auth.userId }, select: { lastReadAt: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conversation.count({ where: mineWhere }),
    ]);

    const techManagerIds = new Set<string>();
    const achievementIds = new Set<string>();
    const maintenanceIds = new Set<string>();

    for (const it of items as any[]) {
      const type = (it.contentType || 'LISTING') as ConversationContentType;
      const id = String(it.contentId || it.listingId || '');
      if (!id) continue;
      if (type === 'TECH_MANAGER') techManagerIds.add(id);
      if (type === 'ACHIEVEMENT') achievementIds.add(id);
      if (type === 'MAINTENANCE') maintenanceIds.add(id);
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

    const maintenanceOrders = maintenanceIds.size
      ? await this.prisma.patentMaintenanceOrder.findMany({
          where: { id: { in: Array.from(maintenanceIds) } },
          select: {
            id: true,
            schedule: {
              select: {
                yearNo: true,
                patent: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        })
      : [];
    const maintenanceTitleMap = new Map(
      maintenanceOrders.map((item: any) => [item.id, this.resolveMaintenanceTitle(item)]),
    );

    const unreadCounts = await Promise.all(
      items.map((item: any) => {
        const lastReadAt = Array.isArray(item.participants) ? item.participants[0]?.lastReadAt : null;
        return this.countUnreadMessages(item.id, req.auth.userId, lastReadAt || null);
      }),
    );

    const mapped = items.map((it: any, index: number) => {
      const contentType = (it.contentType || 'LISTING') as ConversationContentType;
      const contentId = String(it.contentId || it.listingId || '');
      const contentTitle =
        contentType === 'LISTING'
          ? it.listing?.title ?? 'Consultation'
          : contentType === 'ACHIEVEMENT'
            ? achievementMap.get(contentId) ?? 'Consultation'
            : contentType === 'TECH_MANAGER'
              ? techManagerMap.get(contentId) ?? 'Consultation'
              : contentType === 'SUPPORT'
                ? '平台客服'
                : contentType === 'MAINTENANCE'
                  ? maintenanceTitleMap.get(contentId) ?? '年费代缴'
                  : this.resolveDisputeTitle(it.order);

      const counterpart = it.buyerUserId === req.auth.userId ? it.seller : it.buyer;
      const counterpartId = counterpart?.id ?? (it.buyerUserId === req.auth.userId ? it.sellerUserId : it.buyerUserId);
      const lastMessageAt = (it.lastMessageAt || it.updatedAt || it.createdAt) as Date;
      const latestMessage = Array.isArray(it.messages) && it.messages.length > 0 ? it.messages[0] : null;
      return {
        id: it.id,
        contentType,
        contentId,
        contentTitle,
        listingId: contentType === 'LISTING' ? (it.listingId ?? null) : null,
        listingTitle: contentType === 'LISTING' ? (it.listing?.title ?? null) : null,
        listingTopics: contentType === 'LISTING' ? this.normalizeListingTopics(it.listing?.listingTopicsJson) : [],
        lastMessagePreview: this.summarizeLastMessage(latestMessage),
        lastMessageAt: lastMessageAt.toISOString(),
        unreadCount: unreadCounts[index] ?? 0,
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

  async createSupportConversation(req: any) {
    this.ensureAuth(req);
    const buyerUserId = this.parseUuidStrict(req.auth.userId, 'userId');
    const sellerUserId = await this.ensureDefaultCsUserId();
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        contentType: 'SUPPORT',
        contentId: buyerUserId,
        buyerUserId,
        sellerUserId,
      },
    });
    const isNewConversation = !conversation;
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contentType: 'SUPPORT',
          contentId: buyerUserId,
          buyerUserId,
          sellerUserId,
        },
      });
    }
    if (isNewConversation) {
      await this.appendSystemMessage(conversation.id, sellerUserId, '已接入平台客服，请描述你的问题，我们将持续跟进。');
      conversation = await this.prisma.conversation.findUnique({ where: { id: conversation.id } });
      if (!conversation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    }
    return this.toConversationDto(conversation, '平台客服', null);
  }

  async createOrderDisputeConversation(req: any, orderId: string) {
    this.ensureAuth(req);
    const normalizedOrderId = this.parseUuidStrict(orderId, 'orderId');
    const order = await this.prisma.order.findUnique({
      where: { id: normalizedOrderId },
      include: { listing: { select: { id: true, title: true, sellerUserId: true } } },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    const requesterUserId = this.parseUuidStrict(req.auth.userId, 'userId');
    const canAccess =
      requesterUserId === order.buyerUserId ||
      requesterUserId === order.listing?.sellerUserId ||
      Boolean(req?.auth?.isAdmin);
    if (!canAccess) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }

    const sellerUserId = order.assignedCsUserId ?? (await this.ensureDefaultCsUserId());
    if (!order.assignedCsUserId) {
      await this.prisma.order.update({
        where: { id: normalizedOrderId },
        data: { assignedCsUserId: sellerUserId },
      });
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        contentType: 'DISPUTE',
        contentId: normalizedOrderId,
        buyerUserId: order.buyerUserId,
        sellerUserId,
      },
    });
    const isNewConversation = !conversation;
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contentType: 'DISPUTE',
          contentId: normalizedOrderId,
          listingId: order.listingId,
          orderId: normalizedOrderId,
          buyerUserId: order.buyerUserId,
          sellerUserId,
        },
      });
    }

    const existingCase = await this.prisma.csCase.findFirst({
      where: { orderId: normalizedOrderId, type: 'DISPUTE' },
      select: { id: true, csUserId: true },
    });
    if (!existingCase) {
      await this.prisma.csCase.create({
        data: {
          orderId: normalizedOrderId,
          csUserId: sellerUserId,
          title: '订单争议处理',
          type: 'DISPUTE',
          status: 'OPEN',
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (existingCase.csUserId !== sellerUserId) {
      await this.prisma.csCase.update({
        where: { id: existingCase.id },
        data: { csUserId: sellerUserId },
      });
    }

    if (isNewConversation) {
      await this.appendSystemMessage(conversation.id, sellerUserId, '订单争议会话已创建，请补充问题描述与证据材料。');
      conversation = await this.prisma.conversation.findUnique({ where: { id: conversation.id } });
      if (!conversation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    }

    return this.toConversationDto(conversation, this.resolveDisputeTitle(order), order.listing?.title ?? null);
  }

  async createMaintenanceConversation(req: any, orderId: string) {
    this.ensureAuth(req);
    const normalizedOrderId = this.parseUuidStrict(orderId, 'orderId');
    const order = await this.prisma.patentMaintenanceOrder.findUnique({
      where: { id: normalizedOrderId },
      include: {
        schedule: {
          select: {
            yearNo: true,
            patent: {
              select: {
                ownerUserId: true,
                title: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'maintenance order not found' });

    const requesterUserId = this.parseUuidStrict(req.auth.userId, 'userId');
    const canAccess =
      requesterUserId === order.applicantUserId ||
      requesterUserId === order.assignedCsUserId ||
      requesterUserId === order.schedule?.patent?.ownerUserId ||
      Boolean(req?.auth?.isAdmin);
    if (!canAccess) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }

    const sellerUserId = order.assignedCsUserId ?? (await this.ensureDefaultCsUserId());
    if (!order.assignedCsUserId) {
      await this.prisma.patentMaintenanceOrder.update({
        where: { id: normalizedOrderId },
        data: { assignedCsUserId: sellerUserId },
      });
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        contentType: 'MAINTENANCE',
        contentId: normalizedOrderId,
        buyerUserId: order.applicantUserId,
        sellerUserId,
      },
    });
    const isNewConversation = !conversation;
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contentType: 'MAINTENANCE',
          contentId: normalizedOrderId,
          buyerUserId: order.applicantUserId,
          sellerUserId,
        },
      });
    }

    if (isNewConversation) {
      await this.appendSystemMessage(conversation.id, sellerUserId, '年费代缴会话已创建，请补充缴费需求与材料。');
      conversation = await this.prisma.conversation.findUnique({ where: { id: conversation.id } });
      if (!conversation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    }

    return this.toConversationDto(conversation, this.resolveMaintenanceTitle(order), null);
  }

  async listMessages(req: any, conversationId: string, query: any): Promise<PagedConversationMessage> {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const conv = await this.prisma.conversation.findUnique({ where: { id: normalizedConversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    await this.assertConversationAccessible(conv, req.auth.userId);
    const limitInput = this.hasOwn(query, 'limit') ? this.parsePositiveIntStrict(query?.limit, 'limit') : 50;
    const limit = Math.min(100, limitInput);
    const cursor = this.hasOwn(query, 'cursor') ? this.parseUuidStrict(query?.cursor, 'cursor') : undefined;

    const where: any = { conversationId: normalizedConversationId };
    if (cursor) {
      const cursorMessage = await this.prisma.conversationMessage.findFirst({
        where: { id: cursor, conversationId: normalizedConversationId },
        select: { id: true, createdAt: true },
      });
      if (!cursorMessage) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'cursor message not found' });
      }
      where.OR = [
        { createdAt: { lt: cursorMessage.createdAt } },
        { AND: [{ createdAt: cursorMessage.createdAt }, { id: { lt: cursorMessage.id } }] },
      ];
    }

    const messagesDesc = await this.prisma.conversationMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = messagesDesc.length > limit;
    const pageDesc = hasMore ? messagesDesc.slice(0, limit) : messagesDesc;
    const nextCursor = hasMore && pageDesc.length > 0 ? pageDesc[pageDesc.length - 1]?.id : null;
    const messages = [...pageDesc].reverse();

    return {
      items: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderUserId: m.senderUserId,
        type: m.type as ConversationMessageType,
        text: m.text ?? undefined,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor,
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
    const mineOnly = this.hasOwn(query, 'mineOnly') ? this.parseBooleanStrict(query?.mineOnly, 'mineOnly') : false;
    const assignedFilter = this.hasOwn(query, 'assigned')
      ? this.parsePlatformAssignedFilterStrict(query?.assigned, 'assigned')
      : 'ALL';
    const channel = this.hasOwn(query, 'channel')
      ? this.parsePlatformConversationChannelStrict(query?.channel, 'channel')
      : 'ALL';
    const effectiveAssignedFilter = mineOnly ? ('MINE' as const) : assignedFilter;
    const q = String(query?.q || '').trim();
    const listingTopic = this.hasOwn(query, 'listingTopic')
      ? this.parseListingTopicStrict(query?.listingTopic, 'listingTopic')
      : undefined;
    const updatedFrom = this.hasOwn(query, 'updatedFrom') ? this.parseDateTimeStrict(query?.updatedFrom, 'updatedFrom') : undefined;
    const updatedTo = this.hasOwn(query, 'updatedTo') ? this.parseDateTimeStrict(query?.updatedTo, 'updatedTo') : undefined;
    if (updatedFrom && updatedTo && updatedFrom.getTime() > updatedTo.getTime()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'updatedFrom must be earlier than updatedTo' });
    }
    if (listingTopic && channel !== 'ALL' && channel !== 'CONSULTATION') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listingTopic is only valid for consultation channel' });
    }

    const managedScopeFilter: any =
      channel === 'CONSULTATION' || listingTopic
        ? {
            contentType: 'LISTING',
            listing: {
              consultationRouting: 'PLATFORM',
              ...(listingTopic ? { listingTopicsJson: { array_contains: [listingTopic] } } : {}),
            },
          }
        : channel === 'SUPPORT'
          ? { contentType: 'SUPPORT' }
          : channel === 'DISPUTE'
            ? { contentType: 'DISPUTE' }
            : channel === 'MAINTENANCE'
              ? { contentType: 'MAINTENANCE' }
            : {
                OR: [
                  { contentType: 'SUPPORT' },
                  { contentType: 'DISPUTE' },
                  { contentType: 'MAINTENANCE' },
                  { contentType: 'LISTING', listing: { consultationRouting: 'PLATFORM' } },
                ],
              };

    const where: any = { AND: [managedScopeFilter] };
    const andFilters: any[] = [];
    if (effectiveAssignedFilter === 'MINE') {
      andFilters.push({ agents: { some: { operatorUserId: req.auth.userId, active: true } } });
    } else if (effectiveAssignedFilter === 'ASSIGNED') {
      andFilters.push({ agents: { some: { active: true } } });
    } else if (effectiveAssignedFilter === 'UNASSIGNED') {
      andFilters.push({ agents: { none: { active: true } } });
    }
    if (q) {
      andFilters.push({
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { contentId: { contains: q, mode: 'insensitive' } },
          { buyerUserId: { contains: q, mode: 'insensitive' } },
          { listing: { title: { contains: q, mode: 'insensitive' } } },
          { buyer: { nickname: { contains: q, mode: 'insensitive' } } },
          { orderId: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (updatedFrom) {
      andFilters.push({ updatedAt: { gte: updatedFrom } });
    }
    if (updatedTo) {
      andFilters.push({ updatedAt: { lte: updatedTo } });
    }
    if (andFilters.length > 0) {
      where.AND.push(...andFilters);
    }

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          listing: true,
          order: { include: { listing: { select: { id: true, title: true } } } },
          buyer: true,
          seller: true,
          agents: { where: { active: true } },
          participants: { where: { userId: req.auth.userId }, select: { lastReadAt: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const maintenanceIds = new Set<string>();
    for (const it of items as any[]) {
      if (String(it.contentType || '').toUpperCase() === 'MAINTENANCE') {
        const contentId = String(it.contentId || '');
        if (contentId) maintenanceIds.add(contentId);
      }
    }

    const maintenanceOrders = maintenanceIds.size
      ? await this.prisma.patentMaintenanceOrder.findMany({
          where: { id: { in: Array.from(maintenanceIds) } },
          select: {
            id: true,
            schedule: {
              select: {
                yearNo: true,
                patent: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        })
      : [];
    const maintenanceTitleMap = new Map(
      maintenanceOrders.map((item: any) => [item.id, this.resolveMaintenanceTitle(item)]),
    );

    const unreadCounts = await Promise.all(
      items.map((item: any) => {
        const lastReadAt = Array.isArray(item.participants) ? item.participants[0]?.lastReadAt : null;
        return this.countUnreadMessages(item.id, req.auth.userId, lastReadAt || null);
      }),
    );

    return {
      items: items.map((it: any, index: number) => {
        const lastMessageAt = (it.lastMessageAt || it.updatedAt || it.createdAt) as Date;
        const latestMessage = Array.isArray(it.messages) && it.messages.length > 0 ? it.messages[0] : null;
        const contentType = (it.contentType || 'LISTING') as ConversationContentType;
        const contentTitle =
          contentType === 'LISTING'
            ? it.listing?.title ?? 'Consultation'
            : contentType === 'SUPPORT'
              ? '平台客服'
              : contentType === 'MAINTENANCE'
                ? maintenanceTitleMap.get(String(it.contentId || '')) ?? '年费代缴'
              : this.resolveDisputeTitle(it.order);
        return {
          id: it.id,
          contentType,
          contentId: String(it.contentId || it.listingId || ''),
          contentTitle,
          listingId: it.listingId ?? null,
          listingTitle: it.listing?.title ?? null,
          listingTopics: this.normalizeListingTopics(it.listing?.listingTopicsJson),
          lastMessagePreview: this.summarizeLastMessage(latestMessage),
          lastMessageAt: lastMessageAt.toISOString(),
          unreadCount: unreadCounts[index] ?? 0,
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
    await this.ensurePlatformManageableConversation(normalizedConversationId);
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
    await this.ensurePlatformManageableConversation(normalizedConversationId);
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
