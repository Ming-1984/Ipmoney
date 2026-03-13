import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationsService } from '../src/modules/conversations/conversations.service';

const LISTING_ID = '11111111-1111-1111-1111-111111111111';
const TECH_MANAGER_ID = '22222222-2222-2222-2222-222222222222';
const CONVERSATION_ID = '33333333-3333-3333-3333-333333333333';
const MESSAGE_ID = '44444444-4444-4444-4444-444444444444';

describe('ConversationsService write flow suite', () => {
  let prisma: any;
  let events: any;
  let service: ConversationsService;

  beforeEach(() => {
    prisma = {
      listing: {
        findUnique: vi.fn(),
      },
      userVerification: {
        findFirst: vi.fn(),
      },
      conversation: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      conversationMessage: {
        create: vi.fn(),
      },
      conversationParticipant: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    events = { recordConsult: vi.fn().mockResolvedValue(undefined) };
    service = new ConversationsService(prisma, events);
  });

  it('requires auth for create/send/mark write endpoints', async () => {
    await expect(service.createListingConversation({}, LISTING_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage({}, CONVERSATION_ID, { text: 'hi' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.markRead({}, CONVERSATION_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates listing contentId format before any db lookup', async () => {
    const req = { auth: { userId: 'buyer-1' } };

    await expect(service.createListingConversation(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.listing.findUnique).not.toHaveBeenCalled();
  });

  it('returns not found when listing does not exist', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.listing.findUnique.mockResolvedValueOnce(null);

    await expect(service.createListingConversation(req, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates listing conversation and records consult event when absent', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.listing.findUnique.mockResolvedValueOnce({
      id: LISTING_ID,
      title: 'Listing A',
      sellerUserId: 'seller-1',
    });
    prisma.conversation.findFirst.mockResolvedValueOnce(null);
    prisma.conversation.create.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'LISTING',
      contentId: LISTING_ID,
      listingId: LISTING_ID,
      orderId: null,
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
      lastMessageAt: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.createListingConversation(req, LISTING_ID);

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        contentType: 'LISTING',
        contentId: LISTING_ID,
        listingId: LISTING_ID,
        buyerUserId: 'buyer-1',
        sellerUserId: 'seller-1',
      },
    });
    expect(events.recordConsult).toHaveBeenCalledWith(req, 'LISTING', LISTING_ID);
    expect(result).toMatchObject({
      id: CONVERSATION_ID,
      contentType: 'LISTING',
      contentId: LISTING_ID,
      contentTitle: 'Listing A',
      listingId: LISTING_ID,
      listingTitle: 'Listing A',
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
  });

  it('reuses tech manager conversation and skips consult event tracking', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      userId: TECH_MANAGER_ID,
      displayName: 'Manager A',
      user: { nickname: 'Manager Nick' },
    });
    prisma.conversation.findFirst.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'TECH_MANAGER',
      contentId: TECH_MANAGER_ID,
      listingId: null,
      orderId: null,
      buyerUserId: 'buyer-1',
      sellerUserId: TECH_MANAGER_ID,
      lastMessageAt: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.createTechManagerConversation(req, TECH_MANAGER_ID);

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(events.recordConsult).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: CONVERSATION_ID,
      contentType: 'TECH_MANAGER',
      contentId: TECH_MANAGER_ID,
      contentTitle: 'Manager A',
      sellerUserId: TECH_MANAGER_ID,
    });
  });

  it('sendMessage validates payload and participant boundary', async () => {
    const req = { auth: { userId: 'buyer-1' } };

    await expect(service.sendMessage(req, CONVERSATION_ID, { type: 'FILE', text: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.sendMessage(req, CONVERSATION_ID, { text: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      buyerUserId: 'buyer-2',
      sellerUserId: 'seller-2',
    });
    await expect(service.sendMessage(req, CONVERSATION_ID, { type: 'TEXT', text: 'hello' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sendMessage persists normalized message and bumps conversation lastMessageAt', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
    prisma.conversationMessage.create.mockResolvedValueOnce({
      id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderUserId: 'buyer-1',
      type: 'TEXT',
      text: 'hello',
      createdAt: new Date('2026-03-13T01:00:00.000Z'),
    });
    prisma.conversation.update.mockResolvedValueOnce({});

    const result = await service.sendMessage(req, CONVERSATION_ID, { text: '  hello  ' });

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: CONVERSATION_ID,
        senderUserId: 'buyer-1',
        type: 'TEXT',
        text: 'hello',
      },
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: CONVERSATION_ID },
      data: { lastMessageAt: new Date('2026-03-13T01:00:00.000Z') },
    });
    expect(result).toEqual({
      id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderUserId: 'buyer-1',
      type: 'TEXT',
      text: 'hello',
      createdAt: '2026-03-13T01:00:00.000Z',
    });
  });

  it('markRead updates existing participant and creates new participant when absent', async () => {
    const req = { auth: { userId: 'buyer-1' } };

    prisma.conversationParticipant.findFirst.mockResolvedValueOnce({ id: 'participant-1' });
    const result1 = await service.markRead(req, CONVERSATION_ID);
    expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { lastReadAt: expect.any(Date) },
    });
    expect(result1).toEqual({ ok: true });

    prisma.conversationParticipant.findFirst.mockResolvedValueOnce(null);
    const result2 = await service.markRead(req, CONVERSATION_ID);
    expect(prisma.conversationParticipant.create).toHaveBeenCalledWith({
      data: { conversationId: CONVERSATION_ID, userId: 'buyer-1', lastReadAt: expect.any(Date) },
    });
    expect(result2).toEqual({ ok: true });
  });
});
