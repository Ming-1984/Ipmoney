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
  let contentSecurity: any;
  let service: ConversationsService;

  beforeEach(() => {
    prisma = {
      listing: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      patentMaintenanceOrder: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      csCase: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
      userVerification: {
        findFirst: vi.fn(),
      },
      achievement: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      conversation: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      conversationMessage: {
        create: vi.fn(),
        count: vi.fn(),
      },
      file: {
        findUnique: vi.fn(),
      },
      conversationAgent: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      conversationParticipant: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    events = { recordConsult: vi.fn().mockResolvedValue(undefined) };
    contentSecurity = { assertSafeText: vi.fn().mockResolvedValue(undefined) };
    service = new ConversationsService(prisma, events, contentSecurity);
    prisma.listing.findFirst.mockResolvedValue({
      id: LISTING_ID,
      title: 'Listing A',
      sellerUserId: 'seller-1',
    });
    prisma.achievement.findFirst.mockResolvedValue({
      id: LISTING_ID,
      title: 'Achievement A',
      publisherUserId: 'seller-1',
    });
  });

  it('requires auth for create/send/mark write endpoints', async () => {
    await expect(service.createListingConversation({}, LISTING_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createSupportConversation({})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createOrderDisputeConversation({}, LISTING_ID)).rejects.toBeInstanceOf(ForbiddenException);
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
    prisma.listing.findFirst.mockResolvedValueOnce(null);

    await expect(service.createListingConversation(req, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates listing conversation and records consult event when absent', async () => {
    const req = { auth: { userId: 'buyer-1' } };
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

  it('uses neutral fallback titles when source content lacks business title fields', async () => {
    const req = { auth: { userId: 'buyer-1' } };

    prisma.listing.findFirst.mockResolvedValueOnce({
      id: LISTING_ID,
      title: null,
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

    const listingResult = await service.createListingConversation(req, LISTING_ID);
    expect(listingResult.contentTitle).toBe('咨询内容');

    prisma.userVerification.findFirst.mockResolvedValueOnce({
      userId: TECH_MANAGER_ID,
      displayName: null,
      user: { nickname: null },
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

    const techManagerResult = await service.createTechManagerConversation(req, TECH_MANAGER_ID);
    expect(techManagerResult.contentTitle).toBe('技术经理人');
  });

  it('returns not found when achievement is not publicly visible', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.achievement.findFirst.mockResolvedValueOnce(null);

    await expect(service.createAchievementConversation(req, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates support conversation and writes default system greeting', async () => {
    const req = { auth: { userId: '11111111-1111-1111-1111-111111111111' } };
    const csUserId = '22222222-2222-2222-2222-222222222222';
    prisma.user.findFirst.mockResolvedValueOnce({ id: csUserId });
    prisma.conversation.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      contentId: req.auth.userId,
      listingId: null,
      orderId: null,
      buyerUserId: req.auth.userId,
      sellerUserId: csUserId,
      lastMessageAt: new Date('2026-03-13T00:01:00.000Z'),
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:01:00.000Z'),
    });
    prisma.conversation.create.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      contentId: req.auth.userId,
      listingId: null,
      orderId: null,
      buyerUserId: req.auth.userId,
      sellerUserId: csUserId,
      lastMessageAt: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.conversationMessage.create.mockResolvedValueOnce({ createdAt: new Date('2026-03-13T00:01:00.000Z') });
    prisma.conversation.update.mockResolvedValueOnce({});
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      contentId: req.auth.userId,
      listingId: null,
      orderId: null,
      buyerUserId: req.auth.userId,
      sellerUserId: csUserId,
      lastMessageAt: new Date('2026-03-13T00:01:00.000Z'),
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:01:00.000Z'),
    });

    const result = await service.createSupportConversation(req);

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        contentType: 'SUPPORT',
        contentId: req.auth.userId,
        buyerUserId: req.auth.userId,
        sellerUserId: csUserId,
      },
    });
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          senderUserId: csUserId,
          type: 'SYSTEM',
        }),
      }),
    );
    expect(result).toMatchObject({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      contentTitle: '平台客服',
    });
  });

  it('creates fallback cs user with platform support nickname instead of internal placeholder name', async () => {
    const req = { auth: { userId: '11111111-1111-1111-1111-111111111111' } };
    const csUserId = '22222222-2222-2222-2222-222222222222';
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.upsert.mockResolvedValueOnce({ id: csUserId });
    prisma.conversation.findFirst.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      contentId: req.auth.userId,
      listingId: null,
      orderId: null,
      buyerUserId: req.auth.userId,
      sellerUserId: csUserId,
      lastMessageAt: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    await service.createSupportConversation(req);

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ nickname: '平台客服' }),
        create: expect.objectContaining({ nickname: '平台客服' }),
      }),
    );
  });

  it('creates order dispute conversation and binds dispute case', async () => {
    const req = {
      auth: {
        userId: '11111111-1111-1111-1111-111111111111',
      },
    };
    const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const buyerUserId = req.auth.userId;
    const csUserId = '22222222-2222-2222-2222-222222222222';
    prisma.order.findUnique.mockResolvedValueOnce({
      id: orderId,
      listingId: LISTING_ID,
      buyerUserId,
      assignedCsUserId: csUserId,
      listing: { id: LISTING_ID, title: 'Listing A', sellerUserId: 'seller-1' },
    });
    prisma.conversation.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'DISPUTE',
      contentId: orderId,
      listingId: LISTING_ID,
      orderId,
      buyerUserId,
      sellerUserId: csUserId,
      lastMessageAt: new Date('2026-03-13T00:02:00.000Z'),
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:02:00.000Z'),
    });
    prisma.conversation.create.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'DISPUTE',
      contentId: orderId,
      listingId: LISTING_ID,
      orderId,
      buyerUserId,
      sellerUserId: csUserId,
      lastMessageAt: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.csCase.findFirst.mockResolvedValueOnce(null);
    prisma.csCase.create.mockResolvedValueOnce({ id: 'case-1' });
    prisma.conversationMessage.create.mockResolvedValueOnce({ createdAt: new Date('2026-03-13T00:02:00.000Z') });
    prisma.conversation.update.mockResolvedValueOnce({});
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'DISPUTE',
      contentId: orderId,
      listingId: LISTING_ID,
      orderId,
      buyerUserId,
      sellerUserId: csUserId,
      lastMessageAt: new Date('2026-03-13T00:02:00.000Z'),
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:02:00.000Z'),
    });

    const result = await service.createOrderDisputeConversation(req, orderId);

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        contentType: 'DISPUTE',
        contentId: orderId,
        listingId: LISTING_ID,
        orderId,
        buyerUserId,
        sellerUserId: csUserId,
      },
    });
    expect(prisma.csCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId,
          type: 'DISPUTE',
          csUserId: csUserId,
        }),
      }),
    );
    expect(result).toMatchObject({
      id: CONVERSATION_ID,
      contentType: 'DISPUTE',
      orderId,
    });
  });

  it('creates maintenance conversation and binds cs assignee when missing', async () => {
    const req = {
      auth: {
        userId: '11111111-1111-1111-1111-111111111111',
      },
    };
    const maintenanceOrderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const csUserId = '22222222-2222-2222-2222-222222222222';
    prisma.patentMaintenanceOrder.findUnique.mockResolvedValueOnce({
      id: maintenanceOrderId,
      applicantUserId: req.auth.userId,
      assignedCsUserId: null,
      schedule: {
        yearNo: 3,
        patent: {
          ownerUserId: req.auth.userId,
          title: 'Patent A',
        },
      },
    });
    prisma.user.findFirst.mockResolvedValueOnce({ id: csUserId });
    prisma.patentMaintenanceOrder.update.mockResolvedValueOnce({ id: maintenanceOrderId, assignedCsUserId: csUserId });
    prisma.conversation.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'MAINTENANCE',
      contentId: maintenanceOrderId,
      listingId: null,
      orderId: null,
      buyerUserId: req.auth.userId,
      sellerUserId: csUserId,
      lastMessageAt: new Date('2026-03-13T00:04:00.000Z'),
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:04:00.000Z'),
    });
    prisma.conversation.create.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'MAINTENANCE',
      contentId: maintenanceOrderId,
      listingId: null,
      orderId: null,
      buyerUserId: req.auth.userId,
      sellerUserId: csUserId,
      lastMessageAt: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.conversationMessage.create.mockResolvedValueOnce({ createdAt: new Date('2026-03-13T00:04:00.000Z') });
    prisma.conversation.update.mockResolvedValueOnce({});
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'MAINTENANCE',
      contentId: maintenanceOrderId,
      listingId: null,
      orderId: null,
      buyerUserId: req.auth.userId,
      sellerUserId: csUserId,
      lastMessageAt: new Date('2026-03-13T00:04:00.000Z'),
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:04:00.000Z'),
    });

    const result = await service.createMaintenanceConversation(req, maintenanceOrderId);

    expect(prisma.patentMaintenanceOrder.update).toHaveBeenCalledWith({
      where: { id: maintenanceOrderId },
      data: { assignedCsUserId: csUserId },
    });
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        contentType: 'MAINTENANCE',
        contentId: maintenanceOrderId,
        buyerUserId: req.auth.userId,
        sellerUserId: csUserId,
      },
    });
    expect(result).toMatchObject({
      id: CONVERSATION_ID,
      contentType: 'MAINTENANCE',
      contentId: maintenanceOrderId,
    });
  });

  it('sendMessage validates payload and participant boundary', async () => {
    const req = { auth: { userId: 'buyer-1' } };

    await expect(service.sendMessage(req, CONVERSATION_ID, { type: 'REFERENCE', text: 'x' })).rejects.toBeInstanceOf(
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
    prisma.conversationAgent.findFirst.mockResolvedValueOnce(null);
    await expect(service.sendMessage(req, CONVERSATION_ID, { type: 'TEXT', text: 'hello' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sendMessage persists normalized message and bumps conversation lastMessageAt', async () => {
    process.env.WECHAT_CONTENT_SECURITY_ENFORCE = '1';
    const req = { auth: { userId: 'buyer-1', wechatOpenid: 'openid-buyer-1' } };
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

    expect(contentSecurity.assertSafeText).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        openid: 'openid-buyer-1',
        requestMeta: expect.objectContaining({ actorUserId: 'buyer-1', targetId: CONVERSATION_ID }),
      }),
    );
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
    delete process.env.WECHAT_CONTENT_SECURITY_ENFORCE;
  });

  it('auto-assigns platform conversation to admin agent when replying', async () => {
    const req = {
      auth: {
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        isAdmin: true,
        permissions: new Set(['conversation.platform.manage']),
        wechatOpenid: null,
      },
    };
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
    prisma.conversationAgent.upsert.mockResolvedValueOnce({});
    prisma.conversationMessage.create.mockResolvedValueOnce({
      id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderUserId: req.auth.userId,
      type: 'TEXT',
      text: 'hello',
      createdAt: new Date('2026-03-13T01:00:00.000Z'),
    });
    prisma.conversation.update.mockResolvedValueOnce({});

    await service.sendMessage(req, CONVERSATION_ID, { text: 'hello' });

    expect(prisma.conversationAgent.upsert).toHaveBeenCalledWith({
      where: {
        conversationId_operatorUserId: {
          conversationId: CONVERSATION_ID,
          operatorUserId: req.auth.userId,
        },
      },
      create: {
        conversationId: CONVERSATION_ID,
        operatorUserId: req.auth.userId,
        assignedByUserId: req.auth.userId,
        active: true,
      },
      update: {
        assignedByUserId: req.auth.userId,
        active: true,
      },
    });
  });

  it('sendMessage persists owned file messages without text security check', async () => {
    const req = { auth: { userId: 'buyer-1', wechatOpenid: 'openid-buyer-1' } };
    const fileId = '55555555-5555-4555-8555-555555555555';
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
    prisma.file.findUnique.mockResolvedValueOnce({
      id: fileId,
      ownerId: 'buyer-1',
      fileName: 'contract.docx',
      mimeType: 'application/pdf',
      sizeBytes: 13517,
      url: `https://api.example.test/files/${fileId}`,
    });
    prisma.conversationMessage.create.mockResolvedValueOnce({
      id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderUserId: 'buyer-1',
      type: 'FILE',
      text: null,
      fileId,
      createdAt: new Date('2026-03-13T01:05:00.000Z'),
    });
    prisma.conversation.update.mockResolvedValueOnce({});

    const result = await service.sendMessage(req, CONVERSATION_ID, { type: 'FILE', fileId });

    expect(contentSecurity.assertSafeText).not.toHaveBeenCalled();
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: CONVERSATION_ID,
        senderUserId: 'buyer-1',
        type: 'FILE',
        text: null,
        fileId,
      },
    });
    expect(result).toMatchObject({
      id: MESSAGE_ID,
      type: 'FILE',
      fileId,
      fileUrl: 'https://api.example.test/uploads/contract.docx',
      fileName: 'contract.docx',
      mimeType: 'application/pdf',
      sizeBytes: 13517,
    });
  });

  it('sendMessage rejects file messages not owned by sender', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    const fileId = '55555555-5555-4555-8555-555555555555';
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
    prisma.file.findUnique.mockResolvedValueOnce({
      id: fileId,
      ownerId: 'buyer-2',
      mimeType: 'application/pdf',
    });

    await expect(service.sendMessage(req, CONVERSATION_ID, { type: 'FILE', fileId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.conversationMessage.create).not.toHaveBeenCalled();
  });

  it('markRead updates existing participant and creates new participant when absent', async () => {
    const req = { auth: { userId: 'buyer-1' } };

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
    prisma.conversationParticipant.findFirst.mockResolvedValueOnce({ id: 'participant-1' });
    const result1 = await service.markRead(req, CONVERSATION_ID);
    expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { lastReadAt: expect.any(Date) },
    });
    expect(result1).toEqual({ ok: true });

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
    prisma.conversationParticipant.findFirst.mockResolvedValueOnce(null);
    const result2 = await service.markRead(req, CONVERSATION_ID);
    expect(prisma.conversationParticipant.create).toHaveBeenCalledWith({
      data: { conversationId: CONVERSATION_ID, userId: 'buyer-1', lastReadAt: expect.any(Date) },
    });
    expect(result2).toEqual({ ok: true });
  });

  it('allows platform conversation managers to mark platform conversations as read', async () => {
    const req = {
      auth: {
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        isAdmin: true,
        permissions: new Set(['conversation.platform.manage']),
      },
    };

    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
    });
    prisma.conversationParticipant.findFirst.mockResolvedValueOnce(null);

    await expect(service.markRead(req, CONVERSATION_ID)).resolves.toEqual({ ok: true });
    expect(prisma.conversationAgent.findFirst).not.toHaveBeenCalled();
    expect(prisma.conversationParticipant.create).toHaveBeenCalledWith({
      data: {
        conversationId: CONVERSATION_ID,
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        lastReadAt: expect.any(Date),
      },
    });
  });

  it('assignPlatformAgent only allows staff users and persists active assignment', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    const operatorUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      listing: null,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: operatorUserId,
      role: 'cs',
      rbacRoles: [],
    });
    prisma.conversationAgent.upsert.mockResolvedValueOnce({
      id: 'agent-1',
      conversationId: CONVERSATION_ID,
      operatorUserId,
      active: true,
      assignedAt: new Date('2026-03-13T02:00:00.000Z'),
    });

    const result = await service.assignPlatformAgent(req, CONVERSATION_ID, { userId: operatorUserId });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: operatorUserId },
      select: {
        id: true,
        role: true,
        rbacRoles: {
          select: { roleId: true },
        },
      },
    });
    expect(prisma.conversationAgent.upsert).toHaveBeenCalledWith({
      where: {
        conversationId_operatorUserId: {
          conversationId: CONVERSATION_ID,
          operatorUserId,
        },
      },
      create: {
        conversationId: CONVERSATION_ID,
        operatorUserId,
        assignedByUserId: req.auth.userId,
        active: true,
      },
      update: {
        assignedByUserId: req.auth.userId,
        active: true,
      },
    });
    expect(result).toEqual({
      id: 'agent-1',
      conversationId: CONVERSATION_ID,
      userId: operatorUserId,
      active: true,
      assignedAt: '2026-03-13T02:00:00.000Z',
    });
  });

  it('assignPlatformAgent rejects non-staff users even when they exist', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    const operatorUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      listing: null,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: operatorUserId,
      role: 'user',
      rbacRoles: [],
    });

    await expect(service.assignPlatformAgent(req, CONVERSATION_ID, { userId: operatorUserId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.conversationAgent.upsert).not.toHaveBeenCalled();
  });

  it('removePlatformAgent deactivates existing assignment', async () => {
    const req = { auth: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    const operatorUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: CONVERSATION_ID,
      contentType: 'SUPPORT',
      listing: null,
    });
    prisma.conversationAgent.findUnique.mockResolvedValueOnce({
      id: 'agent-1',
      conversationId: CONVERSATION_ID,
      operatorUserId,
      active: true,
      assignedAt: new Date('2026-03-13T02:00:00.000Z'),
    });
    prisma.conversationAgent.update.mockResolvedValueOnce({
      id: 'agent-1',
      conversationId: CONVERSATION_ID,
      operatorUserId,
      active: false,
      assignedAt: new Date('2026-03-13T02:00:00.000Z'),
    });

    const result = await service.removePlatformAgent(req, CONVERSATION_ID, operatorUserId);

    expect(prisma.conversationAgent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { active: false, assignedByUserId: req.auth.userId },
    });
    expect(result).toEqual({
      id: 'agent-1',
      conversationId: CONVERSATION_ID,
      userId: operatorUserId,
      active: false,
      assignedAt: '2026-03-13T02:00:00.000Z',
    });
  });
});
