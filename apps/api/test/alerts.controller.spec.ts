import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertsController } from '../src/modules/alerts/alerts.controller';

const VALID_UUID = '77777777-7777-4777-8777-777777777777';

describe('AlertsController delegation suite', () => {
  let alerts: any;
  let controller: AlertsController;

  beforeEach(() => {
    alerts = {
      list: vi.fn(),
      acknowledge: vi.fn(),
    };
    controller = new AlertsController(alerts);
  });

  it('delegates list with query payload', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    const query = { page: '1', status: 'PENDING' };
    alerts.list.mockResolvedValueOnce({ items: [{ id: VALID_UUID }] });

    await expect(controller.list(req, query)).resolves.toEqual({ items: [{ id: VALID_UUID }] });

    expect(alerts.list).toHaveBeenCalledWith(req, query);
  });

  it('delegates list with fallback empty query object', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    alerts.list.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req, undefined as any)).resolves.toEqual({ items: [] });

    expect(alerts.list).toHaveBeenCalledWith(req, {});
  });

  it('delegates acknowledge with request and alertId', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    alerts.acknowledge.mockResolvedValueOnce({ id: VALID_UUID, status: 'ACKED' });

    await expect(controller.acknowledge(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID, status: 'ACKED' });

    expect(alerts.acknowledge).toHaveBeenCalledWith(req, VALID_UUID);
  });
});
