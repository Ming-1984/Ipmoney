import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationsController } from '../src/modules/conversations/conversations.controller';

const VALID_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('ConversationsController delegation suite', () => {
  let conversations: any;
  let controller: ConversationsController;

  beforeEach(() => {
    conversations = {
      listMine: vi.fn(),
      createListingConversation: vi.fn(),
      createDemandConversation: vi.fn(),
      createAchievementConversation: vi.fn(),
      createArtworkConversation: vi.fn(),
      createTechManagerConversation: vi.fn(),
      listMessages: vi.fn(),
      sendMessage: vi.fn(),
      markRead: vi.fn(),
    };
    controller = new ConversationsController(conversations);
  });

  it('delegates listMine with query', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    conversations.listMine.mockResolvedValueOnce({ items: [] });

    await expect(controller.listMine(req, { page: '1' })).resolves.toEqual({ items: [] });

    expect(conversations.listMine).toHaveBeenCalledWith(req, { page: '1' });
  });

  it('delegates all create conversation entry routes', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    conversations.createListingConversation.mockResolvedValue({ ok: true });
    conversations.createDemandConversation.mockResolvedValue({ ok: true });
    conversations.createAchievementConversation.mockResolvedValue({ ok: true });
    conversations.createArtworkConversation.mockResolvedValue({ ok: true });
    conversations.createTechManagerConversation.mockResolvedValue({ ok: true });

    await controller.createListingConversation(req, VALID_UUID);
    await controller.createDemandConversation(req, VALID_UUID);
    await controller.createAchievementConversation(req, VALID_UUID);
    await controller.createArtworkConversation(req, VALID_UUID);
    await controller.createTechManagerConversation(req, VALID_UUID);

    expect(conversations.createListingConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createDemandConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createAchievementConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createArtworkConversation).toHaveBeenCalledWith(req, VALID_UUID);
    expect(conversations.createTechManagerConversation).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates listMessages and markRead', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    conversations.listMessages.mockResolvedValueOnce({ items: [{ id: 'm-1' }] });
    conversations.markRead.mockResolvedValueOnce({ ok: true });

    await expect(controller.listMessages(req, VALID_UUID, { pageSize: '20' })).resolves.toEqual({
      items: [{ id: 'm-1' }],
    });
    await expect(controller.markRead(req, VALID_UUID)).resolves.toEqual({ ok: true });

    expect(conversations.listMessages).toHaveBeenCalledWith(req, VALID_UUID, { pageSize: '20' });
    expect(conversations.markRead).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates sendMessage with fallback empty body', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    conversations.sendMessage.mockResolvedValueOnce({ id: 'm-2' });

    await expect(controller.sendMessage(req, VALID_UUID, undefined as any)).resolves.toEqual({ id: 'm-2' });

    expect(conversations.sendMessage).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
