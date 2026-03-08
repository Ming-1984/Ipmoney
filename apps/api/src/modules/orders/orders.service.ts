import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { MilestoneName, Prisma } from '@prisma/client';

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
import { isDemoPaymentEnabled } from '../../common/demo';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_CS_USER_ID = '00000000-0000-0000-0000-000000000002';
const REFUND_REASON_CODES = [
  'BUYER_CHANGED_MIND',
  'SELLER_MISSING_MATERIALS',
  'MUTUAL_AGREEMENT',
  'RISK_CONTROL',
  'OTHER',
] as const;
const REFUND_REASON_CODE_SET = new Set<string>(REFUND_REASON_CODES);
const ORDER_LIST_ROLES = ['BUYER', 'SELLER'] as const;
const ORDER_STATUSES = [
  'DEPOSIT_PENDING',
  'DEPOSIT_PAID',
  'WAIT_FINAL_PAYMENT',
  'FINAL_PAID_ESCROW',
  'READY_TO_SETTLE',
  'COMPLETED',
  'CANCELLED',
  'REFUNDING',
  'REFUNDED',
] as const;
const ORDER_STATUS_GROUPS = ['PAYMENT_PENDING', 'IN_PROGRESS', 'REFUND', 'DONE'] as const;
const INVOICE_STATUSES = ['WAIT_APPLY', 'APPLYING', 'ISSUED'] as const;

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

