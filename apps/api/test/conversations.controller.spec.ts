import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationsController } from '../src/modules/conversations/conversations.controller';

const VALID_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('ConversationsController delegation suite', () => {
  let conversations: any;
  let controller: ConversationsController;

  beforeEach(() => {
    conversations = {
      listMine: vi.fn(),
      getMineConversation: vi.fn(),
      createListingConversation: vi.fn(),
      createAchievementConversation: vi.fn(),
      createTechManagerConversation: vi.fn(),
      createSupportConversation: vi.fn(),
      createOrderDisputeConversation: vi.fn(),
      createMaintenanceConversation: vi.fn(),
      listMessages: vi.fn(),
      sendMessage: vi.fn(),
      markRead: vi.fn(),
      listPlatformConversations: vi.fn(),
      assignPlatformAgent: vi.fn(),
      removePlatformAgent: vi.fn(),
    };
    controller = new ConversationsController(conversations);
  });

  it('delegates listMine with query', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    conversations.listMine.mockResolvedValueOnce({ items: [] });
    conversations.getMineConversation.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.listMine(req, { page: '1' })).resolves.toEqual({ items: [] });
    await expect(controller.getMineConversation(req, ` ${VALID_UUID} `)).resolves.toEqual({ id: VALID_UUID });

    expect(conversations.listMine).toHaveBeenCalledWith(req, { page: '1' });
    expect(conversations.getMineConversation).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates create conversation entry routes', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    conversations.createListingConversation.mockResolvedValue({ ok: true });
    conversations.createAchievementConversation.mockResolvedValue({ ok: true });
    conversations.createTechManagerConversation.mockResolvedValue({ ok: true });
    conversations.createSupportConversation.mockResolvedValue({ ok: true });
    conversations.createOrderDisputeConversation.mockResolvedValue({ ok: true });
    conversations.createMaintenanceConversation.mockResolvedValue({ ok: true });

    await controller.createListingConversation(req, VALID_UUID);
    await controller.createAchievementConversation(req, VALID_UUID);
    await controller.createTechManagerConversation(req, VALID_UUID);
    await controller.createSupportConversation(req);
    await controller.createOrderDisputeConversation(req, VALID_UUID);
    await controller.createMaintenanceConversation(req, VALID_UUID);

    expect(conversations.createListingConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createAchievementConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createTechManagerConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createSupportConversation).toHaveBeenCalledWith(req);
    expect(conversations.createOrderDisputeConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createMaintenanceConversation).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates listMessages/send/markRead with normalized UUID', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    conversations.listMessages.mockResolvedValueOnce({ items: [{ id: 'm-1' }] });
    conversations.sendMessage.mockResolvedValueOnce({ id: 'm-2' });
    conversations.markRead.mockResolvedValueOnce({ ok: true });

    await expect(controller.listMessages(req, ` ${VALID_UUID} `, { pageSize: '20' })).resolves.toEqual({
      items: [{ id: 'm-1' }],
    });
    await expect(controller.sendMessage(req, ` ${VALID_UUID} `, undefined as any)).resolves.toEqual({ id: 'm-2' });
    await expect(controller.markRead(req, ` ${VALID_UUID} `)).resolves.toEqual({ ok: true });

    expect(conversations.listMessages).toHaveBeenCalledWith(req, VALID_UUID, { pageSize: '20' });
    expect(conversations.sendMessage).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(conversations.markRead).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates admin platform conversation routes when permission exists', async () => {
    const req: any = { auth: { userId: 'admin-1', isAdmin: true, permissions: new Set(['conversation.platform.manage']) } };
    conversations.listPlatformConversations.mockResolvedValueOnce({ items: [] });
    conversations.assignPlatformAgent.mockResolvedValueOnce({ id: 'agent-1', userId: VALID_UUID, active: true });
    conversations.removePlatformAgent.mockResolvedValueOnce({ id: 'agent-1', userId: VALID_UUID, active: false });

    await expect(controller.listPlatformConversations(req, { mineOnly: 'true' })).resolves.toEqual({ items: [] });
    await expect(controller.assignPlatformAgent(req, ` ${VALID_UUID} `, { userId: VALID_UUID })).resolves.toMatchObject({
      userId: VALID_UUID,
      active: true,
    });
    await expect(controller.removePlatformAgent(req, ` ${VALID_UUID} `, ` ${VALID_UUID} `)).resolves.toMatchObject({
      userId: VALID_UUID,
      active: false,
    });

    expect(conversations.listPlatformConversations).toHaveBeenCalledWith(req, { mineOnly: 'true' });
    expect(conversations.assignPlatformAgent).toHaveBeenCalledWith(req, VALID_UUID, { userId: VALID_UUID });
    expect(conversations.removePlatformAgent).toHaveBeenCalledWith(req, VALID_UUID, VALID_UUID);
  });

  it('rejects admin platform routes without admin or permission', async () => {
    const nonAdminReq: any = { auth: { userId: 'u-1', isAdmin: false, permissions: new Set(['conversation.platform.manage']) } };
    const noPermReq: any = { auth: { userId: 'admin-1', isAdmin: true, permissions: new Set(['listing.read']) } };

    await expect(controller.listPlatformConversations(nonAdminReq, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.assignPlatformAgent(nonAdminReq, VALID_UUID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.removePlatformAgent(nonAdminReq, VALID_UUID, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    await expect(controller.listPlatformConversations(noPermReq, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.assignPlatformAgent(noPermReq, VALID_UUID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.removePlatformAgent(noPermReq, VALID_UUID, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects UUID-guarded routes when path params are invalid', async () => {
    const req: any = { auth: { userId: 'admin-1', isAdmin: true, permissions: new Set(['conversation.platform.manage']) } };
    await expect(controller.createListingConversation(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createAchievementConversation(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createTechManagerConversation(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createOrderDisputeConversation(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createMaintenanceConversation(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listMessages(req, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.sendMessage(req, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.markRead(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.assignPlatformAgent(req, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getMineConversation(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.removePlatformAgent(req, VALID_UUID, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
  });
});
