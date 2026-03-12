import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    await expect(service.listMine(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
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

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: '11111111-1111-1111-1111-111111111111',
      buyerUserId: 'u-2',
      sellerUserId: 'u-3',
    });
    await expect(service.listMessages(req, '11111111-1111-1111-1111-111111111111', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