type FileObjectDto = {
  id: string;
  url: string;
  fileName?: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type OrderInvoiceDto = {
  orderId: string;
  amountFen: number;
  itemName: string;
  invoiceNo?: string | null;
  issuedAt?: string | null;
  invoiceFile: FileObjectDto;
  attachedAt?: string | null;
  updatedAt?: string | null;
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
    private readonly notifications: NotificationsService,
  ) {}

  private async notifyUser(userId: string | null | undefined, title: string, summary: string, source: string) {
    await this.notifications.create({ userId, title, summary, source });
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private normalizeOrderListRole(value: any): OrderListRole | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if ((ORDER_LIST_ROLES as readonly string[]).includes(raw)) return raw as OrderListRole;
    return undefined;
  }

  private normalizeOrderStatus(value: any): OrderStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if ((ORDER_STATUSES as readonly string[]).includes(raw)) return raw as OrderStatus;
    return undefined;
  }

  private normalizeOrderStatusGroup(value: any): (typeof ORDER_STATUS_GROUPS)[number] | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if ((ORDER_STATUS_GROUPS as readonly string[]).includes(raw)) return raw as (typeof ORDER_STATUS_GROUPS)[number];
    return undefined;
  }

  private normalizeInvoiceStatus(value: any): InvoiceStatus | undefined {
    const raw = String(value || '').trim().toUpperCase();
    if ((INVOICE_STATUSES as readonly string[]).includes(raw)) return raw as InvoiceStatus;
    return undefined;
  }

  private async getOrderWithListing(orderId: string) {
    return await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
  }

  private ensureOrderAccess(
    req: any,
    order: { buyerUserId?: string | null; listing?: { sellerUserId?: string | null } | null } | null,
    opts: { allowBuyer?: boolean; allowSeller?: boolean; allowAdmin?: boolean } = {},
  ) {
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    const allowBuyer = opts.allowBuyer !== false;
    const allowSeller = opts.allowSeller !== false;
    const allowAdmin = opts.allowAdmin !== false;
    if (allowAdmin && req?.auth?.isAdmin) return;
    if (allowBuyer && order.buyerUserId && req?.auth?.userId === order.buyerUserId) return;
    if (allowSeller && order.listing?.sellerUserId && req?.auth?.userId === order.listing.sellerUserId) return;
    throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
  }

  private async getOrderContext(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
    if (!order) return null;
    return {
      order,
      listingTitle: order.listing?.title || '交易订单',
      buyerUserId: order.buyerUserId,
      sellerUserId: order.listing?.sellerUserId,
    };
  }

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private getIdempotencyKey(req: any) {
    const raw = req?.headers?.['idempotency-key'];
    if (!raw) return '';
    return String(raw).trim();
  }

  private async withIdempotency<T>(req: any, scope: string, handler: () => Promise<T>): Promise<T> {
    const key = this.getIdempotencyKey(req);
    if (!key) return await handler();

    const userId = req?.auth?.userId ? String(req.auth.userId) : '';
    if (!userId) return await handler();

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_scope_userId: { key, scope, userId } },
    });
    if (existing) {
      if (existing.status === 'COMPLETED' && existing.responseJson != null) {
        return existing.responseJson as T;
      }
      throw new ConflictException({ code: 'CONFLICT', message: 'idempotency key already used' });
    }

    const record = await this.prisma.idempotencyKey.create({
      data: {
        key,
        scope,
        userId,
        status: 'IN_PROGRESS',
      },
    });

    try {
      const result = await handler();
      await this.prisma.idempotencyKey.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', responseJson: result as any },
      });
      return result;
    } catch (error) {
      await this.prisma.idempotencyKey.delete({ where: { id: record.id } });
      throw error;
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
    const data: Prisma.CsMilestoneCreateManyInput[] = [];
    if (!existingNames.has('CONTRACT_SIGNED')) {
      data.push({ caseId, name: MilestoneName.CONTRACT_SIGNED, status: 'PENDING' });
    }
    if (!existingNames.has('TRANSFER_SUBMITTED')) {
      data.push({ caseId, name: MilestoneName.TRANSFER_SUBMITTED, status: 'PENDING' });
    }
    if (!existingNames.has('TRANSFER_COMPLETED')) {
      data.push({ caseId, name: MilestoneName.TRANSFER_COMPLETED, status: 'PENDING' });
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
      const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      csCase = await this.prisma.csCase.create({
        data: {
          orderId: order.id,
          csUserId: assignedCsUserId,
          title: '订单跟单',
          type: 'FOLLOWUP',
          status: 'OPEN',
          dueAt,
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

  private parseOptionalDateTime(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined || value === null) return undefined;
    if (String(value).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private async getLatestDepositPaidAt(orderId: string): Promise<Date | null> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        payType: 'DEPOSIT',
        status: 'PAID',
        paidAt: { not: null },
      },
      orderBy: { paidAt: 'desc' },
    });
    return payment?.paidAt ?? null;
  }

  private async canAutoRefund(order: { id: string; status: string }, rules: TradeRulesConfig): Promise<boolean> {
    if (order.status !== 'DEPOSIT_PAID') return false;
    const windowMinutes = Math.max(0, Number(rules.autoRefundWindowMinutes || 0));
    if (!windowMinutes) return false;

    const paidAt = await this.getLatestDepositPaidAt(order.id);
    if (!paidAt) return false;
    const elapsedMs = Date.now() - paidAt.getTime();
    if (elapsedMs < 0 || elapsedMs > windowMinutes * 60 * 1000) return false;

    const followupCase = await this.prisma.csCase.findFirst({
      where: { orderId: order.id, type: 'FOLLOWUP' },
      orderBy: { createdAt: 'asc' },
    });
    if (followupCase && followupCase.status !== 'OPEN') return false;

    return true;
  }

  private toFileObject(file: any): FileObjectDto {
    return {
      id: file.id,
      url: file.url,
      fileName: file.fileName ?? null,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt.toISOString(),
    };
  }

  private async buildOrderInvoice(order: any, invoiceFile: any): Promise<OrderInvoiceDto> {
    const rules = await this.config.getTradeRules();
    const settlement = this.computeSettlementAmounts(
      { dealAmount: order.dealAmount, depositAmount: order.depositAmount, finalAmount: order.finalAmount },
      rules,
    );
    const amountFen = order.commissionAmount ?? settlement.commissionAmount;
    return {
      orderId: order.id,
      amountFen,
      itemName: '居间服务费',
      invoiceNo: order.invoiceNo ?? undefined,
      issuedAt: order.invoiceIssuedAt ? order.invoiceIssuedAt.toISOString() : undefined,
      invoiceFile: this.toFileObject(invoiceFile),
      attachedAt: invoiceFile?.createdAt ? invoiceFile.createdAt.toISOString() : undefined,
      updatedAt: order.updatedAt ? order.updatedAt.toISOString() : undefined,
    };
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
    const scope = `ORDER_CREATE:${listingId}`;
    return await this.withIdempotency(req, scope, async () => {
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
      await this.audit.log({
        actorUserId: req.auth.userId,
        action: 'ORDER_CREATE',
        targetType: 'ORDER',
        targetId: order.id,
        afterJson: { status: order.status, listingId, buyerUserId: order.buyerUserId },
      });
      const listingTitle = listing.title || '??';
      await this.notifyUser(
        order.buyerUserId,
        '??????',
        `?${listingTitle}???????????????????????`,
        '????',
      );
      await this.notifyUser(
        listing.sellerUserId,
        '??????',
        `??????${listingTitle}???????????????`,
        '????',
      );
      return this.toOrderDto(order, listing, listing.patent);
    });
  }


  async listOrders(req: any, query: any): Promise<PagedOrder> {
    this.ensureAuth(req);
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasAsRole = this.hasOwn(query, 'asRole');
    const hasStatus = this.hasOwn(query, 'status');
    const hasStatusGroup = this.hasOwn(query, 'statusGroup');
    const asRole = hasAsRole ? this.normalizeOrderListRole(query?.asRole) : 'BUYER';
    const status = hasStatus ? this.normalizeOrderStatus(query?.status) : undefined;
    const statusGroup = hasStatusGroup ? this.normalizeOrderStatusGroup(query?.statusGroup) : undefined;

    if (hasAsRole && !asRole) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'asRole is invalid' });
    }
    if (hasStatus && !status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }
    if (hasStatusGroup && !statusGroup) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'statusGroup is invalid' });
    }

    const where: any = {};
    if (status) {
      where.status = status;
    } else if (statusGroup) {
      const inStatuses =
        statusGroup === 'PAYMENT_PENDING'
          ? ['DEPOSIT_PENDING', 'WAIT_FINAL_PAYMENT']
          : statusGroup === 'IN_PROGRESS'
            ? ['DEPOSIT_PAID', 'FINAL_PAID_ESCROW', 'READY_TO_SETTLE']
            : statusGroup === 'REFUND'
              ? ['REFUNDING', 'REFUNDED']
              : statusGroup === 'DONE'
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
    if (!isDemoPaymentEnabled()) {
      throw new NotImplementedException({ code: 'NOT_IMPLEMENTED', message: 'demo payment disabled' });
    }
    this.ensureAuth(req);
    const hasPayType = !!body && Object.prototype.hasOwnProperty.call(body, 'payType');
    const payTypeRaw = hasPayType ? String(body?.payType || '').toUpperCase() : 'DEPOSIT';
    if (hasPayType && !['DEPOSIT', 'FINAL'].includes(payTypeRaw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'payType is invalid' });
    }
    const payType = payTypeRaw === 'FINAL' ? 'FINAL' : 'DEPOSIT';
    const scope = `PAYMENT_INTENT:${orderId}:${payType}`;
    return await this.withIdempotency(req, scope, async () => {
      let order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
      if (order.buyerUserId !== req.auth.userId) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
      }
      if (payType === 'DEPOSIT' && order.status !== 'DEPOSIT_PENDING') {
        throw new ConflictException({ code: 'CONFLICT', message: 'deposit payment not allowed in current status' });
      }
      if (payType === 'FINAL' && order.status !== 'WAIT_FINAL_PAYMENT') {
        throw new ConflictException({ code: 'CONFLICT', message: 'final payment not allowed in current status' });
      }
      if (payType === 'FINAL' && order.finalAmount == null && order.dealAmount != null) {
        const computedFinal = this.computeFinalAmount(order.dealAmount, order.depositAmount);
        order = await this.prisma.order.update({ where: { id: orderId }, data: { finalAmount: computedFinal } });
      }
      const amount = payType === 'FINAL' ? order.finalAmount ?? 0 : order.depositAmount;
      const existingPaid = await this.prisma.payment.findFirst({
        where: { orderId, payType, status: 'PAID' },
      });
      if (existingPaid) {
        throw new ConflictException({ code: 'CONFLICT', message: 'payment already completed' });
      }
      const existingPending = await this.prisma.payment.findFirst({
        where: { orderId, payType, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      const tradeNo = existingPending?.tradeNo || `demo-${orderId}-${Date.now()}`;
      const payment = existingPending
        ? await this.prisma.payment.update({
            where: { id: existingPending.id },
            data: {
              tradeNo,
              amount,
            },
          })
        : await this.prisma.payment.create({
            data: {
              orderId,
              payType,
              channel: 'WECHAT',
              tradeNo,
              amount,
              status: 'PENDING',
            },
          });
      await this.ensureCaseForOrder(order);

      return {
        paymentId: payment.id,
        payType,
        channel: 'WECHAT',
        amountFen: amount,
        wechatPayParams: {
          timeStamp: String(Math.floor(Date.now() / 1000)),
          nonceStr: `nonce-${payment.id.slice(0, 8)}`,
          package: `prepay_id=demo-${payment.id.slice(0, 8)}`,
          signType: 'RSA',
          paySign: 'demo-sign',
        },
      };
    });
  }

  async adminManualConfirmPayment(req: any, orderId: string, body: any) {
    this.ensureAdmin(req);
    const payType = String(body?.payType || '').toUpperCase();
    if (!['DEPOSIT', 'FINAL'].includes(payType)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'payType is required' });
    }

    let order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    if (payType === 'DEPOSIT' && order.status !== 'DEPOSIT_PENDING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'deposit payment not allowed in current status' });
    }
    if (payType === 'FINAL' && order.status !== 'WAIT_FINAL_PAYMENT') {
      throw new ConflictException({ code: 'CONFLICT', message: 'final payment not allowed in current status' });
    }
    if (payType === 'FINAL' && order.finalAmount == null && order.dealAmount != null) {
      const computedFinal = this.computeFinalAmount(order.dealAmount, order.depositAmount);
      order = await this.prisma.order.update({ where: { id: orderId }, data: { finalAmount: computedFinal } });
    }

    const normalizedPayType = payType === 'FINAL' ? 'FINAL' : 'DEPOSIT';
    const amount = payType === 'FINAL' ? order.finalAmount ?? 0 : order.depositAmount;
    const amountBody = body?.amountFen;
    if (typeof amountBody === 'number' && amountBody > 0 && amountBody !== amount) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'amount mismatch' });
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: { orderId, payType: normalizedPayType, status: { in: ['PENDING', 'PAID'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPayment?.status === 'PAID') {
      throw new ConflictException({ code: 'CONFLICT', message: 'payment already completed' });
    }

    const paidAt = this.parseOptionalDateTime(body?.paidAt, 'paidAt') ?? new Date();
    const tradeNo = String(body?.tradeNo || existingPayment?.tradeNo || `manual-${orderId}-${Date.now()}`);
    const payment = existingPayment
      ? await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: { status: 'PAID', paidAt, tradeNo, amount },
        })
      : await this.prisma.payment.create({
          data: {
            orderId,
            payType: normalizedPayType,
            channel: 'WECHAT',
            tradeNo,
            amount,
            status: 'PAID',
            paidAt,
          },
        });

    const targetStatus = payType === 'FINAL' ? 'FINAL_PAID_ESCROW' : 'DEPOSIT_PAID';
    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: targetStatus } });

    await this.audit.log({
      actorUserId: req.auth.userId,
      action: payType === 'FINAL' ? 'ORDER_FINAL_PAID' : 'ORDER_DEPOSIT_PAID',
      targetType: 'ORDER',
      targetId: updated.id,
      beforeJson: { status: order.status },
      afterJson: { status: updated.status, paymentId: payment.id, tradeNo, paidAt },
    });

    await this.ensureCaseForOrder(updated);
    const ctx = await this.getOrderContext(orderId);
    if (ctx) {
      const title = payType === 'FINAL' ? '尾款支付确认' : '订金支付确认';
      const summary =
        payType === 'FINAL'
          ? `《${ctx.listingTitle}》尾款已确认到账，平台将推进权属变更与结算。`
          : `《${ctx.listingTitle}》订金已确认到账，平台客服将介入跟单。`;
      await this.notifyUser(ctx.buyerUserId, title, summary, '交易通知');
      await this.notifyUser(ctx.sellerUserId, title, summary, '交易通知');
    }

    return {
      paymentId: payment.id,
      orderId,
      payType: normalizedPayType,
      status: payment.status,
      amountFen: amount,
      paidAt: payment.paidAt?.toISOString(),
      tradeNo: payment.tradeNo,
    };
  }


  async getCaseWithMilestones(req: any, orderId: string): Promise<CaseWithMilestones> {
    this.ensureAuth(req);
    const order = await this.getOrderWithListing(orderId);
    this.ensureOrderAccess(req, order);

    const csCase = await this.ensureCaseForOrder(order as any);

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
    const order = await this.getOrderWithListing(orderId);
    this.ensureOrderAccess(req, order);
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
    const scope = `REFUND_REQUEST:${orderId}`;
    return await this.withIdempotency(req, scope, async () => {
      const order = await this.getOrderWithListing(orderId);
      this.ensureOrderAccess(req, order, { allowSeller: false });
      if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
      if (!['DEPOSIT_PAID', 'WAIT_FINAL_PAYMENT', 'FINAL_PAID_ESCROW'].includes(order.status)) {
        throw new ConflictException({ code: 'CONFLICT', message: 'refund not allowed in current status' });
      }
      const existing = await this.prisma.refundRequest.findFirst({ where: { orderId, status: 'PENDING' } });
      if (existing) {
        throw new ConflictException({ code: 'CONFLICT', message: 'refund request already pending' });
      }
      const hasReasonCode = !!body && Object.prototype.hasOwnProperty.call(body, 'reasonCode');
      if (!hasReasonCode) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reasonCode is required' });
      }
      const reasonCode = String(body?.reasonCode || '').trim().toUpperCase();
      if (!REFUND_REASON_CODE_SET.has(reasonCode)) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reasonCode is invalid' });
      }
      const rules = await this.config.getTradeRules();
      const autoRefundEligible = await this.canAutoRefund(order, rules);

      const item = await this.prisma.refundRequest.create({
        data: {
          orderId,
          reasonCode,
          reasonText: body?.reasonText ? String(body.reasonText) : null,
        },
      });
      await this.audit.log({
        actorUserId: req.auth.userId,
        action: 'REFUND_REQUEST_CREATE',
        targetType: 'REFUND_REQUEST',
        targetId: item.id,
        afterJson: item,
      });

      const ctx = await this.getOrderContext(orderId);
      if (ctx) {
        await this.notifyUser(
          ctx.buyerUserId,
          '???????',
          `?${ctx.listingTitle}?????????????????`,
          '????',
        );
        await this.notifyUser(
          ctx.sellerUserId,
          '??????',
          `?${ctx.listingTitle}??????????????????`,
          '????',
        );
      }

      let currentItem = item;
      let orderStatus = order.status;
      if (autoRefundEligible) {
        const approved = await this.prisma.refundRequest.update({
          where: { id: item.id },
          data: { status: 'REFUNDING' },
        });
        await this.audit.log({
          actorUserId: req.auth.userId,
          action: 'REFUND_AUTO_APPROVE',
          targetType: 'REFUND_REQUEST',
          targetId: approved.id,
          beforeJson: { status: item.status },
          afterJson: { status: approved.status, autoRefund: true },
        });
        currentItem = approved;

        if (orderStatus !== 'REFUNDING') {
          const orderUpdated = await this.prisma.order.update({
            where: { id: order.id },
            data: { status: 'REFUNDING' },
          });
          await this.audit.log({
            actorUserId: req.auth.userId,
            action: 'ORDER_REFUNDING',
            targetType: 'ORDER',
            targetId: orderUpdated.id,
            beforeJson: { status: orderStatus },
            afterJson: { status: orderUpdated.status, autoRefund: true },
          });
          orderStatus = orderUpdated.status;
        }

        const completed = await this.prisma.refundRequest.update({
          where: { id: item.id },
          data: { status: 'REFUNDED' },
        });
        await this.audit.log({
          actorUserId: req.auth.userId,
          action: 'REFUND_COMPLETED',
          targetType: 'REFUND_REQUEST',
          targetId: completed.id,
          beforeJson: { status: approved.status },
          afterJson: { status: completed.status, autoRefund: true },
        });
        currentItem = completed;

        if (orderStatus !== 'REFUNDED') {
          const orderUpdated = await this.prisma.order.update({
            where: { id: order.id },
            data: { status: 'REFUNDED' },
          });
          await this.audit.log({
            actorUserId: req.auth.userId,
            action: 'ORDER_REFUNDED',
            targetType: 'ORDER',
            targetId: orderUpdated.id,
            beforeJson: { status: orderStatus },
            afterJson: { status: orderUpdated.status, autoRefund: true },
          });
        }

        if (ctx) {
          const title = '\u9000\u6b3e\u5df2\u5b8c\u6210';
          const summary = `\u300a${ctx.listingTitle}\u300b\u9000\u6b3e\u5df2\u5b8c\u6210\uff0c\u6b3e\u9879\u5c06\u6309\u539f\u8def\u9000\u56de\u3002`;
          await this.notifyUser(ctx.buyerUserId, title, summary, '\u9000\u6b3e\u901a\u77e5');
          await this.notifyUser(ctx.sellerUserId, title, summary, '\u9000\u6b3e\u901a\u77e5');
        }
      }

      return {
        id: currentItem.id,
        orderId: currentItem.orderId,
        reasonCode: currentItem.reasonCode,
        reasonText: currentItem.reasonText ?? undefined,
        status: currentItem.status,
        createdAt: currentItem.createdAt.toISOString(),
        updatedAt: currentItem.updatedAt?.toISOString(),
      };
    });
  }


  async adminApproveRefundRequest(req: any, refundRequestId: string): Promise<RefundRequestDto> {
    this.ensureAdmin(req);
    const existing = await this.prisma.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'refund request not found' });
    if (existing.status !== 'PENDING') {
      throw new ConflictException({ code: 'CONFLICT', message: 'refund request already processed' });
    }
    const order = await this.prisma.order.findUnique({ where: { id: existing.orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    if (!['DEPOSIT_PAID', 'WAIT_FINAL_PAYMENT', 'FINAL_PAID_ESCROW', 'REFUNDING'].includes(order.status)) {
      throw new ConflictException({ code: 'CONFLICT', message: 'refund not allowed in current status' });
    }
    const updated = await this.prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: { status: 'REFUNDING' },
    });
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'REFUND_APPROVE',
      targetType: 'REFUND_REQUEST',
      targetId: updated.id,
      beforeJson: existing,
      afterJson: updated,
    });
    if (order.status !== 'REFUNDING') {
      const orderUpdated = await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDING' },
      });
      await this.audit.log({
        actorUserId: req.auth.userId,
        action: 'ORDER_REFUNDING',
        targetType: 'ORDER',
        targetId: orderUpdated.id,
        beforeJson: { status: order.status },
        afterJson: { status: orderUpdated.status },
      });
    }
    const ctx = await this.getOrderContext(updated.orderId);
    if (ctx) {
      await this.notifyUser(
        ctx.buyerUserId,
        '退款申请已通过',
        `《${ctx.listingTitle}》退款申请已通过，后续退款将按流程处理。`,
        '退款通知',
      );
      await this.notifyUser(
        ctx.sellerUserId,
        '退款申请已通过',
        `《${ctx.listingTitle}》退款申请已通过，请留意后续处理结果。`,
        '退款通知',
      );
    }
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
    const ctx = await this.getOrderContext(updated.orderId);
    if (ctx) {
      await this.notifyUser(
        ctx.buyerUserId,
        '退款申请被驳回',
        `《${ctx.listingTitle}》退款申请未通过，原因：${reason}。`,
        '退款通知',
      );
      await this.notifyUser(
        ctx.sellerUserId,
        '退款申请被驳回',
        `《${ctx.listingTitle}》退款申请未通过，原因：${reason}。`,
        '退款通知',
      );
    }
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

  async adminCompleteRefundRequest(req: any, refundRequestId: string, body: any): Promise<RefundRequestDto> {
    this.ensureAdmin(req);
    const existing = await this.prisma.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'refund request not found' });
    if (!['REFUNDING', 'APPROVED', 'PENDING'].includes(existing.status)) {
      throw new ConflictException({ code: 'CONFLICT', message: 'refund request already completed' });
    }
    const order = await this.prisma.order.findUnique({ where: { id: existing.orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });

    const updatedRequest = await this.prisma.refundRequest.update({
      where: { id: existing.id },
      data: { status: 'REFUNDED' },
    });
    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'REFUND_COMPLETED',
      targetType: 'REFUND_REQUEST',
      targetId: updatedRequest.id,
      beforeJson: { status: existing.status },
      afterJson: { status: updatedRequest.status, remark: body?.remark },
    });

    if (order.status !== 'REFUNDED') {
      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' },
      });
      await this.audit.log({
        actorUserId: req.auth.userId,
        action: 'ORDER_REFUNDED',
        targetType: 'ORDER',
        targetId: updatedOrder.id,
        beforeJson: { status: order.status },
        afterJson: { status: updatedOrder.status },
      });
    }

    const ctx = await this.getOrderContext(updatedRequest.orderId);
    if (ctx) {
      const title = '退款已完成';
      const summary = `《${ctx.listingTitle}》退款已完成，款项将按原路退回。`;
      await this.notifyUser(ctx.buyerUserId, title, summary, '退款通知');
      await this.notifyUser(ctx.sellerUserId, title, summary, '退款通知');
    }

    return {
      id: updatedRequest.id,
      orderId: updatedRequest.orderId,
      reasonCode: updatedRequest.reasonCode,
      reasonText: updatedRequest.reasonText ?? undefined,
      status: updatedRequest.status,
      createdAt: updatedRequest.createdAt.toISOString(),
      updatedAt: updatedRequest.updatedAt?.toISOString(),
    };
  }

  async getOrderInvoice(req: any, orderId: string): Promise<OrderInvoiceDto> {
    this.ensureAuth(req);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true, invoiceFile: true },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    if (order.buyerUserId !== req.auth.userId && order.listing?.sellerUserId !== req.auth.userId && !req.auth.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
    if (!order.invoiceFileId || !order.invoiceFile) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'invoice not available' });
    }
    return await this.buildOrderInvoice(order, order.invoiceFile);
  }

  async requestInvoice(req: any, orderId: string) {
    this.ensureAuth(req);
    const scope = `INVOICE_REQUEST:${orderId}`;
    return await this.withIdempotency(req, scope, async () => {
      const order = await this.getOrderWithListing(orderId);
      this.ensureOrderAccess(req, order, { allowSeller: false });
      if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
      if (order.status !== 'COMPLETED') {
        throw new ConflictException({ code: 'CONFLICT', message: 'invoice request not allowed in current status' });
      }
      if (order.invoiceNo || order.invoiceIssuedAt) {
        throw new ConflictException({ code: 'CONFLICT', message: 'invoice already requested' });
      }
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: { invoiceNo: `REQ-${Date.now()}` },
      });
      await this.audit.log({
        actorUserId: req.auth.userId,
        action: 'INVOICE_REQUEST',
        targetType: 'ORDER',
        targetId: updated.id,
        afterJson: { invoiceNo: updated.invoiceNo },
      });
      const ctx = await this.getOrderContext(orderId);
      if (ctx) {
        await this.notifyUser(
          ctx.buyerUserId,
          '???????',
          `?${ctx.listingTitle}???????????????`,
          '????',
        );
      }
      return { orderId: updated.id, status: 'APPLYING' };
    });
  }


  async listInvoices(req: any, query: any) {
    this.ensureAuth(req);
    const hasPage = this.hasOwn(query, 'page');
    const hasPageSize = this.hasOwn(query, 'pageSize');
    const page = hasPage ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = hasPageSize ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const hasStatus = this.hasOwn(query, 'status');
    const status = hasStatus ? this.normalizeInvoiceStatus(query?.status) : undefined;
    if (hasStatus && !status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }

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
        include: { listing: { include: { patent: true } }, invoiceFile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    const rules = await this.config.getTradeRules();
    const mapped: InvoiceItem[] = items.map((it: any) => {
      const base = this.toOrderDto(it, it.listing, it.listing?.patent);
      const settlement = this.computeSettlementAmounts(
        { dealAmount: it.dealAmount, depositAmount: it.depositAmount, finalAmount: it.finalAmount },
        rules,
      );
      let invoiceStatus: InvoiceStatus = 'WAIT_APPLY';
      if (it.invoiceFileId) invoiceStatus = 'ISSUED';
      else if (it.invoiceNo) invoiceStatus = 'APPLYING';
      return {
        ...base,
        invoiceStatus,
        amountFen: it.commissionAmount ?? settlement.commissionAmount,
        itemName: '居间服务费',
        invoiceNo: it.invoiceNo ?? null,
        issuedAt: it.invoiceIssuedAt ? it.invoiceIssuedAt.toISOString() : null,
        invoiceFileUrl: it.invoiceFile?.url ?? null,
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
    const rawDealAmountFen = body?.dealAmountFen;
    if (rawDealAmountFen === undefined || rawDealAmountFen === null || String(rawDealAmountFen).trim() === '') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dealAmountFen is required' });
    }
    const dealAmountFen = typeof rawDealAmountFen === 'number' ? rawDealAmountFen : Number(rawDealAmountFen);
    if (!Number.isFinite(dealAmountFen) || !Number.isInteger(dealAmountFen) || dealAmountFen <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dealAmountFen is required' });
    }
    const remark = body?.remark ? String(body.remark).trim() : undefined;
    const signedAt = this.parseOptionalDateTime(body?.signedAt, 'signedAt');
    const evidenceFileId = body?.evidenceFileId ? String(body.evidenceFileId).trim() : undefined;
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    if (existing.status !== 'DEPOSIT_PAID') {
      throw new ConflictException({ code: 'CONFLICT', message: 'contract signed not allowed in current status' });
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
      afterJson: {
        status: order.status,
        dealAmount: order.dealAmount,
        finalAmount: order.finalAmount,
        signedAt: signedAt?.toISOString(),
        evidenceFileId,
        remark,
      },
    });
    const ctx = await this.getOrderContext(order.id);
    if (ctx) {
      await this.notifyUser(
        ctx.buyerUserId,
        '合同已确认',
        `《${ctx.listingTitle}》合同已确认，请尽快完成尾款支付。`,
        '交易通知',
      );
      await this.notifyUser(
        ctx.sellerUserId,
        '合同已确认',
        `《${ctx.listingTitle}》合同已确认，等待买家支付尾款。`,
        '交易通知',
      );
    }
    return this.toOrderDto(order);
  }

  async adminTransferCompleted(req: any, orderId: string, body: any) {
    this.ensureAdmin(req);
    const remark = body?.remark ? String(body.remark).trim() : undefined;
    const completedAt = this.parseOptionalDateTime(body?.completedAt, 'completedAt');
    const evidenceFileId = body?.evidenceFileId ? String(body.evidenceFileId).trim() : undefined;
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    if (existing.status !== 'FINAL_PAID_ESCROW') {
      throw new ConflictException({ code: 'CONFLICT', message: 'transfer completion not allowed in current status' });
    }
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
      afterJson: {
        status: order.status,
        completedAt: completedAt?.toISOString(),
        evidenceFileId,
        remark,
      },
    });
    const ctx = await this.getOrderContext(order.id);
    if (ctx) {
      await this.notifyUser(
        ctx.buyerUserId,
        '过户完成确认',
        `《${ctx.listingTitle}》过户已完成，平台将推进结算放款。`,
        '交易通知',
      );
      await this.notifyUser(
        ctx.sellerUserId,
        '过户完成确认',
        `《${ctx.listingTitle}》过户已完成，结算放款处理中。`,
        '交易通知',
      );
    }
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

  async adminManualPayout(req: any, orderId: string, body: any) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    if (order.status !== 'READY_TO_SETTLE') {
      throw new ConflictException({ code: 'CONFLICT', message: 'payout not allowed in current status' });
    }
    const payoutEvidenceFileId = body?.payoutEvidenceFileId ? String(body.payoutEvidenceFileId).trim() : '';
    if (!payoutEvidenceFileId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'payoutEvidenceFileId is required' });
    }
    const payoutEvidenceFile = await this.prisma.file.findUnique({ where: { id: payoutEvidenceFileId } });
    if (!payoutEvidenceFile) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'payout evidence file not found' });
    }
    const payoutRef = body?.payoutRef ? String(body.payoutRef).trim() : undefined;
    const payoutAt = this.parseOptionalDateTime(body?.payoutAt, 'payoutAt') ?? new Date();
    const remark = body?.remark ? String(body.remark).trim() : undefined;
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
        payoutRef,
        payoutEvidenceFileId,
        payoutAt,
        status: 'COMPLETED',
      },
      update: {
        grossAmount: settlementAmounts.grossAmount,
        commissionAmount: settlementAmounts.commissionAmount,
        payoutAmount: settlementAmounts.payoutAmount,
        payoutStatus: 'SUCCEEDED',
        payoutRef,
        payoutEvidenceFileId,
        payoutAt,
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
      afterJson: {
        status: settlement.status,
        payoutStatus: settlement.payoutStatus,
        payoutAmount: settlement.payoutAmount,
        payoutEvidenceFileId,
        payoutRef,
        payoutAt,
        remark,
      },
    });
    const ctx = await this.getOrderContext(orderId);
    if (ctx) {
      await this.notifyUser(
        ctx.sellerUserId,
        '结算放款完成',
        `《${ctx.listingTitle}》结算放款已完成，请注意到账信息。`,
        '交易通知',
      );
      await this.notifyUser(
        ctx.buyerUserId,
        '订单已完成',
        `《${ctx.listingTitle}》交易已完成，感谢您的使用。`,
        '交易通知',
      );
    }
    return settlement;
  }

  async adminIssueInvoice(req: any, orderId: string, _body: any) {
    this.ensureAdmin(req);
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    }
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
    const ctx = await this.getOrderContext(order.id);
    if (ctx) {
      await this.notifyUser(
        ctx.buyerUserId,
        '发票已开具',
        `《${ctx.listingTitle}》发票已开具，可在发票中心下载。`,
        '发票通知',
      );
    }
    return { orderId: order.id, invoiceNo: order.invoiceNo };
  }

  async adminUpsertOrderInvoice(req: any, orderId: string, body: any): Promise<OrderInvoiceDto> {
    this.ensureAdmin(req);
    const invoiceFileId = String(body?.invoiceFileId || '').trim();
    if (!invoiceFileId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invoiceFileId is required' });
    }

    const [order, file] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: orderId } }),
      this.prisma.file.findUnique({ where: { id: invoiceFileId } }),
    ]);
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });
    if (!file) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invoice file not found' });

    const invoiceNo = body?.invoiceNo ? String(body.invoiceNo).trim() : order.invoiceNo || `INV-${Date.now()}`;
    const issuedAt = this.parseOptionalDateTime(body?.issuedAt, 'issuedAt') ?? order.invoiceIssuedAt ?? new Date();

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { invoiceFileId, invoiceNo, invoiceIssuedAt: issuedAt },
      include: { invoiceFile: true },
    });

    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'INVOICE_UPSERT',
      targetType: 'ORDER',
      targetId: updated.id,
      afterJson: { invoiceFileId, invoiceNo, invoiceIssuedAt: issuedAt },
    });
    const ctx = await this.getOrderContext(updated.id);
    if (ctx) {
      await this.notifyUser(
        ctx.buyerUserId,
        '发票已更新',
        `《${ctx.listingTitle}》发票已更新，可在发票中心下载。`,
        '发票通知',
      );
    }

    return await this.buildOrderInvoice(updated, updated.invoiceFile ?? file);
  }

  async adminDeleteOrderInvoice(req: any, orderId: string) {
    this.ensureAdmin(req);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'order not found' });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { invoiceFileId: null, invoiceIssuedAt: null, invoiceNo: null },
    });

    await this.audit.log({
      actorUserId: req.auth.userId,
      action: 'INVOICE_DELETE',
      targetType: 'ORDER',
      targetId: orderId,
      afterJson: { invoiceFileId: null },
    });
    const ctx = await this.getOrderContext(orderId);
    if (ctx) {
      await this.notifyUser(
        ctx.buyerUserId,
        '发票已撤销',
        `《${ctx.listingTitle}》发票已撤销，如需重开请重新申请。`,
        '发票通知',
      );
    }
  }
}
