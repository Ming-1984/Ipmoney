import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WechatPayClient, WechatPayError } from '../../common/wechat-pay.client';
import { NotificationsService } from '../notifications/notifications.service';

const SYSTEM_ACTOR_USER_ID = '00000000-0000-0000-0000-000000000001';

type PayType = 'DEPOSIT' | 'FINAL';

type WebhookEvent = {
  eventType: string;
  orderId?: string;
  refundRequestId?: string;
  payType?: PayType | null;
  amountFen?: number;
  tradeNo?: string;
};

@Injectable()
export class WebhooksService {
  private readonly wechatPay = new WechatPayClient();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  private pickString(...values: Array<unknown>) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private extractUuid(value?: string) {
    if (!value) return undefined;
    const match = value.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return match ? match[0] : undefined;
  }

  private normalizePayType(value?: string): PayType | null {
    if (!value) return null;
    const normalized = String(value).toUpperCase();
    if (normalized.includes('FINAL')) return 'FINAL';
    if (normalized.includes('DEPOSIT')) return 'DEPOSIT';
    return null;
  }

  private normalizeEvent(body: any): WebhookEvent {
    const resource = body?.resource ?? {};
    const eventType =
      this.pickString(body?.eventType, body?.event_type, body?.type, body?.notify_type)?.toUpperCase() ?? '';

    const tradeNo = this.pickString(
      body?.tradeNo,
      body?.trade_no,
      body?.transaction_id,
      body?.out_trade_no,
      resource?.tradeNo,
      resource?.trade_no,
      resource?.transaction_id,
      resource?.out_trade_no,
    );

    const refundNo = this.pickString(body?.out_refund_no, resource?.out_refund_no);

    const orderId =
      this.pickString(body?.orderId, body?.order_id, resource?.orderId, resource?.order_id) ??
      this.extractUuid(this.pickString(body?.out_trade_no, resource?.out_trade_no, tradeNo));

    const refundRequestId =
      this.pickString(body?.refundRequestId, body?.refund_request_id, resource?.refundRequestId, resource?.refund_request_id) ??
      this.extractUuid(refundNo);

    const payType = this.normalizePayType(
      this.pickString(body?.payType, body?.pay_type, resource?.payType, resource?.pay_type, body?.trade_type),
    );

    const amountRaw = body?.amountFen ?? body?.amount ?? body?.total_amount ?? resource?.amount?.total ?? resource?.amount;
    const amountFen = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw || 0);

