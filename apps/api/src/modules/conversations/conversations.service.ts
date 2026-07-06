import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { ContentEventService } from '../../common/content-event.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WechatContentSecurityService } from '../../common/wechat-content-security.service';
import { normalizeDisplayText, resolvePublicAvatarUrl, resolvePublicFileUrl } from '../content-utils';

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
  orderId?: string | null;
  orderStatus?: string | null;
  orderTitle?: string | null;
  patentId?: string | null;
  patentTitle?: string | null;
  patentNoDisplay?: string | null;
  applicationNoDisplay?: string | null;
  maintenanceYearNo?: number | null;
  maintenancePatentTitle?: string | null;
  listingId?: string | null;
  listingTitle?: string | null;
  listingTopics?: ListingTopic[];
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  counterpart: {
    id: string;
    displayName?: string | null;
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
  fileId?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

type PagedConversationMessage = { items: ConversationMessageDto[]; nextCursor?: string | null };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CS_USER_ID = '00000000-0000-0000-0000-000000000002';
const PLATFORM_BRAND_NAME = 'ipmoney';
const PLATFORM_SUPPORT_TITLE = '\u5e73\u53f0\u5ba2\u670d';
const DEFAULT_CS_NICKNAME = '平台客服';
const DEFAULT_CONSULTATION_TITLE = '咨询内容';
const DEFAULT_TECH_MANAGER_TITLE = '技术经理人';
const STAFF_ROLE_NAMES = new Set(['admin', 'operator', 'finance', 'cs']);
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
    private readonly contentSecurity: WechatContentSecurityService,
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

  private isUuidLike(value: string): boolean {
    return UUID_RE.test(String(value || '').trim());
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

  private resolveCounterpartNickname(params: {
    conversation: any;
    viewerUserId: string;
    counterpart: any;
  }): string | null {
    const conversation = params.conversation;
    const viewerUserId = String(params.viewerUserId || '').trim();
    const counterpart = params.counterpart;
    const contentType = String(conversation?.contentType || '').trim().toUpperCase();
    const isListing = contentType === 'LISTING';
    const prefersEntityDisplayName = isListing || contentType === 'ACHIEVEMENT' || contentType === 'TECH_MANAGER';
    const listingRouting = String(conversation?.listing?.consultationRouting || '').trim().toUpperCase();
    const listingSource = String(conversation?.listing?.source || '').trim().toUpperCase();
    const isPlatformListing = isListing && listingRouting === 'PLATFORM' && (listingSource === 'ADMIN' || listingSource === 'PLATFORM');
    const counterpartId = String(counterpart?.id || '').trim();
    const sellerUserId = String(conversation?.sellerUserId || '').trim();
    if (isPlatformListing && sellerUserId && counterpartId === sellerUserId && sellerUserId !== viewerUserId) {
      return PLATFORM_BRAND_NAME;
    }
    if (prefersEntityDisplayName) {
      const verificationDisplayName = normalizeDisplayText(counterpart?.verifications?.[0]?.displayName);
      if (verificationDisplayName) return verificationDisplayName;
      return null;
    }
    const nickname = normalizeDisplayText(counterpart?.nickname);
    return nickname ?? null;
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

  private linkedOrderKey(listingId: unknown, buyerUserId: unknown): string | null {
    const normalizedListingId = String(listingId || '').trim();
    const normalizedBuyerUserId = String(buyerUserId || '').trim();
    if (!normalizedListingId || !normalizedBuyerUserId) return null;
    return `${normalizedListingId}:${normalizedBuyerUserId}`;
  }

  private toPlatformConversationSummary(
    it: any,
    unreadCount: number,
    achievementTitleMap: Map<string, string>,
    maintenanceTitleMap: Map<string, string>,
    maintenanceMetaMap: Map<string, { patentTitle: string | null; yearNo: number | null }>,
    linkedOrderMap: Map<string, any> = new Map(),
  ): ConversationSummary {
    const lastMessageAt = (it.lastMessageAt || it.updatedAt || it.createdAt) as Date;
    const latestMessage = Array.isArray(it.messages) && it.messages.length > 0 ? it.messages[0] : null;
    const contentType = (it.contentType || 'LISTING') as ConversationContentType;
    const contentId = String(it.contentId || it.listingId || '');
    const linkedOrder =
      it.order ??
      (contentType === 'LISTING' ? linkedOrderMap.get(this.linkedOrderKey(it.listingId, it.buyerUserId) || '') ?? null : null);
    const contentTitle =
      contentType === 'LISTING'
        ? it.listing?.title ?? DEFAULT_CONSULTATION_TITLE
        : contentType === 'ACHIEVEMENT'
          ? achievementTitleMap.get(contentId) ?? '成果咨询'
          : contentType === 'SUPPORT'
            ? '平台客服'
            : contentType === 'MAINTENANCE'
              ? maintenanceTitleMap.get(contentId) ?? '年费代缴'
              : this.resolveDisputeTitle(linkedOrder);
    const maintenanceMeta = contentType === 'MAINTENANCE' ? maintenanceMetaMap.get(contentId) ?? null : null;
    return {
      id: it.id,
      contentType,
      contentId,
      contentTitle,
      orderId: it.orderId ?? linkedOrder?.id ?? null,
      orderStatus: linkedOrder?.status ?? null,
      orderTitle: linkedOrder ? this.resolveDisputeTitle(linkedOrder) : null,
      patentId:
        contentType === 'MAINTENANCE'
          ? it.order?.schedule?.patentId ?? null
          : contentType === 'LISTING'
            ? it.listing?.patentId ?? null
            : contentType === 'DISPUTE'
              ? linkedOrder?.listing?.patentId ?? null
              : null,
      patentTitle:
        contentType === 'MAINTENANCE'
          ? maintenanceMeta?.patentTitle ?? null
          : contentType === 'LISTING'
            ? it.listing?.patent?.title ?? it.listing?.title ?? null
            : contentType === 'DISPUTE'
              ? linkedOrder?.listing?.patent?.title ?? null
              : null,
      patentNoDisplay:
        contentType === 'MAINTENANCE'
          ? it.order?.schedule?.patent?.patentNoDisplay ?? null
          : contentType === 'LISTING'
            ? it.listing?.patent?.patentNoDisplay ?? null
            : contentType === 'DISPUTE'
              ? linkedOrder?.listing?.patent?.patentNoDisplay ?? null
              : null,
      applicationNoDisplay:
        contentType === 'MAINTENANCE'
          ? it.order?.schedule?.patent?.applicationNoDisplay ?? null
          : contentType === 'LISTING'
            ? it.listing?.patent?.applicationNoDisplay ?? null
            : contentType === 'DISPUTE'
              ? linkedOrder?.listing?.patent?.applicationNoDisplay ?? null
              : null,
      maintenanceYearNo: maintenanceMeta?.yearNo ?? null,
      maintenancePatentTitle: maintenanceMeta?.patentTitle ?? null,
      listingId: it.listingId ?? null,
      listingTitle: it.listing?.title ?? null,
      listingTopics: this.normalizeListingTopics(it.listing?.listingTopicsJson),
      lastMessagePreview: this.summarizeLastMessage(latestMessage),
      lastMessageAt: lastMessageAt.toISOString(),
      unreadCount: unreadCount ?? 0,
      counterpart: {
        id: it.buyer?.id || it.buyerUserId,
        displayName: normalizeDisplayText(it.buyer?.verifications?.[0]?.displayName) ?? normalizeDisplayText(it.buyer?.nickname) ?? null,
        nickname: normalizeDisplayText(it.buyer?.nickname) ?? null,
        avatarUrl: resolvePublicAvatarUrl(it.buyer?.avatarUrl),
        role: it.buyer?.role ?? null,
      },
      assignedAgentUserIds: Array.isArray(it.agents)
        ? it.agents.map((agent: any) => String(agent.operatorUserId || '')).filter((id: string) => Boolean(id))
        : [],
    } satisfies ConversationSummary;
  }

  private matchesPlatformConversationSummary(summary: ConversationSummary, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return true;
    const candidates = [
      normalizeDisplayText(summary.counterpart?.displayName),
      normalizeDisplayText(summary.counterpart?.nickname),
      normalizeDisplayText(summary.contentTitle),
      normalizeDisplayText(summary.listingTitle),
      normalizeDisplayText(summary.lastMessagePreview),
    ]
      .filter(Boolean)
      .map((item) => String(item).toLowerCase());
    return candidates.some((candidate) => candidate.includes(normalizedKeyword));
  }

  private scorePlatformConversationSummary(summary: ConversationSummary, keyword: string): number {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return 0;

    const counterpartDisplayName = normalizeDisplayText(summary.counterpart?.displayName)?.toLowerCase() ?? '';
    const counterpartNickname = normalizeDisplayText(summary.counterpart?.nickname)?.toLowerCase() ?? '';
    const contentTitle = normalizeDisplayText(summary.contentTitle)?.toLowerCase() ?? '';
    const listingTitle = normalizeDisplayText(summary.listingTitle)?.toLowerCase() ?? '';
    const lastMessagePreview = normalizeDisplayText(summary.lastMessagePreview)?.toLowerCase() ?? '';

    let score = 0;
    if (counterpartDisplayName === normalizedKeyword) score += 1000;
    else if (counterpartDisplayName.startsWith(normalizedKeyword)) score += 850;
    else if (counterpartDisplayName.includes(normalizedKeyword)) score += 650;

    if (counterpartNickname === normalizedKeyword) score += 420;
    else if (counterpartNickname.startsWith(normalizedKeyword)) score += 300;
    else if (counterpartNickname.includes(normalizedKeyword)) score += 180;

    if (contentTitle === normalizedKeyword) score += 320;
    else if (contentTitle.startsWith(normalizedKeyword)) score += 240;
    else if (contentTitle.includes(normalizedKeyword)) score += 160;

    if (listingTitle === normalizedKeyword) score += 260;
    else if (listingTitle.startsWith(normalizedKeyword)) score += 200;
    else if (listingTitle.includes(normalizedKeyword)) score += 140;

    if (lastMessagePreview.includes(normalizedKeyword)) score += 60;

    return score;
  }

  private hasStrongPlatformConversationMatch(summary: ConversationSummary, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return false;
    const counterpartDisplayName = normalizeDisplayText(summary.counterpart?.displayName)?.toLowerCase() ?? '';
    const contentTitle = normalizeDisplayText(summary.contentTitle)?.toLowerCase() ?? '';
    return (
      Boolean(counterpartDisplayName) &&
      (counterpartDisplayName === normalizedKeyword || counterpartDisplayName.startsWith(normalizedKeyword))
    ) ||
      (Boolean(contentTitle) && (contentTitle === normalizedKeyword || contentTitle.startsWith(normalizedKeyword)));
  }

  private paginateItems<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
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
        nickname: DEFAULT_CS_NICKNAME,
      },
      create: {
        id: DEFAULT_CS_USER_ID,
        role: 'cs',
        nickname: DEFAULT_CS_NICKNAME,
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

  private hasPermission(req: any, permission: string): boolean {
    const perms: Set<string> | undefined = req?.auth?.permissions;
    return Boolean(perms && (perms.has('*') || perms.has(permission)));
  }

  private hasWildcardPermission(req: any): boolean {
    const perms: Set<string> | undefined = req?.auth?.permissions;
    return Boolean(perms && perms.has('*'));
  }

  private isPlatformConversation(conv: any): boolean {
    return (
      conv.contentType === 'SUPPORT' ||
      conv.contentType === 'DISPUTE' ||
      conv.contentType === 'MAINTENANCE' ||
      conv.contentType === 'ACHIEVEMENT' ||
      conv.contentType === 'LISTING'
    );
  }

  private canManagePlatformConversation(req: any, conv: any): boolean {
    return Boolean(req?.auth?.isAdmin && this.hasPermission(req, 'conversation.platform.manage') && this.isPlatformConversation(conv));
  }

  private async autoAssignPlatformAgentOnReply(req: any, conv: any): Promise<void> {
    if (!this.canManagePlatformConversation(req, conv)) return;
    if (conv.buyerUserId === req.auth.userId || conv.sellerUserId === req.auth.userId) return;
    await this.prisma.conversationAgent.upsert({
      where: {
        conversationId_operatorUserId: {
          conversationId: conv.id,
          operatorUserId: req.auth.userId,
        },
      },
      create: {
        conversationId: conv.id,
        operatorUserId: req.auth.userId,
        assignedByUserId: req.auth.userId,
        active: true,
      },
      update: {
        assignedByUserId: req.auth.userId,
        active: true,
      },
    });
    await this.syncTradeOrderAssigneeFromPlatformAgent(conv, req.auth.userId);
  }

  private async resolveLinkedTradeOrderForConversation(conv: any): Promise<any | null> {
    const orderId = String(conv?.orderId || '').trim();
    if (orderId) {
      return await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, assignedCsUserId: true },
      });
    }

    if (String(conv?.contentType || '').toUpperCase() !== 'LISTING') return null;
    const listingId = String(conv?.listingId || '').trim();
    const buyerUserId = String(conv?.buyerUserId || '').trim();
    if (!listingId || !buyerUserId) return null;

    return await this.prisma.order.findFirst({
      where: {
        listingId,
        buyerUserId,
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, assignedCsUserId: true },
    });
  }

  private async syncTradeOrderAssigneeFromPlatformAgent(conv: any, operatorUserId: string): Promise<void> {
    const order = await this.resolveLinkedTradeOrderForConversation(conv);
    if (!order?.id) return;

    const apply = async (client: any) => {
      if (!conv?.orderId && typeof client.conversation?.update === 'function') {
        await client.conversation.update({
          where: { id: conv.id },
          data: { orderId: order.id },
        });
      }
      if (order.assignedCsUserId !== operatorUserId) {
        await client.order.update({
          where: { id: order.id },
          data: { assignedCsUserId: operatorUserId },
        });
      }
      const followupCase = await client.csCase.findFirst({
        where: { orderId: order.id, type: 'FOLLOWUP' },
        select: { id: true, csUserId: true },
      });
      if (followupCase && followupCase.csUserId !== operatorUserId) {
        await client.csCase.update({
          where: { id: followupCase.id },
          data: { csUserId: operatorUserId },
        });
      }
    };

    const tx = (this.prisma as any).$transaction;
    if (typeof tx === 'function') {
      await tx(async (client: any) => apply(client));
      return;
    }
    await apply(this.prisma);
  }

  private async assertConversationAccessible(conv: any, req: any, options: { allowPlatformManager?: boolean } = {}): Promise<void> {
    const userId = req?.auth?.userId;
    if (options.allowPlatformManager && this.canManagePlatformConversation(req, conv) && this.hasWildcardPermission(req)) return;
    if (conv.buyerUserId === userId || conv.sellerUserId === userId) return;
    const isAgent = await this.isConversationAgent(conv.id, userId);
    if (!isAgent) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限访问该会话' });
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
      const listing = await this.prisma.listing.findFirst({
        where: { id: normalizedContentId, auditStatus: 'APPROVED', status: 'ACTIVE' },
      });
      if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
      return {
        sellerUserId: listing.sellerUserId,
        contentTitle: listing.title ?? DEFAULT_CONSULTATION_TITLE,
        listingId: listing.id,
        listingTitle: listing.title ?? null,
      };
    }
    if (contentType === 'ACHIEVEMENT') {
      const achievement = await this.prisma.achievement.findFirst({
        where: { id: normalizedContentId, auditStatus: 'APPROVED', status: 'ACTIVE' },
      });
      if (!achievement) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
      return {
        sellerUserId: achievement.publisherUserId,
        contentTitle: achievement.title ?? DEFAULT_CONSULTATION_TITLE,
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
      contentTitle: normalizeDisplayText(verification.displayName) ?? DEFAULT_TECH_MANAGER_TITLE,
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
      (conversation.contentType === 'LISTING' && conversation.listing?.consultationRouting === 'PLATFORM') ||
      conversation.contentType === 'ACHIEVEMENT';
    const isPlatformSupport =
      conversation.contentType === 'SUPPORT' ||
      conversation.contentType === 'DISPUTE' ||
      conversation.contentType === 'MAINTENANCE';
    if (!isPlatformConsultation && !isPlatformSupport) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'conversation is not managed by platform inbox' });
    }
    return conversation;
  }

  private async ensureAssignablePlatformAgentUser(userId: string) {
    const normalizedUserId = this.parseUuidStrict(userId, 'userId');
    const operator = await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        role: true,
        rbacRoles: {
          select: { roleId: true },
        },
      },
    });
    if (!operator) throw new NotFoundException({ code: 'NOT_FOUND', message: 'user not found' });
    const isStaff =
      STAFF_ROLE_NAMES.has(String(operator.role || '').trim().toLowerCase()) ||
      (Array.isArray(operator.rbacRoles) && operator.rbacRoles.length > 0);
    if (!isStaff) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'user is not assignable as platform agent' });
    }
    return operator;
  }

  async listMine(req: any, query: any): Promise<PagedConversationSummary> {
    this.ensureAuth(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const mineWhere: any = this.buildMineWhere(req.auth.userId);
    if (this.hasOwn(query, 'conversationId')) {
      mineWhere.id = this.parseUuidStrict(query?.conversationId, 'conversationId');
    }

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: mineWhere,
        include: {
          listing: true,
          order: {
            include: {
              listing: {
                select: {
                  id: true,
                  title: true,
                  patentId: true,
                  patent: {
                    select: {
                      id: true,
                      title: true,
                      patentNoDisplay: true,
                      applicationNoDisplay: true,
                    },
                  },
                },
              },
            },
          },
          buyer: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
          seller: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
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
      techManagers.map((item: any) => [item.userId, normalizeDisplayText(item.displayName) ?? DEFAULT_TECH_MANAGER_TITLE]),
    );

    const achievements = achievementIds.size
      ? await this.prisma.achievement.findMany({
          where: { id: { in: Array.from(achievementIds) } },
          select: { id: true, title: true },
        })
      : [];
    const achievementMap = new Map(achievements.map((item: any) => [item.id, item.title ?? DEFAULT_CONSULTATION_TITLE]));

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
                    id: true,
                    title: true,
                    patentNoDisplay: true,
                    applicationNoDisplay: true,
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
          ? it.listing?.title ?? DEFAULT_CONSULTATION_TITLE
          : contentType === 'ACHIEVEMENT'
            ? achievementMap.get(contentId) ?? DEFAULT_CONSULTATION_TITLE
            : contentType === 'TECH_MANAGER'
              ? techManagerMap.get(contentId) ?? DEFAULT_TECH_MANAGER_TITLE
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
          displayName: this.resolveCounterpartNickname({
            conversation: it,
            viewerUserId: req.auth.userId,
            counterpart,
          }),
          nickname: this.resolveCounterpartNickname({
            conversation: it,
            viewerUserId: req.auth.userId,
            counterpart,
          }),
          avatarUrl: resolvePublicAvatarUrl(counterpart?.avatarUrl),
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

  async getMineConversation(req: any, conversationId: string): Promise<ConversationSummary> {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const result = await this.listMine(req, { page: 1, pageSize: 1, conversationId: normalizedConversationId } as any);
    const item = (result.items || [])[0] || null;
    if (!item || item.id !== normalizedConversationId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    }
    return item;
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
    return this.toConversationDto(conversation, PLATFORM_SUPPORT_TITLE, null);
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
    await this.assertConversationAccessible(conv, req, { allowPlatformManager: true });
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
      include: {
        file: true,
      },
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
        fileId: m.fileId ?? undefined,
        fileUrl: resolvePublicFileUrl(m.file, { baseUrl: process.env.BASE_URL }) ?? undefined,
        ...(m.file
          ? {
              fileName: m.file.fileName ?? undefined,
              mimeType: m.file.mimeType ?? undefined,
              sizeBytes: m.file.sizeBytes ?? undefined,
            }
          : {}),
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
    if (type !== 'TEXT' && type !== 'EMOJI' && type !== 'IMAGE' && type !== 'FILE') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid message type' });
    }
    const text = String(body?.text || '').trim();
    if ((type === 'TEXT' || type === 'EMOJI') && !text) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'text is required' });
    }

    const conv = await this.prisma.conversation.findUnique({ where: { id: normalizedConversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    await this.assertConversationAccessible(conv, req, { allowPlatformManager: true });
    await this.autoAssignPlatformAgentOnReply(req, conv);
    let file: any = null;
    let fileId: string | undefined;
    if (type === 'IMAGE' || type === 'FILE') {
      fileId = this.parseUuidStrict(body?.fileId, 'fileId');
      file = await this.prisma.file.findUnique({ where: { id: fileId } });
      if (!file || String(file.ownerId || '') !== String(req.auth.userId || '')) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'fileId is invalid' });
      }
      const isImage = String(file.mimeType || '').toLowerCase().startsWith('image/');
      if (type === 'IMAGE' && !isImage) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'fileId is invalid' });
      }
    }

    if ((type === 'TEXT' || type === 'EMOJI') && process.env.NODE_ENV !== 'production' && process.env.WECHAT_CONTENT_SECURITY_ENFORCE !== '1') {
      // Keep local chat flow usable during WeChat MP dev / webview debugging.
    } else if (type === 'TEXT' || type === 'EMOJI') {
      await this.contentSecurity.assertSafeText(text, {
        openid: req.auth.wechatOpenid,
        requestMeta: {
          actorUserId: req.auth.userId,
          targetType: 'CONVERSATION',
          targetId: normalizedConversationId,
        },
      });
    }

    const msg = await this.prisma.conversationMessage.create({
      data: {
        conversationId: normalizedConversationId,
        senderUserId: req.auth.userId,
        type: type as ConversationMessageType,
        text: text || null,
        fileId,
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
      text: msg.text ?? undefined,
      fileId: msg.fileId ?? undefined,
      fileUrl: resolvePublicFileUrl(file, { baseUrl: process.env.BASE_URL }) ?? undefined,
      ...(file
        ? {
            fileName: file.fileName ?? undefined,
            mimeType: file.mimeType ?? undefined,
            sizeBytes: file.sizeBytes ?? undefined,
          }
        : {}),
      createdAt: msg.createdAt.toISOString(),
    };
  }

  async markRead(req: any, conversationId: string) {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const conv = await this.prisma.conversation.findUnique({ where: { id: normalizedConversationId } });
    if (!conv) throw new NotFoundException({ code: 'NOT_FOUND', message: 'conversation not found' });
    await this.assertConversationAccessible(conv, req, { allowPlatformManager: true });
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
    const fullAccess = this.hasWildcardPermission(req);
    const effectiveAssignedFilter = !fullAccess || mineOnly ? ('MINE' as const) : assignedFilter;
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
        ? listingTopic
          ? {
              contentType: 'LISTING',
              listing: {
                consultationRouting: 'PLATFORM',
                listingTopicsJson: { array_contains: [listingTopic] },
              },
            }
          : {
              OR: [{ contentType: 'ACHIEVEMENT' }, { contentType: 'LISTING', listing: { consultationRouting: 'PLATFORM' } }],
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
                  { contentType: 'ACHIEVEMENT' },
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
    const qFilter = q;
    if (qFilter) {
      const qOrFilters: any[] = [
        { listing: { title: { contains: qFilter, mode: 'insensitive' } } },
        { buyer: { verifications: { some: { displayName: { contains: qFilter, mode: 'insensitive' } } } } },
        { buyer: { nickname: { contains: qFilter, mode: 'insensitive' } } },
      ];
      if (this.isUuidLike(qFilter)) {
        qOrFilters.push({ id: qFilter });
        qOrFilters.push({ contentId: qFilter });
        qOrFilters.push({ buyerUserId: qFilter });
        qOrFilters.push({ orderId: qFilter });
      }
      andFilters.push({
        OR: qOrFilters,
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

    const queryOptions: any = {
      where,
      include: {
        listing: true,
        order: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                patentId: true,
                patent: {
                  select: {
                    id: true,
                    title: true,
                    patentNoDisplay: true,
                    applicationNoDisplay: true,
                  },
                },
              },
            },
            },
          },
        buyer: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
        seller: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
        agents: { where: { active: true } },
        participants: { where: { userId: req.auth.userId }, select: { lastReadAt: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' as const },
    };
    const [items, total] = qFilter
      ? await Promise.all([
          this.prisma.conversation.findMany(queryOptions),
          Promise.resolve(0),
        ])
      : await Promise.all([
          this.prisma.conversation.findMany({
            ...queryOptions,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.prisma.conversation.count({ where }),
        ]);

    const maintenanceIds = new Set<string>();
    const achievementIds = new Set<string>();
    const linkedOrderFilters: Array<{ listingId: string; buyerUserId: string }> = [];
    const linkedOrderKeys = new Set<string>();
    for (const it of items as any[]) {
      if (String(it.contentType || '').toUpperCase() === 'MAINTENANCE') {
        const contentId = String(it.contentId || '');
        if (contentId) maintenanceIds.add(contentId);
      } else if (String(it.contentType || '').toUpperCase() === 'ACHIEVEMENT') {
        const contentId = String(it.contentId || '');
        if (contentId) achievementIds.add(contentId);
      } else if (String(it.contentType || '').toUpperCase() === 'LISTING' && !it.orderId && !it.order) {
        const key = this.linkedOrderKey(it.listingId, it.buyerUserId);
        if (key && !linkedOrderKeys.has(key)) {
          linkedOrderKeys.add(key);
          linkedOrderFilters.push({ listingId: String(it.listingId), buyerUserId: String(it.buyerUserId) });
        }
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
                patentId: true,
                patent: {
                  select: {
                    id: true,
                    title: true,
                    patentNoDisplay: true,
                    applicationNoDisplay: true,
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
    const maintenanceMetaMap = new Map(
      maintenanceOrders.map((item: any) => [
        item.id,
        {
          patentTitle: item.schedule?.patent?.title ?? null,
          yearNo: Number.isSafeInteger(Number(item.schedule?.yearNo || 0)) ? Number(item.schedule?.yearNo) : null,
        },
      ]),
    );
    const achievements = achievementIds.size
      ? await this.prisma.achievement.findMany({
          where: { id: { in: Array.from(achievementIds) } },
          select: { id: true, title: true },
        })
      : [];
    const achievementTitleMap = new Map(achievements.map((item: any) => [item.id, item.title || '成果咨询']));
    const linkedOrders = linkedOrderFilters.length
      ? await this.prisma.order.findMany({
          where: { OR: linkedOrderFilters },
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                patentId: true,
                patent: {
                  select: {
                    id: true,
                    title: true,
                    patentNoDisplay: true,
                    applicationNoDisplay: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const linkedOrderMap = new Map<string, any>();
    for (const order of linkedOrders as any[]) {
      const key = this.linkedOrderKey(order.listingId, order.buyerUserId);
      if (key && !linkedOrderMap.has(key)) {
        linkedOrderMap.set(key, order);
      }
    }

    const unreadCounts = await Promise.all(
      items.map((item: any) => {
        const lastReadAt = Array.isArray(item.participants) ? item.participants[0]?.lastReadAt : null;
        return this.countUnreadMessages(item.id, req.auth.userId, lastReadAt || null);
      }),
    );

    const mapped = items.map((it: any, index: number) =>
      this.toPlatformConversationSummary(
        it,
        unreadCounts[index] ?? 0,
        achievementTitleMap,
        maintenanceTitleMap,
        maintenanceMetaMap,
        linkedOrderMap,
      ),
    );

    if (qFilter) {
      const matched = mapped.filter((item) => this.matchesPlatformConversationSummary(item, qFilter));
      const strongMatches = matched.filter((item) => this.hasStrongPlatformConversationMatch(item, qFilter));
      const searchPool = strongMatches.length ? strongMatches : matched;
      const filtered = searchPool.sort(
        (a, b) => this.scorePlatformConversationSummary(b, qFilter) - this.scorePlatformConversationSummary(a, qFilter),
      );
      const paged = this.paginateItems(filtered, page, pageSize);
      return {
        items: paged.items,
        page: { page, pageSize, total: paged.total },
      };
    }

    return {
      items: mapped,
      page: { page, pageSize, total },
    };
  }

  async assignPlatformAgent(req: any, conversationId: string, body: any) {
    this.ensureAuth(req);
    const normalizedConversationId = this.parseUuidStrict(conversationId, 'conversationId');
    const operatorUserId = this.hasOwn(body, 'userId')
      ? this.parseUuidStrict(body?.userId, 'userId')
      : this.parseUuidStrict(req?.auth?.userId, 'userId');
    const conversation = await this.ensurePlatformManageableConversation(normalizedConversationId);
    await this.ensureAssignablePlatformAgentUser(operatorUserId);
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
    await this.syncTradeOrderAssigneeFromPlatformAgent(conversation, operatorUserId);
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
