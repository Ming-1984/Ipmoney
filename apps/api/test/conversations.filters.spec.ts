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
      conversationMessage: {
        findMany: vi.fn(),
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
        OR: [{ buyerUserId: 'u-1' }, { sellerUserId: 'u-1' }],
      },
      include: { listing: true, buyer: true, seller: true },
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
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual({
      items: [
        {
          id: 'm-1',
          conversationId: id,
          senderUserId: 'u-1',
          type: 'TEXT',
          text: 'hello',
          createdAt: '2026-03-14T01:00:00.000Z',
        },
        {
          id: 'm-2',
          conversationId: id,
          senderUserId: 'u-2',
          type: 'EMOJI',
          text: undefined,
          createdAt: '2026-03-14T01:05:00.000Z',
        },
      ],
      nextCursor: null,
    });
  });
});