    return {
      eventType,
      orderId,
      refundRequestId,
      payType,
      amountFen: Number.isFinite(amountFen) ? amountFen : undefined,
      tradeNo,
    };
  }

  private getWebhookEventKey(body: any) {
    const eventId = this.pickString(
      body?.id,
      body?.event_id,
      body?.resource?.id,
      body?.resource?.event_id,
      body?.resource?.notify_id,
      body?.resource?.notification_id,
    );
    if (eventId) return eventId;
    const requestHash = this.computeRequestHash(body);
    return requestHash || undefined;
  }

  private computeRequestHash(body: any) {
    try {
      const payload = JSON.stringify(body ?? {});
      if (!payload) return undefined;
      return createHash('sha256').update(payload).digest('hex');
    } catch {
      return undefined;
    }
  }

  private async withWebhookDedup(req: any, body: any, handler: () => Promise<void>) {
    const key = this.getWebhookEventKey(body);
    if (!key) {
      await handler();
      return;
    }

    const userId = await this.ensureSystemActorId();
    const scope = 'WECHATPAY_NOTIFY';
    const requestHash = this.computeRequestHash(body);

    try {
      const record = await this.prisma.idempotencyKey.create({
        data: {
          key,
          scope,
          userId,
          status: 'IN_PROGRESS',
          requestHash,
        },
      });

      try {
        await handler();
        await this.prisma.idempotencyKey.update({
          where: { id: record.id },
          data: { status: 'COMPLETED' },
        });
      } catch (error) {
        await this.prisma.idempotencyKey.delete({ where: { id: record.id } });
        throw error;
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  private async upsertWebhookEvent(eventKey: string | undefined, event: WebhookEvent, body: any, status: 'RECEIVED' | 'PROCESSED' | 'FAILED') {
    if (!eventKey) return;
    const processedAt = status === 'PROCESSED' || status === 'FAILED' ? new Date() : undefined;
    const amount = typeof event.amountFen === 'number' ? event.amountFen : undefined;
    const eventType = event.eventType || undefined;

    await this.prisma.paymentWebhookEvent.upsert({
      where: { provider_eventId: { provider: 'WECHATPAY', eventId: eventKey } },
      update: {
        eventType,
        orderId: event.orderId || undefined,
        refundRequestId: event.refundRequestId || undefined,
        payType: event.payType ?? undefined,
        tradeNo: event.tradeNo || undefined,
        amount,
        status,
        payloadJson: body as any,
        processedAt,
      },
      create: {
        provider: 'WECHATPAY',
        eventId: eventKey,
        eventType,
        orderId: event.orderId || undefined,
        refundRequestId: event.refundRequestId || undefined,
        payType: event.payType ?? undefined,
        tradeNo: event.tradeNo || undefined,
        amount,
        status,
        payloadJson: body as any,
        processedAt,
      },
    });
  }

  private async ensureSystemActorId() {
    const actor = await this.prisma.user.upsert({
      where: { id: SYSTEM_ACTOR_USER_ID },
      update: { role: 'admin', nickname: 'System' },
      create: { id: SYSTEM_ACTOR_USER_ID, role: 'admin', nickname: 'System' },
    });
    return actor.id;
  }

  private async getOrderContext(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
    if (!order) return null;
    return {
      listingTitle: order.listing?.title || '交易订单',
      buyerUserId: order.buyerUserId,
      sellerUserId: order.listing?.sellerUserId,
    };
  }

  private async notifyUsers(userIds: Array<string | null | undefined>, title: string, summary: string) {
    await this.notifications.createMany({
      userIds,
      title,
      summary,
      source: '交易通知',
    });
  }

  private toRawBodyString(rawBody: string | Buffer | undefined): string {
    if (typeof rawBody === 'string') return rawBody;
    if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf8');
    return '';
  }

  private async prepareNotifyPayload(req: any, body: any, rawBody: string | Buffer | undefined) {
    if (!this.wechatPay.isWebhookVerificationEnabled()) return body;

    const raw = this.toRawBodyString(rawBody);
    if (!raw) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'wechatpay raw body is required for signature verification',
      });
    }

    try {
      await this.wechatPay.verifyNotifySignature(req?.headers, raw);
      const decryptedResource = this.wechatPay.decryptNotifyResource(body);
      if (!decryptedResource || typeof decryptedResource !== 'object') return body;
      return {
        ...body,
        resource: decryptedResource,
      };
    } catch (error) {
      if (error instanceof WechatPayError) {
        throw new BadRequestException({
          code: error.code,
          message: error.message,
          details: error.details,
        });
      }
      throw error;
    }
  }

  async handleWechatPayNotify(req: any, body: any, rawBody?: string | Buffer) {
    if (!body || typeof body !== 'object') return;
    const notifyPayload = await this.prepareNotifyPayload(req, body, rawBody);
    const event = this.normalizeEvent(notifyPayload);
    const eventKey = this.getWebhookEventKey(notifyPayload);

    await this.withWebhookDedup(req, notifyPayload, async () => {
      await this.upsertWebhookEvent(eventKey, event, notifyPayload, 'RECEIVED');
      try {
        const eventType = event.eventType;

        if (eventType.includes('REFUND')) {
          await this.handleRefundSuccess(req, event);
          await this.upsertWebhookEvent(eventKey, event, notifyPayload, 'PROCESSED');
          return;
        }
        if (eventType.includes('TRANSACTION') || eventType.includes('PAYMENT') || eventType.includes('PAY')) {
          await this.handlePaymentSuccess(req, event);
          await this.upsertWebhookEvent(eventKey, event, notifyPayload, 'PROCESSED');
          return;
        }
        if (event.refundRequestId) {
          await this.handleRefundSuccess(req, event);
          await this.upsertWebhookEvent(eventKey, event, notifyPayload, 'PROCESSED');
          return;
        }
        if (event.orderId) {
          await this.handlePaymentSuccess(req, event);
          await this.upsertWebhookEvent(eventKey, event, notifyPayload, 'PROCESSED');
          return;
        }
        await this.upsertWebhookEvent(eventKey, event, notifyPayload, 'PROCESSED');
      } catch (error) {
        await this.upsertWebhookEvent(eventKey, event, notifyPayload, 'FAILED');
        throw error;
      }
    });
  }

  private async handlePaymentSuccess(req: any, event: WebhookEvent) {
    const orderId = event.orderId;
    if (!orderId) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
    if (!order) return;

    let payType: PayType | null | undefined = event.payType;
    if (!payType) {
      if (order.status === 'DEPOSIT_PENDING') payType = 'DEPOSIT';
      if (order.status === 'WAIT_FINAL_PAYMENT') payType = 'FINAL';
    }
    if (!payType) return;

    const now = new Date();
    const amountFen =
      typeof event.amountFen === 'number'
        ? event.amountFen
        : payType === 'FINAL'
          ? order.finalAmount ?? 0
          : order.depositAmount;

    const tradeNo = event.tradeNo || `webhook-${orderId}-${now.getTime()}`;
    const existingPayment = await this.prisma.payment.findFirst({
      where: { orderId, payType, status: { in: ['PENDING', 'PAID'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingPayment) {
      await this.prisma.payment.create({
        data: {
          orderId,
          payType,
          channel: 'WECHAT',
          tradeNo,
          amount: amountFen,
          status: 'PAID',
          paidAt: now,
        },
      });
    } else if (existingPayment.status !== 'PAID') {
      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: 'PAID',
          paidAt: now,
          tradeNo,
          amount: amountFen,
        },
      });
    }

    const targetStatus = payType === 'DEPOSIT' ? 'DEPOSIT_PAID' : 'FINAL_PAID_ESCROW';
    if (order.status !== targetStatus) {
      const update: Record<string, any> = { status: targetStatus };
      if (payType === 'FINAL' && order.finalAmount == null && order.dealAmount != null) {
        update.finalAmount = Math.max(0, order.dealAmount - order.depositAmount);
      }
      const updated = await this.prisma.order.update({ where: { id: orderId }, data: update });

      const actorUserId = await this.ensureSystemActorId();
      await this.audit.log({
        actorUserId,
        action: payType === 'DEPOSIT' ? 'ORDER_DEPOSIT_PAID' : 'ORDER_FINAL_PAID',
        targetType: 'ORDER',
        targetId: updated.id,
        beforeJson: { status: order.status },
        afterJson: { status: updated.status },
        requestId: req?.headers?.['x-request-id'],
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      });

      const ctx = await this.getOrderContext(orderId);
      if (ctx) {
        const title = payType === 'DEPOSIT' ? 'Deposit payment succeeded' : 'Final payment succeeded';
        const summary =
          payType === 'DEPOSIT'
            ? `Order ${ctx.listingTitle} deposit was paid. CS follow-up has started.`
            : `Order ${ctx.listingTitle} final payment was paid. Waiting for transfer completion confirmation.`;
        await this.notifyUsers([ctx.buyerUserId, ctx.sellerUserId], title, summary);
      }
    }
  }

  private async handleRefundSuccess(req: any, event: WebhookEvent) {
    const refundRequestId = event.refundRequestId;
    let refundRequest = refundRequestId
      ? await this.prisma.refundRequest.findUnique({ where: { id: refundRequestId } })
      : null;

    if (!refundRequest && event.orderId) {
      refundRequest = await this.prisma.refundRequest.findFirst({
        where: { orderId: event.orderId, status: { in: ['REFUNDING', 'APPROVED', 'PENDING'] } },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!refundRequest) return;

    const order = await this.prisma.order.findUnique({
      where: { id: refundRequest.orderId },
      include: { listing: true },
    });
    if (!order) return;

    const actorUserId = await this.ensureSystemActorId();
    const requestId = req?.headers?.['x-request-id'];
    const ip = req?.ip;
    const userAgent = req?.headers?.['user-agent'];

    if (refundRequest.status !== 'REFUNDED') {
      const updatedRequest = await this.prisma.refundRequest.update({
        where: { id: refundRequest.id },
        data: { status: 'REFUNDED' },
      });
      await this.audit.log({
        actorUserId,
        action: 'REFUND_COMPLETED',
        targetType: 'REFUND_REQUEST',
        targetId: updatedRequest.id,
        beforeJson: { status: refundRequest.status },
        afterJson: { status: updatedRequest.status },
        requestId,
        ip,
        userAgent,
      });
    }

    if (order.status !== 'REFUNDED') {
      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' },
      });
      await this.audit.log({
        actorUserId,
        action: 'ORDER_REFUNDED',
        targetType: 'ORDER',
        targetId: updatedOrder.id,
        beforeJson: { status: order.status },
        afterJson: { status: updatedOrder.status },
        requestId,
        ip,
        userAgent,
      });
    }

    const ctx = await this.getOrderContext(order.id);
    if (ctx) {
      const title = 'Refund completed';
      const summary = `Order ${ctx.listingTitle} refund is completed and funds will be returned via the original payment path.`;
      await this.notifyUsers([ctx.buyerUserId, ctx.sellerUserId], title, summary);
    }
  }
}

