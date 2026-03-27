import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationsService } from '../src/modules/conversations/conversations.service';

describe('ConversationsService pagination and id strictness suite', () => {
  let prisma: any;
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
    service = new ConversationsService(prisma, events as any);
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
        buyer: true,
        seller: true,
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
          createdAt: '2026-03-14T01:05:00.000Z',
        },
        {
          id: 'm-1',
          conversationId: id,
          senderUserId: 'u-1',
          type: 'TEXT',
          text: 'hello',
          createdAt: '2026-03-14T01:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
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
          createdAt: '2026-03-14T01:08:00.000Z',
        },
        {
          id: newestId,
          conversationId,
          senderUserId: 'u-1',
          type: 'TEXT',
          text: 'newest',
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

    expect(prisma.conversation.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            contentType: 'LISTING',
            listing: { consultationRouting: 'PLATFORM', listingTopicsJson: { array_contains: ['OPEN_LICENSE'] } },
          },
          { agents: { none: { active: true } } },
          {
            OR: [
              { id: { contains: 'buyer-keyword', mode: 'insensitive' } },
              { contentId: { contains: 'buyer-keyword', mode: 'insensitive' } },
              { buyerUserId: { contains: 'buyer-keyword', mode: 'insensitive' } },
              { listing: { title: { contains: 'buyer-keyword', mode: 'insensitive' } } },
              { buyer: { nickname: { contains: 'buyer-keyword', mode: 'insensitive' } } },
              { orderId: { contains: 'buyer-keyword', mode: 'insensitive' } },
            ],
          },
          { updatedAt: { gte: new Date('2026-03-01T00:00:00.000Z') } },
          { updatedAt: { lte: new Date('2026-03-20T00:00:00.000Z') } },
        ],
      },
      include: {
        listing: true,
        order: { include: { listing: { select: { id: true, title: true } } } },
        buyer: true,
        seller: true,
        agents: { where: { active: true } },
        participants: {
          where: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
          select: { lastReadAt: true },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      skip: 20,
      take: 20,
    });
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
