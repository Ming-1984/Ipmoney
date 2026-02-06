import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditStatus, ListingStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

type OrderStatus =
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_PAID'
  | 'WAIT_FINAL_PAYMENT'
  | 'FINAL_PAID_ESCROW'
  | 'READY_TO_SETTLE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDING'
  | 'REFUNDED';

type OrderListRole = 'BUYER' | 'SELLER';

type OrderDto = {
  id: string;
  listingId?: string | null;
  buyerUserId?: string | null;
  sellerUserId?: string | null;
  status: OrderStatus;
  depositAmountFen: number;
  dealAmountFen?: number | null;
  finalAmountFen?: number | null;
  createdAt: string;
  updatedAt?: string;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
};

type PagedOrder = {
  items: OrderDto[];
  page: { page: number; pageSize: number; total: number };
};

type CaseWithMilestones = {
  id: string;
  orderId: string;
  type: string;
  status: string;
  milestones: Array<{ id: string; name: string; status: string; createdAt: string }>;
};

type RefundRequestDto = {
  id: string;
  orderId: string;
  reasonCode: string;
  reasonText?: string | null;
  status: string;
  createdAt: string;
};

type OrderInvoiceDto = {
  invoiceNo?: string | null;
  issuedAt?: string | null;
  invoiceFileUrl?: string | null;
};

