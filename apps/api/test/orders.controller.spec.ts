import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrdersController } from '../src/modules/orders/orders.controller';

const VALID_UUID = '66666666-6666-4666-8666-666666666666';

describe('OrdersController delegation suite', () => {
  let orders: any;
  let controller: OrdersController;

  beforeEach(() => {
    orders = {
      createOrder: vi.fn(),
      listAdminOrders: vi.fn(),
      listAssignedOrders: vi.fn(),
      getAdminOrderDetail: vi.fn(),
      getAssignedOrderDetail: vi.fn(),
      assignedContractSigned: vi.fn(),
      adminManualConfirmPayment: vi.fn(),
      adminContractSigned: vi.fn(),
      adminDeleteOrderInvoice: vi.fn(),
      adminRejectRefundRequest: vi.fn(),
      adminCompleteRefundRequest: vi.fn(),
      adminUpsertOrderInvoice: vi.fn(),
    };
    controller = new OrdersController(orders);
  });

  it('delegates createOrder with fallback empty body', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    orders.createOrder.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.createOrder(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });

    expect(orders.createOrder).toHaveBeenCalledWith(req, {});
  });

  it('rejects getAdminOrder when order.read permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['refund.read']) } };

    await expect(controller.getAdminOrder(req, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(orders.getAdminOrderDetail).not.toHaveBeenCalled();
  });

  it('delegates listAdminOrders when order.read permission is present', async () => {
    const req: any = { auth: { permissions: new Set(['order.read']) } };
    orders.listAdminOrders.mockResolvedValueOnce({ items: [] });

    await expect(controller.listAdminOrders(req, { page: '2' })).resolves.toEqual({ items: [] });

    expect(orders.listAdminOrders).toHaveBeenCalledWith(req, { page: '2' });
  });

  it('delegates assigned order list with assigned read permission', async () => {
    const req: any = { auth: { permissions: new Set(['order.assigned.read']) } };
    orders.listAssignedOrders.mockResolvedValueOnce({ items: [] });

    await expect(controller.listAssignedOrders(req, { statusGroup: 'in_progress' })).resolves.toEqual({ items: [] });

    expect(orders.listAssignedOrders).toHaveBeenCalledWith(req, { statusGroup: 'in_progress' });
  });

  it('allows broad order.read permission to use assigned order detail', async () => {
    const req: any = { auth: { permissions: new Set(['order.read']) } };
    orders.getAssignedOrderDetail.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.getAssignedOrder(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(orders.getAssignedOrderDetail).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('rejects assigned order detail when assigned read permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['conversation.platform.reply']) } };

    await expect(controller.getAssignedOrder(req, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(orders.getAssignedOrderDetail).not.toHaveBeenCalled();
  });

  it('delegates assignedContractSigned with assigned contract permission', async () => {
    const req: any = { auth: { permissions: new Set(['order.assigned.contract.confirm']) } };
    orders.assignedContractSigned.mockResolvedValueOnce({ id: VALID_UUID, status: 'WAIT_FINAL_PAYMENT' });

    await expect(controller.assignedContractSigned(req, VALID_UUID, null as any)).resolves.toEqual({
      id: VALID_UUID,
      status: 'WAIT_FINAL_PAYMENT',
    });

    expect(orders.assignedContractSigned).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('rejects assignedContractSigned when assigned contract permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['order.assigned.read']) } };

    await expect(controller.assignedContractSigned(req, VALID_UUID, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(orders.assignedContractSigned).not.toHaveBeenCalled();
  });

  it('allows broad contract milestone permission to use assignedContractSigned', async () => {
    const req: any = { auth: { permissions: new Set(['milestone.contractSigned.confirm']) } };
    orders.assignedContractSigned.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.assignedContractSigned(req, VALID_UUID, { dealAmountFen: 10000 })).resolves.toEqual({
      id: VALID_UUID,
    });

    expect(orders.assignedContractSigned).toHaveBeenCalledWith(req, VALID_UUID, { dealAmountFen: 10000 });
  });

  it('delegates adminManualPayment with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['payment.manual.confirm']) } };
    orders.adminManualConfirmPayment.mockResolvedValueOnce({ ok: true });

    await expect(controller.adminManualPayment(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(orders.adminManualConfirmPayment).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('rejects adminManualPayment when permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['order.read']) } };

    await expect(controller.adminManualPayment(req, VALID_UUID, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(orders.adminManualConfirmPayment).not.toHaveBeenCalled();
  });

  it('delegates adminUpsertInvoice with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['invoice.manage']) } };
    orders.adminUpsertOrderInvoice.mockResolvedValueOnce({ invoiceNo: 'INV-1' });

    await expect(controller.adminUpsertInvoice(req, VALID_UUID, undefined as any)).resolves.toEqual({
      invoiceNo: 'INV-1',
    });

    expect(orders.adminUpsertOrderInvoice).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates adminDeleteInvoice with invoice.manage permission', async () => {
    const req: any = { auth: { permissions: new Set(['invoice.manage']) } };
    orders.adminDeleteOrderInvoice.mockResolvedValueOnce(undefined);

    await expect(controller.adminDeleteInvoice(req, VALID_UUID)).resolves.toBeUndefined();

    expect(orders.adminDeleteOrderInvoice).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates adminRejectRefund with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['refund.reject']) } };
    orders.adminRejectRefundRequest.mockResolvedValueOnce({ status: 'REJECTED' });

    await expect(controller.adminRejectRefund(req, VALID_UUID, undefined as any)).resolves.toEqual({
      status: 'REJECTED',
    });

    expect(orders.adminRejectRefundRequest).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('rejects adminCompleteRefund when permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['refund.read']) } };

    await expect(controller.adminCompleteRefund(req, VALID_UUID, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(orders.adminCompleteRefundRequest).not.toHaveBeenCalled();
  });
});
