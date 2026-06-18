import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceMeController } from '../src/modules/patent-maintenance/patent-maintenance.me.controller';

describe('PatentMaintenanceMeController delegation suite', () => {
  let maintenance: any;
  let controller: PatentMaintenanceMeController;

  beforeEach(() => {
    maintenance = {
      listMySchedules: vi.fn(),
      listMyTasks: vi.fn(),
      listMyOrders: vi.fn(),
      getMySummary: vi.fn(),
      createMyOrder: vi.fn(),
      getMyOrder: vi.fn(),
      listMyOrderEvents: vi.fn(),
    };
    controller = new PatentMaintenanceMeController(maintenance);
  });

  it('delegates my schedules/tasks/orders with fallback', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    maintenance.listMySchedules.mockResolvedValueOnce({ items: [] });
    maintenance.listMyTasks.mockResolvedValueOnce({ items: [] });
    maintenance.listMyOrders.mockResolvedValueOnce({ items: [] });
    maintenance.getMySummary.mockResolvedValueOnce({ overdue: 1, dueSoon: 2, openTasks: 3, openOrders: 4 });
    maintenance.createMyOrder.mockResolvedValueOnce({ id: '11111111-1111-4111-8111-111111111111' });
    maintenance.getMyOrder.mockResolvedValueOnce({ id: '22222222-2222-4222-8222-222222222222' });
    maintenance.listMyOrderEvents.mockResolvedValueOnce({ items: [] });

    await expect(controller.listSchedules(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.listTasks(req, null as any)).resolves.toEqual({ items: [] });
    await expect(controller.listOrders(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.getSummary(req)).resolves.toEqual({ overdue: 1, dueSoon: 2, openTasks: 3, openOrders: 4 });
    await expect(controller.createOrder(req, undefined as any)).resolves.toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
    });
    await expect(controller.getOrder(req, '22222222-2222-4222-8222-222222222222')).resolves.toMatchObject({
      id: '22222222-2222-4222-8222-222222222222',
    });
    await expect(controller.listOrderEvents(req, '22222222-2222-4222-8222-222222222222')).resolves.toEqual({
      items: [],
    });

    expect(maintenance.listMySchedules).toHaveBeenCalledWith(req, {});
    expect(maintenance.listMyTasks).toHaveBeenCalledWith(req, {});
    expect(maintenance.listMyOrders).toHaveBeenCalledWith(req, {});
    expect(maintenance.getMySummary).toHaveBeenCalledWith(req);
    expect(maintenance.createMyOrder).toHaveBeenCalledWith(req, {});
    expect(maintenance.getMyOrder).toHaveBeenCalledWith(req, '22222222-2222-4222-8222-222222222222');
    expect(maintenance.listMyOrderEvents).toHaveBeenCalledWith(req, '22222222-2222-4222-8222-222222222222');
  });
});