type InvoiceStatus = 'WAIT_APPLY' | 'APPLYING' | 'ISSUED';
type InvoiceItem = OrderDto & {
  invoiceStatus: InvoiceStatus;
  amountFen?: number | null;
  itemName?: string | null;
  invoiceNo?: string | null;
  issuedAt?: string | null;
  invoiceFileUrl?: string | null;
  requestedAt?: string | null;
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private toOrderDto(order: any, listing?: any, patent?: any): OrderDto {
    const toIso = (d?: Date | null) => (d ? d.toISOString() : undefined);
    return {
      id: order.id,
      listingId: order.listingId,
      buyerUserId: order.buyerUserId,
      sellerUserId: listing?.sellerUserId ?? undefined,
      status: order.status as OrderStatus,
      depositAmountFen: order.depositAmount,
      dealAmountFen: order.dealAmount ?? undefined,
      finalAmountFen: order.finalAmount ?? undefined,
      createdAt: toIso(order.createdAt) || new Date().toISOString(),
      updatedAt: toIso(order.updatedAt),
      listingTitle: listing?.title ?? undefined,
      applicationNoDisplay: patent?.applicationNoDisplay ?? undefined,
    };
  }

  async createOrder(req: any, body: { listingId?: string; artworkId?: string }) {
    this.ensureAuth(req);
    const listingId = String(body?.listingId || '').trim();
    if (!listingId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listingId 必填' });
    }
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { patent: true },
    });
    if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: '挂牌不存在' });
    if (listing.auditStatus !== AuditStatus.APPROVED || listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: '挂牌不可交易' });
    }

    const order = await this.prisma.order.create({
      data: {
        listingId,
        buyerUserId: req.auth.userId,
        status: 'DEPOSIT_PENDING',
        depositAmount: listing.depositAmount,
      },
    });
    return this.toOrderDto(order, listing, listing.patent);
  }

  async listOrders(req: any, query: any): Promise<PagedOrder> {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const asRole = String(query?.asRole || 'BUYER').toUpperCase() as OrderListRole;
    const status = String(query?.status || '').trim();

    const where: any = {};
    if (status) where.status = status;

    if (asRole === 'SELLER') {
      where.listing = { sellerUserId: req.auth.userId };
    } else {
      where.buyerUserId = req.auth.userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { listing: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((it) => this.toOrderDto(it, it.listing)),
      page: { page, pageSize, total },
    };
  }

  async getOrderDetail(req: any, orderId: string): Promise<OrderDto> {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: { include: { patent: true } } },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });
    if (order.buyerUserId !== req.auth.userId && order.listing?.sellerUserId !== req.auth.userId && !req.auth.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    return this.toOrderDto(order, order.listing, order.listing?.patent);
  }

  async createPaymentIntent(req: any, orderId: string, body: { payType?: string }) {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });
    if (order.buyerUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const payType = String(body?.payType || 'DEPOSIT').toUpperCase();
    const amount = payType === 'FINAL' ? order.finalAmount ?? 0 : order.depositAmount;
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        payType: payType === 'FINAL' ? 'FINAL' : 'DEPOSIT',
        channel: 'WECHAT',
        tradeNo: `demo-${orderId}-${Date.now()}`,
        amount,
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    if (payType === 'DEPOSIT') {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'DEPOSIT_PAID' } });
    } else if (payType === 'FINAL') {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'FINAL_PAID_ESCROW' } });
    }

    return { paymentId: payment.id };
  }

  async getCaseWithMilestones(req: any, orderId: string): Promise<CaseWithMilestones> {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });

    let csCase = await this.prisma.csCase.findFirst({ where: { orderId } });
    if (!csCase) {
      csCase = await this.prisma.csCase.create({
        data: {
          orderId,
          csUserId: req.auth.userId,
          type: 'FOLLOWUP',
          status: 'OPEN',
        },
      });
      await this.prisma.csMilestone.createMany({
        data: [
          { caseId: csCase.id, name: 'CONTRACT_SIGNED', status: 'PENDING' },
          { caseId: csCase.id, name: 'TRANSFER_SUBMITTED', status: 'PENDING' },
          { caseId: csCase.id, name: 'TRANSFER_COMPLETED', status: 'PENDING' },
        ],
      });
    }

    const milestones = await this.prisma.csMilestone.findMany({ where: { caseId: csCase.id }, orderBy: { createdAt: 'asc' } });
    return {
      id: csCase.id,
      orderId,
      type: csCase.type,
      status: csCase.status,
      milestones: milestones.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async listRefundRequests(req: any, orderId: string): Promise<RefundRequestDto[]> {
    this.ensureAuth(req);
    const list = await this.prisma.refundRequest.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    return list.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      reasonCode: r.reasonCode,
      reasonText: r.reasonText ?? undefined,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createRefundRequest(req: any, orderId: string, body: any): Promise<RefundRequestDto> {
    this.ensureAuth(req);
    const reasonCode = String(body?.reasonCode || 'OTHER');
    const reasonText = body?.reasonText ? String(body.reasonText) : undefined;
    const item = await this.prisma.refundRequest.create({
      data: {
        orderId,
        reasonCode,
        reasonText,
        status: 'PENDING',
      },
    });
    return {
      id: item.id,
      orderId: item.orderId,
      reasonCode: item.reasonCode,
      reasonText: item.reasonText ?? undefined,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async getOrderInvoice(req: any, orderId: string): Promise<OrderInvoiceDto> {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });
    return {
      invoiceNo: order.invoiceNo ?? undefined,
      issuedAt: order.invoiceIssuedAt ? order.invoiceIssuedAt.toISOString() : undefined,
      invoiceFileUrl: null,
    };
  }

  async requestInvoice(req: any, orderId: string) {
    this.ensureAuth(req);
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { invoiceNo: `REQ-${Date.now()}` },
    });
    return { orderId: order.id, status: 'APPLYING' };
  }

  async listInvoices(req: any, query: any) {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const status = String(query?.status || '').trim().toUpperCase();

    const where: any = { buyerUserId: req.auth.userId };
    if (status === 'ISSUED') {
      where.invoiceIssuedAt = { not: null };
    } else if (status === 'APPLYING') {
      where.invoiceIssuedAt = null;
      where.invoiceNo = { not: null };
    } else if (status === 'WAIT_APPLY') {
      where.invoiceNo = null;
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { listing: { include: { patent: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    const mapped: InvoiceItem[] = items.map((it) => {
      const base = this.toOrderDto(it, it.listing, it.listing?.patent);
      let invoiceStatus: InvoiceStatus = 'WAIT_APPLY';
      if (it.invoiceIssuedAt) invoiceStatus = 'ISSUED';
      else if (it.invoiceNo) invoiceStatus = 'APPLYING';
      return {
        ...base,
        invoiceStatus,
        amountFen: it.dealAmount ?? it.depositAmount ?? 0,
        itemName: it.listing?.title ?? null,
        invoiceNo: it.invoiceNo ?? null,
        issuedAt: it.invoiceIssuedAt ? it.invoiceIssuedAt.toISOString() : null,
        invoiceFileUrl: null,
        requestedAt: it.invoiceNo ? it.updatedAt.toISOString() : null,
      };
    });

    return {
      items: mapped,
      page: { page, pageSize, total },
    };
  }

  async getAdminOrderDetail(req: any, orderId: string) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { listing: true } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });
    return this.toOrderDto(order, order.listing);
  }

  async adminContractSigned(req: any, orderId: string, body: any) {
    this.ensureAdmin(req);
    const dealAmountFen = Number(body?.dealAmountFen || 0);
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { dealAmount: dealAmountFen || undefined, status: 'WAIT_FINAL_PAYMENT' },
    });
    return this.toOrderDto(order);
  }

  async adminTransferCompleted(req: any, orderId: string, _body: any) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'READY_TO_SETTLE' },
    });
    return this.toOrderDto(order);
  }

  async getSettlement(req: any, orderId: string) {
    this.ensureAdmin(req);
    let settlement = await this.prisma.settlement.findUnique({ where: { orderId } });
    if (!settlement) {
      settlement = await this.prisma.settlement.create({
        data: {
          orderId,
          grossAmount: 0,
          commissionAmount: 0,
          payoutAmount: 0,
          payoutMethod: 'MANUAL',
          payoutStatus: 'PENDING',
          status: 'PENDING',
        },
      });
    }
    return {
      id: settlement.id,
      orderId: settlement.orderId,
      payoutStatus: settlement.payoutStatus,
      payoutAmountFen: settlement.payoutAmount,
      commissionAmountFen: settlement.commissionAmount,
      grossAmountFen: settlement.grossAmount,
    };
  }

  async adminManualPayout(req: any, orderId: string, _body: any) {
    this.ensureAdmin(req);
    const settlement = await this.prisma.settlement.upsert({
      where: { orderId },
      create: {
        orderId,
        grossAmount: 0,
        commissionAmount: 0,
        payoutAmount: 0,
        payoutMethod: 'MANUAL',
        payoutStatus: 'SUCCEEDED',
        payoutAt: new Date(),
        status: 'COMPLETED',
      },
      update: {
        payoutStatus: 'SUCCEEDED',
        payoutAt: new Date(),
        status: 'COMPLETED',
      },
    });
    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
    return settlement;
  }

  async adminIssueInvoice(req: any, orderId: string, _body: any) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { invoiceIssuedAt: new Date(), invoiceNo: `INV-${Date.now()}` },
    });
    return { orderId: order.id, invoiceNo: order.invoiceNo };
  }
}
