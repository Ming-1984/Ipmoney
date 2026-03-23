import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMaintenanceController } from '../src/modules/patent-maintenance/patent-maintenance.controller';

const VALID_UUID = '14141414-1414-4141-8141-141414141414';

describe('PatentMaintenanceController delegation suite', () => {
  let maintenance: any;
  let controller: PatentMaintenanceController;

  beforeEach(() => {
    maintenance = {
      listSchedules: vi.fn(),
      createSchedule: vi.fn(),
      getSchedule: vi.fn(),
      updateSchedule: vi.fn(),
      listTasks: vi.fn(),
      createTask: vi.fn(),
      updateTask: vi.fn(),
      listOrders: vi.fn(),
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      listOrderEvents: vi.fn(),
      quoteOrder: vi.fn(),
      confirmOrderPayment: vi.fn(),
      submitOrderExecution: vi.fn(),
      uploadOrderReceipt: vi.fn(),
      reconcileOrder: vi.fn(),
      closeOrder: vi.fn(),
      cancelOrder: vi.fn(),
    };
    controller = new PatentMaintenanceController(maintenance);
  });

  it('delegates schedule list/create/get/update with query/body fallback', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    maintenance.listSchedules.mockResolvedValueOnce({ items: [] });
    maintenance.createSchedule.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.getSchedule.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.updateSchedule.mockResolvedValueOnce({ ok: true });

    await expect(controller.listSchedules(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.createSchedule(req, null as any)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.getSchedule(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.updateSchedule(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });

    expect(maintenance.listSchedules).toHaveBeenCalledWith(req, {});
    expect(maintenance.createSchedule).toHaveBeenCalledWith(req, {});
    expect(maintenance.getSchedule).toHaveBeenCalledWith(req, VALID_UUID);
    expect(maintenance.updateSchedule).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates task list/create/update with query/body fallback', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    maintenance.listTasks.mockResolvedValueOnce({ items: [] });
    maintenance.createTask.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.updateTask.mockResolvedValueOnce({ ok: true });

    await expect(controller.listTasks(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.createTask(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.updateTask(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(maintenance.listTasks).toHaveBeenCalledWith(req, {});
    expect(maintenance.createTask).toHaveBeenCalledWith(req, {});
    expect(maintenance.updateTask).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates order lifecycle routes', async () => {
    const req: any = { auth: { userId: 'admin-1' } };
    maintenance.listOrders.mockResolvedValueOnce({ items: [] });
    maintenance.createOrder.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.getOrder.mockResolvedValueOnce({ id: VALID_UUID });
    maintenance.listOrderEvents.mockResolvedValueOnce({ items: [] });
    maintenance.quoteOrder.mockResolvedValueOnce({ id: VALID_UUID, status: 'AWAITING_PAYMENT' });
    maintenance.confirmOrderPayment.mockResolvedValueOnce({ id: VALID_UUID, status: 'PAID' });
    maintenance.submitOrderExecution.mockResolvedValueOnce({ id: VALID_UUID, status: 'EXECUTING' });
    maintenance.uploadOrderReceipt.mockResolvedValueOnce({ id: VALID_UUID, status: 'RECEIPT_UPLOADED' });
    maintenance.reconcileOrder.mockResolvedValueOnce({ id: VALID_UUID, status: 'RECONCILED' });
    maintenance.closeOrder.mockResolvedValueOnce({ id: VALID_UUID, status: 'CLOSED' });
    maintenance.cancelOrder.mockResolvedValueOnce({ id: VALID_UUID, status: 'CANCELLED' });

    await expect(controller.listOrders(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.createOrder(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.getOrder(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.listOrderEvents(req, VALID_UUID)).resolves.toEqual({ items: [] });
    await expect(controller.quoteOrder(req, VALID_UUID, undefined as any)).resolves.toMatchObject({
      status: 'AWAITING_PAYMENT',
    });
    await expect(controller.confirmOrderPayment(req, VALID_UUID, undefined as any)).resolves.toMatchObject({ status: 'PAID' });
    await expect(controller.submitOrderExecution(req, VALID_UUID, undefined as any)).resolves.toMatchObject({
      status: 'EXECUTING',
    });
    await expect(controller.uploadOrderReceipt(req, VALID_UUID, undefined as any)).resolves.toMatchObject({
      status: 'RECEIPT_UPLOADED',
    });
    await expect(controller.reconcileOrder(req, VALID_UUID, undefined as any)).resolves.toMatchObject({
      status: 'RECONCILED',
    });
    await expect(controller.closeOrder(req, VALID_UUID, undefined as any)).resolves.toMatchObject({ status: 'CLOSED' });
    await expect(controller.cancelOrder(req, VALID_UUID, undefined as any)).resolves.toMatchObject({
      status: 'CANCELLED',
    });

    expect(maintenance.listOrders).toHaveBeenCalledWith(req, {});
    expect(maintenance.createOrder).toHaveBeenCalledWith(req, {});
    expect(maintenance.getOrder).toHaveBeenCalledWith(req, VALID_UUID);
    expect(maintenance.listOrderEvents).toHaveBeenCalledWith(req, VALID_UUID);
    expect(maintenance.quoteOrder).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(maintenance.confirmOrderPayment).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(maintenance.submitOrderExecution).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(maintenance.uploadOrderReceipt).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(maintenance.reconcileOrder).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(maintenance.closeOrder).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(maintenance.cancelOrder).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
