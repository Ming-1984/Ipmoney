import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsController } from '../src/modules/notifications/notifications.controller';

const VALID_UUID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('NotificationsController delegation suite', () => {
  let notifications: any;
  let controller: NotificationsController;

  beforeEach(() => {
    notifications = {
      list: vi.fn(),
      getById: vi.fn(),
    };
    controller = new NotificationsController(notifications);
  });

  it('delegates list with request and query', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    notifications.list.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req, { page: '2' })).resolves.toEqual({ items: [] });

    expect(notifications.list).toHaveBeenCalledWith(req, { page: '2' });
  });

  it('delegates getById with request and notificationId', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    notifications.getById.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.getById(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(notifications.getById).toHaveBeenCalledWith(req, VALID_UUID);
  });
});
