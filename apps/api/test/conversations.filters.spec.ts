import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationsService } from '../src/modules/conversations/conversations.service';

describe('ConversationsService pagination and id strictness suite', () => {
  let prisma: any;
  let contentSecurity: any;
  let service: ConversationsService;

  beforeEach(() => {
    prisma = {
      conversation: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
      },
      achievement: {
        findMany: vi.fn(),
      },
      userVerification: {
        findMany: vi.fn(),
      },
      conversationAgent: {
        findFirst: vi.fn(),
      },
      conversationMessage: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
      },
    };
    const events = { recordConsult: vi.fn().mockResolvedValue(undefined) };
    contentSecurity = { assertSafeText: vi.fn().mockResolvedValue(undefined) };
    service = new ConversationsService(prisma, events as any, contentSecurity);
  });

  it('requires auth for listMine', async () => {
    await expect(service.listMine({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid listMine pagination strictly', async () => {
    const req = { auth: { userId: 'u-1' } };
    await expect(service.listMine(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMine(req, { page: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMine(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMine(req, { page: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMine(req, { pageSize: '9007199254740992' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps listMine pageSize and applies user-bound where clause', async () => {
    const req = { auth: { userId: 'u-1' } };
    prisma.conversation.findMany.mockResolvedValueOnce([]);
    prisma.conversation.count.mockResolvedValueOnce(0);

    const result = await service.listMine(req, { page: '2', pageSize: '100' });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { buyerUserId: 'u-1' },
          { sellerUserId: 'u-1' },
          { agents: { some: { operatorUserId: 'u-1', active: true } } },
        ],
      },
      include: {
        listing: true,
        order: { include: { listing: { select: { id: true, title: true } } } },
        buyer: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
        seller: { include: { verifications: { orderBy: { submittedAt: 'desc' }, take: 1 } } },
        agents: { where: { active: true } },
        participants: { where: { userId: 'u-1' }, select: { lastReadAt: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: 50,
      take: 50,
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('getMineConversation returns exact conversation summary and rejects missing record', async () => {
    const req = { auth: { userId: 'u-1' } };
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        contentType: 'SUPPORT',
        contentId: '11111111-1111-1111-1111-111111111111',
        listingId: null,
        buyerUserId: 'u-1',
        sellerUserId: 'u-2',
        listing: null,
        buyer: { id: 'u-1', nickname: 'Buyer', avatarUrl: null, role: 'buyer' },
        seller: { id: 'u-2', nickname: 'CS', avatarUrl: null, role: 'cs' },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-1', text: 'hello', type: 'TEXT', createdAt: new Date('2026-03-14T01:10:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:10:00.000Z'),
        updatedAt: new Date('2026-03-14T01:10:00.000Z'),
        createdAt: new Date('2026-03-14T01:00:00.000Z'),
      },
    ]);
    prisma.conversation.count.mockResolvedValueOnce(1);
    prisma.conversationMessage.count.mockResolvedValueOnce(0);

    const result = await service.getMineConversation(req, '11111111-1111-1111-1111-111111111111');
    expect(result).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      contentType: 'SUPPORT',
    });

    prisma.conversation.findMany.mockResolvedValueOnce([]);
    prisma.conversation.count.mockResolvedValueOnce(0);
    await expect(service.getMineConversation(req, '11111111-1111-1111-1111-111111111111')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('normalizes platform listing counterpart nickname to ipmoney in listMine', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        contentType: 'LISTING',
        contentId: '22222222-2222-2222-2222-222222222222',
        listingId: '22222222-2222-2222-2222-222222222222',
        buyerUserId: 'buyer-1',
        sellerUserId: 'seller-platform',
        listing: {
          id: '22222222-2222-2222-2222-222222222222',
          title: '平台挂牌',
          consultationRouting: 'PLATFORM',
          source: 'ADMIN',
          listingTopicsJson: [],
        },
        buyer: { id: 'buyer-1', nickname: 'Buyer', avatarUrl: null, role: 'buyer', verifications: [] },
        seller: { id: 'seller-platform', nickname: 'Ming', avatarUrl: null, role: 'seller', verifications: [] },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-1', text: 'hello', type: 'TEXT', createdAt: new Date('2026-03-14T01:10:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:10:00.000Z'),
        updatedAt: new Date('2026-03-14T01:10:00.000Z'),
        createdAt: new Date('2026-03-14T01:00:00.000Z'),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        contentType: 'LISTING',
        contentId: '44444444-4444-4444-4444-444444444444',
        listingId: '44444444-4444-4444-4444-444444444444',
        buyerUserId: 'buyer-1',
        sellerUserId: 'seller-user',
        listing: {
          id: '44444444-4444-4444-4444-444444444444',
          title: '用户挂牌',
          consultationRouting: 'OWNER',
          source: 'USER',
          listingTopicsJson: [],
        },
        buyer: { id: 'buyer-1', nickname: 'Buyer', avatarUrl: null, role: 'buyer', verifications: [] },
        seller: {
          id: 'seller-user',
          nickname: 'Seller Nick',
          avatarUrl: null,
          role: 'seller',
          verifications: [{ displayName: '广州技术转移中心' }],
        },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-2', text: 'hi', type: 'TEXT', createdAt: new Date('2026-03-14T01:11:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:11:00.000Z'),
        updatedAt: new Date('2026-03-14T01:11:00.000Z'),
        createdAt: new Date('2026-03-14T01:01:00.000Z'),
      },
    ]);
    prisma.conversation.count.mockResolvedValueOnce(2);
    prisma.conversationMessage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const result = await service.listMine(req, { page: '1', pageSize: '20' });

    expect(result.items[0]?.counterpart?.nickname).toBe('ipmoney');
    expect(result.items[1]?.counterpart?.nickname).toBe('广州技术转移中心');
  });

  it('does not fall back to raw nickname for entity conversations when formal display name is missing', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        contentType: 'LISTING',
        contentId: '22222222-2222-2222-2222-222222222222',
        listingId: '22222222-2222-2222-2222-222222222222',
        buyerUserId: 'buyer-1',
        sellerUserId: 'seller-user',
        listing: {
          id: '22222222-2222-2222-2222-222222222222',
          title: '挂牌标题 A',
          consultationRouting: 'OWNER',
          source: 'USER',
          listingTopicsJson: [],
        },
        buyer: { id: 'buyer-1', nickname: 'Buyer', avatarUrl: null, role: 'buyer', verifications: [] },
        seller: {
          id: 'seller-user',
          nickname: 'Raw Seller Nick',
          avatarUrl: null,
          role: 'seller',
          verifications: [],
        },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-1', text: 'hello', type: 'TEXT', createdAt: new Date('2026-03-14T01:10:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:10:00.000Z'),
        updatedAt: new Date('2026-03-14T01:10:00.000Z'),
        createdAt: new Date('2026-03-14T01:00:00.000Z'),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        contentType: 'ACHIEVEMENT',
        contentId: '44444444-4444-4444-4444-444444444444',
        listingId: null,
        buyerUserId: 'buyer-1',
        sellerUserId: 'seller-achievement',
        listing: null,
        buyer: { id: 'buyer-1', nickname: 'Buyer', avatarUrl: null, role: 'buyer', verifications: [] },
        seller: {
          id: 'seller-achievement',
          nickname: 'Raw Publisher Nick',
          avatarUrl: null,
          role: 'seller',
          verifications: [],
        },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-2', text: 'hi', type: 'TEXT', createdAt: new Date('2026-03-14T01:11:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:11:00.000Z'),
        updatedAt: new Date('2026-03-14T01:11:00.000Z'),
        createdAt: new Date('2026-03-14T01:01:00.000Z'),
      },
    ]);
    prisma.conversation.count.mockResolvedValueOnce(2);
    prisma.achievement.findMany.mockResolvedValueOnce([{ id: '44444444-4444-4444-4444-444444444444', title: '成果标题 A' }]);
    prisma.conversationMessage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const result = await service.listMine(req, { page: '1', pageSize: '20' });

    expect(result.items[0]?.counterpart?.nickname).toBeNull();
    expect(result.items[0]?.contentTitle).toBe('挂牌标题 A');
    expect(result.items[1]?.counterpart?.nickname).toBeNull();
    expect(result.items[1]?.contentTitle).toBe('成果标题 A');
  });

  it('validates conversationId format and participant boundary in listMessages', async () => {
    const req = { auth: { userId: 'u-1' } };
    await expect(service.listMessages(req, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.conversation.findUnique.mockResolvedValueOnce(null);
    await expect(service.listMessages(req, '11111111-1111-1111-1111-111111111111', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: '11111111-1111-1111-1111-111111111111',
      buyerUserId: 'u-2',
      sellerUserId: 'u-3',
    });
    prisma.conversationAgent.findFirst.mockResolvedValueOnce(null);
    await expect(service.listMessages(req, '11111111-1111-1111-1111-111111111111', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns mapped message items for participant and trims conversationId', async () => {
    const req = { auth: { userId: 'u-1' } };
    const id = '11111111-1111-1111-1111-111111111111';
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id,
      buyerUserId: 'u-1',
      sellerUserId: 'u-2',
    });
    prisma.conversationMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-1',
        conversationId: id,
        senderUserId: 'u-1',
        type: 'TEXT',
        text: 'hello',
        createdAt: new Date('2026-03-14T01:00:00.000Z'),
      },
      {
        id: 'm-2',
        conversationId: id,
        senderUserId: 'u-2',
        type: 'EMOJI',
        text: null,
        createdAt: new Date('2026-03-14T01:05:00.000Z'),
      },
    ]);

    const result = await service.listMessages(req, ` ${id} `, {});

    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith({
      where: { conversationId: id },
      include: { file: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    expect(result).toEqual({
      items: [
        {
          id: 'm-2',
          conversationId: id,
          senderUserId: 'u-2',
          type: 'EMOJI',
          text: undefined,
          fileId: undefined,
          fileUrl: undefined,
          createdAt: '2026-03-14T01:05:00.000Z',
        },
        {
          id: 'm-1',
          conversationId: id,
          senderUserId: 'u-1',
          type: 'TEXT',
          text: 'hello',
          fileId: undefined,
          fileUrl: undefined,
          createdAt: '2026-03-14T01:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
  });

  it('allows platform conversation managers to read platform conversation messages', async () => {
    const req = {
      auth: {
        userId: 'admin-1',
        isAdmin: true,
        permissions: new Set(['conversation.platform.manage']),
      },
    };
    const id = '11111111-1111-1111-1111-111111111111';
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id,
      contentType: 'SUPPORT',
      buyerUserId: 'u-1',
      sellerUserId: 'u-2',
    });
    prisma.conversationMessage.findMany.mockResolvedValueOnce([
      {
        id: 'm-1',
        conversationId: id,
        senderUserId: 'u-1',
        type: 'TEXT',
        text: 'hello',
        createdAt: new Date('2026-03-14T01:00:00.000Z'),
      },
    ]);

    await expect(service.listMessages(req, id, {})).resolves.toMatchObject({
      items: [{ id: 'm-1', text: 'hello' }],
    });
    expect(prisma.conversationAgent.findFirst).not.toHaveBeenCalled();
  });

  it('supports cursor pagination for listMessages', async () => {
    const req = { auth: { userId: 'u-1' } };
    const conversationId = '11111111-1111-1111-1111-111111111111';
    const cursorId = '99999999-9999-4999-8999-999999999999';
    const newestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const olderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const oldestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: conversationId,
      buyerUserId: 'u-1',
      sellerUserId: 'u-2',
    });
    prisma.conversationMessage.findFirst.mockResolvedValueOnce({
      id: cursorId,
      createdAt: new Date('2026-03-14T01:10:00.000Z'),
    });
    prisma.conversationMessage.findMany.mockResolvedValueOnce([
      {
        id: newestId,
        conversationId,
        senderUserId: 'u-1',
        type: 'TEXT',
        text: 'newest',
        createdAt: new Date('2026-03-14T01:09:00.000Z'),
      },
      {
        id: olderId,
        conversationId,
        senderUserId: 'u-2',
        type: 'TEXT',
        text: 'older',
        createdAt: new Date('2026-03-14T01:08:00.000Z'),
      },
      {
        id: oldestId,
        conversationId,
        senderUserId: 'u-2',
        type: 'TEXT',
        text: 'oldest',
        createdAt: new Date('2026-03-14T01:07:00.000Z'),
      },
    ]);

    const result = await service.listMessages(req, conversationId, { cursor: cursorId, limit: '2' });

    expect(prisma.conversationMessage.findFirst).toHaveBeenCalledWith({
      where: { id: cursorId, conversationId },
      select: { id: true, createdAt: true },
    });
    expect(prisma.conversationMessage.findMany).toHaveBeenCalledWith({
      where: {
        conversationId,
        OR: [
          { createdAt: { lt: new Date('2026-03-14T01:10:00.000Z') } },
          {
            AND: [
              { createdAt: new Date('2026-03-14T01:10:00.000Z') },
              { id: { lt: cursorId } },
            ],
          },
        ],
      },
      include: { file: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });
    expect(result).toEqual({
      items: [
        {
          id: olderId,
          conversationId,
          senderUserId: 'u-2',
          type: 'TEXT',
          text: 'older',
          fileId: undefined,
          fileUrl: undefined,
          createdAt: '2026-03-14T01:08:00.000Z',
        },
        {
          id: newestId,
          conversationId,
          senderUserId: 'u-1',
          type: 'TEXT',
          text: 'newest',
          fileId: undefined,
          fileUrl: undefined,
          createdAt: '2026-03-14T01:09:00.000Z',
        },
      ],
      nextCursor: olderId,
    });
  });

  it('returns not found when cursor does not belong to conversation', async () => {
    const req = { auth: { userId: 'u-1' } };
    const conversationId = '11111111-1111-1111-1111-111111111111';
    const cursorId = '99999999-9999-4999-8999-999999999999';

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: conversationId,
      buyerUserId: 'u-1',
      sellerUserId: 'u-2',
    });
    prisma.conversationMessage.findFirst.mockResolvedValueOnce(null);

    await expect(service.listMessages(req, conversationId, { cursor: cursorId })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applies platform conversation filters in listPlatformConversations', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    prisma.conversation.findMany.mockResolvedValueOnce([]);
    prisma.conversation.count.mockResolvedValueOnce(0);

    await service.listPlatformConversations(req, {
      page: '2',
      pageSize: '20',
      assigned: 'UNASSIGNED',
      q: 'buyer-keyword',
      listingTopic: 'OPEN_LICENSE',
      updatedFrom: '2026-03-01T00:00:00.000Z',
      updatedTo: '2026-03-20T00:00:00.000Z',
    });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              contentType: 'LISTING',
              listing: { consultationRouting: 'PLATFORM', listingTopicsJson: { array_contains: ['OPEN_LICENSE'] } },
            },
            { agents: { none: { active: true } } },
            {
              OR: [
                { listing: { title: { contains: 'buyer-keyword', mode: 'insensitive' } } },
                { buyer: { verifications: { some: { displayName: { contains: 'buyer-keyword', mode: 'insensitive' } } } } },
                { buyer: { nickname: { contains: 'buyer-keyword', mode: 'insensitive' } } },
              ],
            },
            { updatedAt: { gte: new Date('2026-03-01T00:00:00.000Z') } },
            { updatedAt: { lte: new Date('2026-03-20T00:00:00.000Z') } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('supports FIVE_STAR listingTopic filter for consultation channel', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    prisma.conversation.findMany.mockResolvedValueOnce([]);
    prisma.conversation.count.mockResolvedValueOnce(0);

    await service.listPlatformConversations(req, {
      channel: 'CONSULTATION',
      listingTopic: 'five_star',
    });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              contentType: 'LISTING',
              listing: { consultationRouting: 'PLATFORM', listingTopicsJson: { array_contains: ['FIVE_STAR'] } },
            },
          ],
        },
      }),
    );
  });

  it('uses exact UUID matching for id fields when q looks like UUID', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    prisma.conversation.findMany.mockResolvedValueOnce([]);
    prisma.conversation.count.mockResolvedValueOnce(0);

    const q = '11111111-1111-1111-1111-111111111111';
    await service.listPlatformConversations(req, { q });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { contentType: 'SUPPORT' },
                { contentType: 'DISPUTE' },
                { contentType: 'MAINTENANCE' },
                { contentType: 'ACHIEVEMENT' },
                { contentType: 'LISTING', listing: { consultationRouting: 'PLATFORM' } },
              ],
            },
            {
              OR: [
                { listing: { title: { contains: q, mode: 'insensitive' } } },
                { buyer: { verifications: { some: { displayName: { contains: q, mode: 'insensitive' } } } } },
                { buyer: { nickname: { contains: q, mode: 'insensitive' } } },
                { id: q },
                { contentId: q },
                { buyerUserId: q },
                { orderId: q },
              ],
            },
          ],
        },
      }),
    );
  });

  it('supports maintenance channel in platform conversation filters', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    prisma.conversation.findMany.mockResolvedValueOnce([]);
    prisma.conversation.count.mockResolvedValueOnce(0);

    await service.listPlatformConversations(req, { channel: 'MAINTENANCE' });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ contentType: 'MAINTENANCE' }],
        },
      }),
    );
  });

  it('keeps buyer nickname in platform inbox list (not overridden to brand)', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        contentType: 'LISTING',
        contentId: '22222222-2222-2222-2222-222222222222',
        listingId: '22222222-2222-2222-2222-222222222222',
        buyerUserId: 'buyer-1',
        sellerUserId: 'seller-platform',
        listing: {
          id: '22222222-2222-2222-2222-222222222222',
          title: '平台挂牌',
          consultationRouting: 'PLATFORM',
          source: 'ADMIN',
          listingTopicsJson: [],
        },
        buyer: { id: 'buyer-1', nickname: 'Buyer Nick', avatarUrl: null, role: 'buyer', verifications: [] },
        seller: { id: 'seller-platform', nickname: 'Ming', avatarUrl: null, role: 'seller', verifications: [] },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-1', text: 'hello', type: 'TEXT', createdAt: new Date('2026-03-14T01:10:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:10:00.000Z'),
        updatedAt: new Date('2026-03-14T01:10:00.000Z'),
        createdAt: new Date('2026-03-14T01:00:00.000Z'),
      },
    ]);
    prisma.conversation.count.mockResolvedValueOnce(1);
    prisma.conversationMessage.count.mockResolvedValueOnce(0);

    const result = await service.listPlatformConversations(req, { channel: 'CONSULTATION' });
    expect(result.items[0]?.counterpart?.nickname).toBe('Buyer Nick');
  });

  it('reorders platform conversation search results to prioritize strong counterpart and title matches', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        contentType: 'LISTING',
        contentId: '21111111-1111-1111-1111-111111111111',
        listingId: '21111111-1111-1111-1111-111111111111',
        buyerUserId: 'buyer-1',
        sellerUserId: 'seller-platform',
        listing: {
          id: '21111111-1111-1111-1111-111111111111',
          title: '华南高校专利许可',
          consultationRouting: 'PLATFORM',
          source: 'ADMIN',
          listingTopicsJson: [],
        },
        buyer: {
          id: 'buyer-1',
          nickname: '华南创新中心',
          avatarUrl: null,
          role: 'buyer',
          verifications: [],
        },
        seller: { id: 'seller-platform', nickname: 'Platform', avatarUrl: null, role: 'seller', verifications: [] },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-1', text: '请问报价', type: 'TEXT', createdAt: new Date('2026-03-14T01:10:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:10:00.000Z'),
        updatedAt: new Date('2026-03-14T01:10:00.000Z'),
        createdAt: new Date('2026-03-14T01:00:00.000Z'),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        contentType: 'LISTING',
        contentId: '32222222-2222-2222-2222-222222222222',
        listingId: '32222222-2222-2222-2222-222222222222',
        buyerUserId: 'buyer-2',
        sellerUserId: 'seller-platform',
        listing: {
          id: '32222222-2222-2222-2222-222222222222',
          title: '成果转化撮合',
          consultationRouting: 'PLATFORM',
          source: 'ADMIN',
          listingTopicsJson: [],
        },
        buyer: {
          id: 'buyer-2',
          nickname: '成果转化团队',
          avatarUrl: null,
          role: 'buyer',
          verifications: [{ displayName: '华南技术转移中心' }],
        },
        seller: { id: 'seller-platform', nickname: 'Platform', avatarUrl: null, role: 'seller', verifications: [] },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-2', text: '华南项目咨询', type: 'TEXT', createdAt: new Date('2026-03-14T01:11:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:11:00.000Z'),
        updatedAt: new Date('2026-03-14T01:11:00.000Z'),
        createdAt: new Date('2026-03-14T01:01:00.000Z'),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        contentType: 'SUPPORT',
        contentId: '43333333-3333-3333-3333-333333333333',
        listingId: null,
        buyerUserId: 'buyer-3',
        sellerUserId: 'seller-platform',
        listing: null,
        buyer: {
          id: 'buyer-3',
          nickname: '普通用户',
          avatarUrl: null,
          role: 'buyer',
          verifications: [],
        },
        seller: { id: 'seller-platform', nickname: 'Platform', avatarUrl: null, role: 'seller', verifications: [] },
        order: null,
        agents: [],
        participants: [{ lastReadAt: null }],
        messages: [{ id: 'm-3', text: '咨询华南业务', type: 'TEXT', createdAt: new Date('2026-03-14T01:12:00.000Z') }],
        lastMessageAt: new Date('2026-03-14T01:12:00.000Z'),
        updatedAt: new Date('2026-03-14T01:12:00.000Z'),
        createdAt: new Date('2026-03-14T01:02:00.000Z'),
      },
    ]);
    prisma.conversationMessage.count.mockResolvedValue(0);

    const result = await service.listPlatformConversations(req, { q: '华南', page: '1', pageSize: '20' });

    expect(result.items.map((item) => item.counterpart.displayName || item.contentTitle)).toEqual([
      '华南创新中心',
      '华南技术转移中心',
    ]);
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  it('rejects invalid platform conversation filters strictly', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };

    await expect(service.listPlatformConversations(req, { assigned: 'owner' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listPlatformConversations(req, { channel: 'chat' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listPlatformConversations(req, { mineOnly: 'maybe' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.listPlatformConversations(req, { listingTopic: 'foo' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.listPlatformConversations(req, { channel: 'SUPPORT', listingTopic: 'OPEN_LICENSE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listPlatformConversations(req, { channel: 'MAINTENANCE', listingTopic: 'OPEN_LICENSE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listPlatformConversations(req, { updatedFrom: 'bad-date' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.listPlatformConversations(req, {
        updatedFrom: '2026-03-20T00:00:00.000Z',
        updatedTo: '2026-03-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
