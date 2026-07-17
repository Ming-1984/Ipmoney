import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsNotificationsController } from '../src/modules/ops-notifications/ops-notifications.controller';

describe('OpsNotificationsController delegation suite', () => {
  let opsNotifications: any;
  let controller: OpsNotificationsController;

  beforeEach(() => {
    opsNotifications = {
      listJobs: vi.fn(),
      getJobById: vi.fn(),
    };
    controller = new OpsNotificationsController(opsNotifications);
  });

  it('delegates list when ops notification read permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['ops.notification.read']) } };
    const query = { status: 'SENT', page: '2' };
    opsNotifications.listJobs.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req, query)).resolves.toEqual({ items: [] });

    expect(opsNotifications.listJobs).toHaveBeenCalledWith(query);
  });

  it('delegates detail when wildcard permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['*']) } };
    opsNotifications.getJobById.mockResolvedValueOnce({ id: 'job-1' });

    await expect(controller.getById(req, 'job-1')).resolves.toEqual({ id: 'job-1' });

    expect(opsNotifications.getJobById).toHaveBeenCalledWith('job-1');
  });

  it('rejects list when permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['order.read']) } };

    await expect(controller.list(req, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(opsNotifications.listJobs).not.toHaveBeenCalled();
  });
});
