import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

const AuditStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

const ListingStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  OFF_SHELF: 'OFF_SHELF',
  SOLD: 'SOLD',
} as const;

type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];
type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService, TradeRulesConfig } from '../config/config.service';

const DEFAULT_CS_USER_ID = '00000000-0000-0000-0000-000000000002';

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
  updatedAt?: string;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private async ensureDefaultCsUserId(): Promise<string> {
    const existing = await this.prisma.user.findFirst({
      where: { role: 'cs' },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing.id;

    const created = await this.prisma.user.upsert({
      where: { id: DEFAULT_CS_USER_ID },
      update: {
        role: 'cs',
        nickname: 'Default CS',
      },
      create: {
        id: DEFAULT_CS_USER_ID,
        role: 'cs',
        nickname: 'Default CS',
      },
    });
    return created.id;
  }

  private async ensureCaseMilestones(caseId: string) {
    const existing = await this.prisma.csMilestone.findMany({ where: { caseId } });
    const existingNames = new Set(existing.map((m: any) => m.name));
    const data = [];
    if (!existingNames.has('CONTRACT_SIGNED')) {
      data.push({ caseId, name: 'CONTRACT_SIGNED', status: 'PENDING' });
    }
    if (!existingNames.has('TRANSFER_SUBMITTED')) {
      data.push({ caseId, name: 'TRANSFER_SUBMITTED', status: 'PENDING' });
    }
    if (!existingNames.has('TRANSFER_COMPLETED')) {
      data.push({ caseId, name: 'TRANSFER_COMPLETED', status: 'PENDING' });
    }
    if (data.length > 0) {
      await this.prisma.csMilestone.createMany({ data });
    }
  }

  private async ensureCaseForOrder(order: { id: string; assignedCsUserId?: string | null }) {
    const assignedCsUserId = order.assignedCsUserId ?? (await this.ensureDefaultCsUserId());
    if (!order.assignedCsUserId) {
      await this.prisma.order.update({ where: { id: order.id }, data: { assignedCsUserId } });
    }

    let csCase = await this.prisma.csCase.findFirst({ where: { orderId: order.id, type: 'FOLLOWUP' } });
    if (!csCase) {
      csCase = await this.prisma.csCase.create({
        data: {
          orderId: order.id,
          csUserId: assignedCsUserId,
          type: 'FOLLOWUP',
          status: 'OPEN',
        },
      });
    } else if (csCase.csUserId !== assignedCsUserId) {
      csCase = await this.prisma.csCase.update({
        where: { id: csCase.id },
        data: { csUserId: assignedCsUserId },
      });
    }

    await this.ensureCaseMilestones(csCase.id);
    return csCase;
  }

  private async markCaseMilestone(caseId: string, name: 'CONTRACT_SIGNED' | 'TRANSFER_SUBMITTED' | 'TRANSFER_COMPLETED') {
    await this.prisma.csMilestone.updateMany({ where: { caseId, name }, data: { status: 'DONE' } });
  }

  private computeSettlementAmounts(
    order: { dealAmount?: number | null; depositAmount: number; finalAmount?: number | null },
    rules: TradeRulesConfig,
  ) {
    const grossAmount = order.dealAmount ?? order.depositAmount + (order.finalAmount ?? 0);
    if (!grossAmount || grossAmount <= 0) {
      return { grossAmount: grossAmount || 0, commissionAmount: 0, payoutAmount: Math.max(0, grossAmount || 0) };
    }

    const rawCommission = Math.round(grossAmount * rules.commissionRate);
    const commissionAmount = Math.min(Math.max(rawCommission, rules.commissionMinFen), rules.commissionMaxFen);
    const payoutAmount = Math.max(0, grossAmount - commissionAmount);
    return { grossAmount, commissionAmount, payoutAmount };
  }

  private computeFinalAmount(dealAmount: number, depositAmount: number) {
    return Math.max(0, dealAmount - depositAmount);
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
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listingId is required' });
    }
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { patent: true },
    });
    if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
    if (listing.auditStatus !== AuditStatus.APPROVED || listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'listing not available for trade' });
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
    const statusGroup = String(query?.statusGroup || '').trim();

    const where: any = {};
    if (status) {
      where.status = status;
    } else if (statusGroup) {
      const g = statusGroup.toUpperCase();
      const inStatuses =
        g === 'PAYMENT_PENDING'
          ? ['DEPOSIT_PENDING', 'WAIT_FINAL_PAYMENT']
          : g === 'IN_PROGRESS'
            ? ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW', 'READY_TO_SETTLE']
            : g === 'REFUND'
              ? ['REFUNDING', 'REFUNDED']
              : g === 'DONE'
                ? ['COMPLETED', 'CANCELLED']
                : [];
      if (inStatuses.length) where.status = { in: inStatuses };
    }

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
      items: items.map((it: any) => this.toOrderDto(it, it.listing)),
      page: { page, pageSize, total },
    };
  }

  async getOrderDetail(req: any, orderId: string): Promise<OrderDto> {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: { include: { patent: true } } },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    if (order.buyerUserId !== req.auth.userId && order.listing?.sellerUserId !== req.auth.userId && !req.auth.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    return this.toOrderDto(order, order.listing, order.listing?.patent);
  }

  async createPaymentIntent(req: any, orderId: string, body: { payType?: string }) {
    this.ensureAuth(req);
    let order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    if (order.buyerUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    const payType = String(body?.payType || 'DEPOSIT').toUpperCase();
    if (payType === 'FINAL' && order.finalAmount == null && order.dealAmount != null) {
      const computedFinal = this.computeFinalAmount(order.dealAmount, order.depositAmount);
      order = await this.prisma.order.update({ where: { id: orderId }, data: { finalAmount: computedFinal } });
    }
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
      const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: 'DEPOSIT_PAID' } });
      await this.ensureCaseForOrder(updated);
    } else if (payType === 'FINAL') {
      const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: 'FINAL_PAID_ESCROW' } });
      await this.ensureCaseForOrder(updated);
    }

    return { paymentId: payment.id };
  }

  async getCaseWithMilestones(req: any, orderId: string): Promise<CaseWithMilestones> {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });

    const csCase = await this.ensureCaseForOrder(order);

    const milestones = await this.prisma.csMilestone.findMany({ where: { caseId: csCase.id }, orderBy: { createdAt: 'asc' } });
    return {
      id: csCase.id,
      orderId,
      type: csCase.type,
      status: csCase.status,
      milestones: milestones.map((m: any) => ({
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
    return list.map((r: any) => ({
      id: r.id,
      orderId: r.orderId,
      reasonCode: r.reasonCode,
      reasonText: r.reasonText ?? undefined,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
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
      updatedAt: item.updatedAt?.toISOString(),
    };
  }

  async adminApproveRefundRequest(req: any, refundRequestId: string): Promise<RefundRequestDto> {
    this.ensureAdmin(req);
    const existing = await this.prisma.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'refund request not found' });
    if (existing.status !== 'PENDING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'refund request already processed' });
    }
    const updated = await this.prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: { status: 'APPROVED' },
    });
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'REFUND_APPROVE',
      targetType: 'REFUND_REQUEST',
      targetId: updated.id,
      beforeJson: existing,
      afterJson: updated,
    });
    return {
      id: updated.id,
      orderId: updated.orderId,
      reasonCode: updated.reasonCode,
      reasonText: updated.reasonText ?? undefined,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    };
  }

  async adminRejectRefundRequest(req: any, refundRequestId: string, body: any): Promise<RefundRequestDto> {
    this.ensureAdmin(req);
    const reason = String(body?.reason || '').trim();
    if (!reason) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason is required' });
    }
    const existing = await this.prisma.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'refund request not found' });
    if (existing.status !== 'PENDING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'refund request already processed' });
    }
    const updated = await this.prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: { status: 'REJECTED' },
    });
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'REFUND_REJECT',
      targetType: 'REFUND_REQUEST',
      targetId: updated.id,
      beforeJson: existing,
      afterJson: { ...updated, rejectReason: reason },
    });
    return {
      id: updated.id,
      orderId: updated.orderId,
      reasonCode: updated.reasonCode,
      reasonText: updated.reasonText ?? undefined,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    };
  }

  async getOrderInvoice(req: any, orderId: string): Promise<OrderInvoiceDto> {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
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

    const mapped: InvoiceItem[] = items.map((it: any) => {
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
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    return this.toOrderDto(order, order.listing);
  }

  async adminContractSigned(req: any, orderId: string, body: any) {
    this.ensureAdmin(req);
    const dealAmountFen = Number(body?.dealAmountFen || 0);
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    const finalAmountFen = this.computeFinalAmount(dealAmountFen || 0, existing.depositAmount);
    const rules = await this.config.getTradeRules();
    const settlementAmounts = this.computeSettlementAmounts(
      { dealAmount: dealAmountFen || 0, depositAmount: existing.depositAmount, finalAmount: finalAmountFen },
      rules,
    );
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        dealAmount: dealAmountFen || undefined,
        finalAmount: finalAmountFen,
        commissionAmount: settlementAmounts.commissionAmount,
        status: 'WAIT_FINAL_PAYMENT',
      },
    });
    const csCase = await this.ensureCaseForOrder(order);
    await this.markCaseMilestone(csCase.id, 'CONTRACT_SIGNED');
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ORDER_CONTRACT_SIGNED_CONFIRM',
      targetType: 'ORDER',
      targetId: order.id,
      afterJson: { status: order.status, dealAmount: order.dealAmount },
    });
    return this.toOrderDto(order);
  }

  async adminTransferCompleted(req: any, orderId: string, _body: any) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'READY_TO_SETTLE' },
    });
    const csCase = await this.ensureCaseForOrder(order);
    await this.markCaseMilestone(csCase.id, 'TRANSFER_COMPLETED');
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ORDER_TRANSFER_COMPLETED_CONFIRM',
      targetType: 'ORDER',
      targetId: order.id,
      afterJson: { status: order.status },
    });
    return this.toOrderDto(order);
  }

  async getSettlement(req: any, orderId: string) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    const rules = await this.config.getTradeRules();
    const settlementAmounts = this.computeSettlementAmounts(order, rules);
    const settlement = await this.prisma.settlement.upsert({
      where: { orderId },
      create: {
        orderId,
        grossAmount: settlementAmounts.grossAmount,
        commissionAmount: settlementAmounts.commissionAmount,
        payoutAmount: settlementAmounts.payoutAmount,
        payoutMethod: rules.payoutMethodDefault,
        payoutStatus: 'PENDING',
        status: 'PENDING',
      },
      update: {
        grossAmount: settlementAmounts.grossAmount,
        commissionAmount: settlementAmounts.commissionAmount,
        payoutAmount: settlementAmounts.payoutAmount,
      },
    });
    if (order.commissionAmount !== settlementAmounts.commissionAmount) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { commissionAmount: settlementAmounts.commissionAmount },
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    const rules = await this.config.getTradeRules();
    const settlementAmounts = this.computeSettlementAmounts(order, rules);
    const settlement = await this.prisma.settlement.upsert({
      where: { orderId },
      create: {
        orderId,
        grossAmount: settlementAmounts.grossAmount,
        commissionAmount: settlementAmounts.commissionAmount,
        payoutAmount: settlementAmounts.payoutAmount,
        payoutMethod: rules.payoutMethodDefault,
        payoutStatus: 'SUCCEEDED',
        payoutAt: new Date(),
        status: 'COMPLETED',
      },
      update: {
        grossAmount: settlementAmounts.grossAmount,
        commissionAmount: settlementAmounts.commissionAmount,
        payoutAmount: settlementAmounts.payoutAmount,
        payoutStatus: 'SUCCEEDED',
        payoutAt: new Date(),
        status: 'COMPLETED',
      },
    });
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED', commissionAmount: settlementAmounts.commissionAmount },
    });
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'SETTLEMENT_PAYOUT_MANUAL_CONFIRM',
      targetType: 'SETTLEMENT',
      targetId: settlement.id,
      afterJson: { status: settlement.status, payoutStatus: settlement.payoutStatus, payoutAmount: settlement.payoutAmount },
    });
    return settlement;
  }

  async adminIssueInvoice(req: any, orderId: string, _body: any) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { invoiceIssuedAt: new Date(), invoiceNo: `INV-${Date.now()}` },
    });
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'INVOICE_ISSUE',
      targetType: 'ORDER',
      targetId: order.id,
      afterJson: { invoiceNo: order.invoiceNo, invoiceIssuedAt: order.invoiceIssuedAt },
    });
    return { orderId: order.id, invoiceNo: order.invoiceNo };
  }
}
