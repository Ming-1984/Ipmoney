import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';

import {
  PatentMaintenanceOrderEventType,
  PatentMaintenanceOrderStatus,
  PatentMaintenancePaymentChannel,
  PatentMaintenanceReconcileStatus,
  PatentMaintenanceStatus,
  PatentMaintenanceTaskStatus,
  PatentType,
  Prisma,
} from '@prisma/client';
import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeDisplayText } from '../content-utils';

const SCHEDULE_STATUS_SET = new Set<PatentMaintenanceStatus>(['DUE', 'PAID', 'OVERDUE', 'WAIVED']);
const TASK_STATUS_SET = new Set<PatentMaintenanceTaskStatus>(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
const ORDER_STATUS_SET = new Set<PatentMaintenanceOrderStatus>([
  'REQUESTED',
  'QUOTED',
  'AWAITING_PAYMENT',
  'PAID',
  'EXECUTING',
  'RECEIPT_UPLOADED',
  'RECONCILED',
  'CLOSED',
  'CANCELLED',
]);
const PAYMENT_CHANNEL_SET = new Set<PatentMaintenancePaymentChannel>(['WECHAT', 'OFFLINE_BANK', 'OFFLINE_OTHER']);
const RECONCILE_STATUS_SET = new Set<PatentMaintenanceReconcileStatus>(['PENDING', 'MATCHED', 'MISMATCHED']);
const PATENT_TYPE_SET = new Set<PatentType>(['INVENTION', 'UTILITY_MODEL', 'DESIGN']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLE_NAMES = new Set(['admin', 'operator', 'finance', 'cs']);
const OPEN_ORDER_STATUSES: PatentMaintenanceOrderStatus[] = [
  'REQUESTED',
  'QUOTED',
  'AWAITING_PAYMENT',
  'PAID',
  'EXECUTING',
  'RECEIPT_UPLOADED',
  'RECONCILED',
];
type MaintenanceUrgency = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'NORMAL' | 'SETTLED';
type MyMaintenanceSummaryDto = {
  overdue: number;
  dueSoon: number;
  openTasks: number;
  openOrders: number;
};

@Injectable()
export class PatentMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseNonNegativeIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseNullableNonEmptyStringStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return raw;
  }

  private parseRequiredNonEmptyString(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return raw;
  }

  private parsePatentTypeStrict(value: unknown, fieldName: string): PatentType {
    const normalized = String(value || '').trim().toUpperCase() as PatentType;
    if (!PATENT_TYPE_SET.has(normalized)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized;
  }

  private normalizeApplicationNo(value: unknown, fieldName: string) {
    const display = String(value ?? '').trim();
    if (!display) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    const normalized = display.toUpperCase().replace(/[\s.·\-_/]/g, '');
    if (!normalized || normalized.length < 6 || normalized.length > 40 || !/^[A-Z0-9]+$/.test(normalized)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return { applicationNoDisplay: display, applicationNoNorm: normalized };
  }

  private normalizeScheduleStatus(value: unknown): PatentMaintenanceStatus | undefined {
    const normalized = String(value || '').trim().toUpperCase() as PatentMaintenanceStatus;
    return SCHEDULE_STATUS_SET.has(normalized) ? normalized : undefined;
  }

  private normalizeTaskStatus(value: unknown): PatentMaintenanceTaskStatus | undefined {
    const normalized = String(value || '').trim().toUpperCase() as PatentMaintenanceTaskStatus;
    return TASK_STATUS_SET.has(normalized) ? normalized : undefined;
  }

  private normalizeOrderStatus(value: unknown): PatentMaintenanceOrderStatus | undefined {
    const normalized = String(value || '').trim().toUpperCase() as PatentMaintenanceOrderStatus;
    return ORDER_STATUS_SET.has(normalized) ? normalized : undefined;
  }

  private normalizePaymentChannel(value: unknown): PatentMaintenancePaymentChannel | undefined {
    const normalized = String(value || '').trim().toUpperCase() as PatentMaintenancePaymentChannel;
    return PAYMENT_CHANNEL_SET.has(normalized) ? normalized : undefined;
  }

  private normalizeReconcileStatus(value: unknown): PatentMaintenanceReconcileStatus | undefined {
    const normalized = String(value || '').trim().toUpperCase() as PatentMaintenanceReconcileStatus;
    return RECONCILE_STATUS_SET.has(normalized) ? normalized : undefined;
  }

  private parseScheduleStatusStrict(value: unknown, fieldName: string): PatentMaintenanceStatus {
    const normalized = this.normalizeScheduleStatus(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private parseTaskStatusStrict(value: unknown, fieldName: string): PatentMaintenanceTaskStatus {
    const normalized = this.normalizeTaskStatus(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private parseOrderStatusStrict(value: unknown, fieldName: string): PatentMaintenanceOrderStatus {
    const normalized = this.normalizeOrderStatus(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private parsePaymentChannelStrict(value: unknown, fieldName: string): PatentMaintenancePaymentChannel {
    const normalized = this.normalizePaymentChannel(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private parseReconcileStatusStrict(value: unknown, fieldName: string): PatentMaintenanceReconcileStatus {
    const normalized = this.normalizeReconcileStatus(value);
    if (!normalized) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    return normalized;
  }

  private parseDate(value: unknown, fieldName: string, strict = false) {
    if (value === undefined || value === null) return null;
    if (String(value).trim() === '') {
      if (strict) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
      return null;
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseDateTimeStrict(value: unknown, fieldName: string): Date {
    const raw = String(value ?? '').trim();
    if (!raw) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseUuidParam(value: unknown, fieldName: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private getIdempotencyKey(req: any) {
    const raw = req?.headers?.['idempotency-key'];
    if (!raw) return '';
    return String(raw).trim();
  }

  private hashPayload(input: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  private async withIdempotency<T>(req: any, scope: string, requestHash: string, handler: () => Promise<T>): Promise<T> {
    const key = this.getIdempotencyKey(req);
    if (!key) return await handler();
    const userId = req?.auth?.userId ? String(req.auth.userId) : '';
    if (!userId) return await handler();

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_scope_userId: { key, scope, userId } },
    });
    if (existing) {
      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new ConflictException({ code: 'CONFLICT', message: 'idempotency key reused with different payload' });
      }
      if (existing.status === 'COMPLETED' && existing.responseJson != null) {
        return existing.responseJson as T;
      }
      throw new ConflictException({ code: 'CONFLICT', message: 'idempotency key already used' });
    }

    let record;
    try {
      record = await this.prisma.idempotencyKey.create({
        data: { key, scope, userId, requestHash, status: 'IN_PROGRESS' },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'CONFLICT', message: 'idempotency key already used' });
      }
      throw error;
    }

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

  private parseNullableUuid(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    return this.parseUuidParam(value, fieldName);
  }

  private dateOnly(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private addYears(date: Date, years: number): Date {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }

  private advisoryLockParts(input: string): [number, number] {
    const digest = crypto.createHash('sha256').update(input).digest();
    return [digest.readInt32BE(0), digest.readInt32BE(4)];
  }

  private calcUrgency(status: PatentMaintenanceStatus, dueDate: Date): MaintenanceUrgency {
    if (status === 'PAID' || status === 'WAIVED') return 'SETTLED';
    const today = this.dateOnly(new Date());
    const due = this.dateOnly(dueDate);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'OVERDUE';
    if (diffDays <= 7) return 'DUE_SOON';
    if (diffDays <= 30) return 'UPCOMING';
    return 'NORMAL';
  }

  private toScheduleDto(item: any) {
    return {
      id: item.id,
      patentId: item.patentId,
      yearNo: item.yearNo,
      dueDate: item.dueDate.toISOString().slice(0, 10),
      gracePeriodEnd: item.gracePeriodEnd ? item.gracePeriodEnd.toISOString().slice(0, 10) : null,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : undefined,
    };
  }

  private toTaskDto(item: any) {
    const assignedCsDisplayName =
      normalizeDisplayText(item?.assignedCsUser?.verifications?.[0]?.displayName) ??
      normalizeDisplayText(item?.assignedCsUser?.nickname) ??
      null;
    return {
      id: item.id,
      scheduleId: item.scheduleId,
      assignedCsUserId: item.assignedCsUserId ?? undefined,
      assignedCsDisplayName,
      status: item.status,
      note: item.note ?? undefined,
      evidenceFileId: item.evidenceFileId ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : undefined,
    };
  }

  private toMyScheduleDto(item: any) {
    const urgency = this.calcUrgency(item.status as PatentMaintenanceStatus, item.dueDate);
    return {
      ...this.toScheduleDto(item),
      patentTitle: item?.patent?.title ?? undefined,
      applicationNoDisplay: item?.patent?.applicationNoDisplay ?? item?.patent?.applicationNoNorm ?? undefined,
      urgency,
      canContactSupport: urgency === 'OVERDUE' || urgency === 'DUE_SOON' || item.status === 'DUE' || item.status === 'OVERDUE',
    };
  }

  private toMyTaskDto(item: any) {
    const schedule = item?.schedule;
    const patent = schedule?.patent;
    const urgency = schedule ? this.calcUrgency(schedule.status as PatentMaintenanceStatus, schedule.dueDate) : 'NORMAL';
    return {
      ...this.toTaskDto(item),
      patentId: schedule?.patentId,
      patentTitle: patent?.title ?? undefined,
      applicationNoDisplay: patent?.applicationNoDisplay ?? patent?.applicationNoNorm ?? undefined,
      scheduleYearNo: schedule?.yearNo,
      scheduleDueDate: schedule?.dueDate ? schedule.dueDate.toISOString().slice(0, 10) : undefined,
      scheduleStatus: schedule?.status,
      urgency,
      canContactSupport: urgency === 'OVERDUE' || urgency === 'DUE_SOON' || item.status === 'OPEN' || item.status === 'IN_PROGRESS',
    };
  }

  private toOrderDto(item: any) {
    const schedule = item?.schedule;
    const patent = schedule?.patent;
    const applicantDisplayName =
      normalizeDisplayText(item?.applicantUser?.verifications?.[0]?.displayName) ??
      normalizeDisplayText(item?.applicantUser?.nickname) ??
      null;
    const assignedCsDisplayName =
      normalizeDisplayText(item?.assignedCsUser?.verifications?.[0]?.displayName) ??
      normalizeDisplayText(item?.assignedCsUser?.nickname) ??
      null;
    return {
      id: item.id,
      scheduleId: item.scheduleId,
      applicantUserId: item.applicantUserId,
      applicantDisplayName,
      assignedCsUserId: item.assignedCsUserId ?? undefined,
      assignedCsDisplayName,
      status: item.status,
      paymentChannel: item.paymentChannel ?? undefined,
      officialFeeFen: item.officialFeeFen,
      lateFeeFen: item.lateFeeFen,
      serviceFeeFen: item.serviceFeeFen,
      totalAmountFen: item.totalAmountFen,
      paymentDeadline: item.paymentDeadline ? item.paymentDeadline.toISOString() : undefined,
      paidAt: item.paidAt ? item.paidAt.toISOString() : undefined,
      executedAt: item.executedAt ? item.executedAt.toISOString() : undefined,
      receiptIssuedAt: item.receiptIssuedAt ? item.receiptIssuedAt.toISOString() : undefined,
      officialSubmissionNo: item.officialSubmissionNo ?? undefined,
      officialReceiptNo: item.officialReceiptNo ?? undefined,
      paymentTxnNo: item.paymentTxnNo ?? undefined,
      officialReceiptFileId: item.officialReceiptFileId ?? undefined,
      reconcileStatus: item.reconcileStatus,
      reconcileNote: item.reconcileNote ?? undefined,
      closeNote: item.closeNote ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : undefined,
      patentId: schedule?.patentId ?? undefined,
      scheduleYearNo: schedule?.yearNo ?? undefined,
      scheduleDueDate: schedule?.dueDate ? schedule.dueDate.toISOString().slice(0, 10) : undefined,
      patentTitle: patent?.title ?? undefined,
      applicationNoDisplay: patent?.applicationNoDisplay ?? patent?.applicationNoNorm ?? undefined,
      canContactSupport: item.status !== 'CLOSED' && item.status !== 'CANCELLED',
    };
  }

  private toOrderEventDto(item: any) {
    const actorDisplayName =
      normalizeDisplayText(item?.actorUser?.verifications?.[0]?.displayName) ??
      normalizeDisplayText(item?.actorUser?.nickname) ??
      null;
    return {
      id: item.id,
      orderId: item.orderId,
      actorUserId: item.actorUserId ?? undefined,
      actorDisplayName,
      actorNickname: item?.actorUser?.nickname ?? undefined,
      actorRole: item?.actorUser?.role ?? undefined,
      eventType: item.eventType,
      fromStatus: item.fromStatus ?? undefined,
      toStatus: item.toStatus,
      note: item.note ?? undefined,
      payloadJson: item.payloadJson ?? undefined,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private async assertUserExists(userId: string, fieldName: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private async assertStaffUserAssignable(userId: string, fieldName: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        rbacRoles: {
          select: { roleId: true },
        },
      },
    });
    if (!user) throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    const isStaff =
      STAFF_ROLE_NAMES.has(String(user.role || '').trim().toLowerCase()) ||
      (Array.isArray(user.rbacRoles) && user.rbacRoles.length > 0);
    if (!isStaff) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
  }

  private calcTotalAmount(officialFeeFen: number, lateFeeFen: number, serviceFeeFen: number): number {
    return officialFeeFen + lateFeeFen + serviceFeeFen;
  }

  private async appendOrderEvent(params: {
    orderId: string;
    actorUserId?: string | null;
    eventType: PatentMaintenanceOrderEventType;
    fromStatus?: PatentMaintenanceOrderStatus | null;
    toStatus: PatentMaintenanceOrderStatus;
    note?: string | null;
    payloadJson?: unknown;
  }, client: any = this.prisma) {
    return await client.patentMaintenanceOrderEvent.create({
      data: {
        orderId: params.orderId,
        actorUserId: params.actorUserId ?? null,
        eventType: params.eventType,
        fromStatus: params.fromStatus ?? null,
        toStatus: params.toStatus,
        note: params.note ?? null,
        payloadJson: params.payloadJson ?? Prisma.JsonNull,
      },
      include: {
        actorUser: {
          select: {
            id: true,
            nickname: true,
            role: true,
          },
        },
      },
    });
  }

  private async getOrderWithContext(orderId: string) {
    return await this.prisma.patentMaintenanceOrder.findUnique({
      where: { id: orderId },
      include: {
        applicantUser: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
        assignedCsUser: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
        schedule: {
          include: {
            patent: {
              select: {
                id: true,
                ownerUserId: true,
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
  }

  private assertMyOrderAccess(req: any, order: any) {
    if (order.applicantUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  async listSchedules(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: Prisma.PatentMaintenanceScheduleWhereInput = {};
    if (this.hasOwn(query, 'patentId')) {
      where.patentId = this.parseUuidParam(query?.patentId, 'patentId');
    }
    if (this.hasOwn(query, 'status')) {
      where.status = this.parseScheduleStatusStrict(query?.status, 'status');
    }

    const dueFrom = this.parseDate(query?.dueFrom, 'dueFrom', true);
    const dueTo = this.parseDate(query?.dueTo, 'dueTo', true);
    if (dueFrom || dueTo) {
      where.dueDate = {};
      if (dueFrom) where.dueDate.gte = dueFrom;
      if (dueTo) where.dueDate.lte = dueTo;
    }

    const [items, total] = await Promise.all([
      this.prisma.patentMaintenanceSchedule.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentMaintenanceSchedule.count({ where }),
    ]);

    return {
      items: items.map((item: any) => this.toScheduleDto(item)),
      page: { page, pageSize, total },
    };
  }

  async listMySchedules(req: any, query: any) {
    this.ensureAuth(req);

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: Prisma.PatentMaintenanceScheduleWhereInput = {
      patent: { ownerUserId: req.auth.userId },
    };
    if (this.hasOwn(query, 'patentId')) {
      where.patentId = this.parseUuidParam(query?.patentId, 'patentId');
    }
    if (this.hasOwn(query, 'status')) {
      where.status = this.parseScheduleStatusStrict(query?.status, 'status');
    }

    const dueFrom = this.parseDate(query?.dueFrom, 'dueFrom', true);
    const dueTo = this.parseDate(query?.dueTo, 'dueTo', true);
    if (dueFrom || dueTo) {
      where.dueDate = {};
      if (dueFrom) where.dueDate.gte = dueFrom;
      if (dueTo) where.dueDate.lte = dueTo;
    }

    const [items, total] = await Promise.all([
      this.prisma.patentMaintenanceSchedule.findMany({
        where,
        include: {
          patent: {
            select: {
              title: true,
              applicationNoDisplay: true,
              applicationNoNorm: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentMaintenanceSchedule.count({ where }),
    ]);

    return {
      items: items.map((item: any) => this.toMyScheduleDto(item)),
      page: { page, pageSize, total },
    };
  }

  async getMySummary(req: any): Promise<MyMaintenanceSummaryDto> {
    this.ensureAuth(req);
    const ownerUserId = this.parseUuidParam(req?.auth?.userId, 'userId');
    const today = this.dateOnly(new Date());
    const dueSoonEnd = new Date(today);
    dueSoonEnd.setDate(dueSoonEnd.getDate() + 7);

    const [overdue, dueSoon, openTasks, openOrders] = await Promise.all([
      this.prisma.patentMaintenanceSchedule.count({
        where: {
          patent: { ownerUserId },
          status: { in: ['DUE', 'OVERDUE'] },
          dueDate: { lt: today },
        },
      }),
      this.prisma.patentMaintenanceSchedule.count({
        where: {
          patent: { ownerUserId },
          status: { in: ['DUE', 'OVERDUE'] },
          dueDate: { gte: today, lte: dueSoonEnd },
        },
      }),
      this.prisma.patentMaintenanceTask.count({
        where: {
          schedule: { patent: { ownerUserId } },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.patentMaintenanceOrder.count({
        where: {
          applicantUserId: ownerUserId,
          status: { in: OPEN_ORDER_STATUSES },
        },
      }),
    ]);

    return { overdue, dueSoon, openTasks, openOrders };
  }

  async createSchedule(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const patentId = this.parseUuidParam(body?.patentId, 'patentId');
    const yearNo = this.parsePositiveIntStrict(body?.yearNo, 'yearNo');
    const dueDate = this.parseDate(body?.dueDate, 'dueDate', true);
    if (!dueDate) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dueDate is required' });
    const gracePeriodEnd = this.parseDate(body?.gracePeriodEnd, 'gracePeriodEnd', true);
    const status = this.hasOwn(body, 'status')
      ? this.parseScheduleStatusStrict(body?.status, 'status')
      : PatentMaintenanceStatus.DUE;

    const patent = await this.prisma.patent.findUnique({ where: { id: patentId }, select: { id: true } });
    if (!patent) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Patent not found' });

    const created = await (async () => {
      try {
        return await this.prisma.patentMaintenanceSchedule.create({
          data: {
            patentId,
            yearNo,
            dueDate,
            gracePeriodEnd: gracePeriodEnd || null,
            status,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Schedule already exists for the same patent/year',
          });
        }
        throw error;
      }
    })();

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_SCHEDULE_CREATE',
      targetType: 'PATENT_MAINTENANCE_SCHEDULE',
      targetId: created.id,
      afterJson: this.toScheduleDto(created),
    });

    return this.toScheduleDto(created);
  }

  async getSchedule(req: any, scheduleId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedScheduleId = this.parseUuidParam(scheduleId, 'scheduleId');

    const item = await this.prisma.patentMaintenanceSchedule.findUnique({ where: { id: normalizedScheduleId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });

    return this.toScheduleDto(item);
  }

  async updateSchedule(req: any, scheduleId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedScheduleId = this.parseUuidParam(scheduleId, 'scheduleId');

    const existing = await this.prisma.patentMaintenanceSchedule.findUnique({ where: { id: normalizedScheduleId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });

    const next: Prisma.PatentMaintenanceScheduleUpdateInput = {};
    if (this.hasOwn(body, 'dueDate')) {
      const dueDate = this.parseDate(body?.dueDate, 'dueDate', true);
      if (!dueDate) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dueDate is required' });
      next.dueDate = dueDate;
    }
    if (this.hasOwn(body, 'gracePeriodEnd')) {
      const grace = this.parseDate(body?.gracePeriodEnd, 'gracePeriodEnd', true);
      next.gracePeriodEnd = grace || null;
    }
    if (this.hasOwn(body, 'status')) {
      next.status = this.parseScheduleStatusStrict(body?.status, 'status');
    }

    const updated = await this.prisma.patentMaintenanceSchedule.update({
      where: { id: normalizedScheduleId },
      data: next,
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_SCHEDULE_UPDATE',
      targetType: 'PATENT_MAINTENANCE_SCHEDULE',
      targetId: normalizedScheduleId,
      beforeJson: this.toScheduleDto(existing),
      afterJson: this.toScheduleDto(updated),
    });

    return this.toScheduleDto(updated);
  }

  async listTasks(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: Prisma.PatentMaintenanceTaskWhereInput = {};
    if (this.hasOwn(query, 'scheduleId')) {
      where.scheduleId = this.parseUuidParam(query?.scheduleId, 'scheduleId');
    }
    if (this.hasOwn(query, 'assignedCsUserId')) {
      where.assignedCsUserId = this.parseUuidParam(query?.assignedCsUserId, 'assignedCsUserId');
    }
    if (this.hasOwn(query, 'status')) {
      where.status = this.parseTaskStatusStrict(query?.status, 'status');
    }

    const [items, total] = await Promise.all([
      this.prisma.patentMaintenanceTask.findMany({
        where,
        include: {
          assignedCsUser: {
            select: {
              nickname: true,
              verifications: {
                orderBy: { submittedAt: 'desc' },
                take: 1,
                select: { displayName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentMaintenanceTask.count({ where }),
    ]);

    return {
      items: items.map((item: any) => this.toTaskDto(item)),
      page: { page, pageSize, total },
    };
  }

  async listMyTasks(req: any, query: any) {
    this.ensureAuth(req);

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: Prisma.PatentMaintenanceTaskWhereInput = {
      schedule: {
        patent: { ownerUserId: req.auth.userId },
      },
    };
    if (this.hasOwn(query, 'scheduleId')) {
      where.scheduleId = this.parseUuidParam(query?.scheduleId, 'scheduleId');
    }
    if (this.hasOwn(query, 'status')) {
      where.status = this.parseTaskStatusStrict(query?.status, 'status');
    }

    const [items, total] = await Promise.all([
      this.prisma.patentMaintenanceTask.findMany({
        where,
        include: {
          assignedCsUser: {
            select: {
              nickname: true,
              verifications: {
                orderBy: { submittedAt: 'desc' },
                take: 1,
                select: { displayName: true },
              },
            },
          },
          schedule: {
            select: {
              patentId: true,
              yearNo: true,
              dueDate: true,
              status: true,
              patent: {
                select: {
                  title: true,
                  applicationNoDisplay: true,
                  applicationNoNorm: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentMaintenanceTask.count({ where }),
    ]);

    return {
      items: items.map((item: any) => this.toMyTaskDto(item)),
      page: { page, pageSize, total },
    };
  }

  async createTask(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const scheduleId = this.parseUuidParam(body?.scheduleId, 'scheduleId');
    const schedule = await this.prisma.patentMaintenanceSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });

    let assignedCsUserId: string | null | undefined = undefined;
    if (this.hasOwn(body, 'assignedCsUserId')) {
      assignedCsUserId = this.parseNullableUuid(body?.assignedCsUserId, 'assignedCsUserId');
      if (assignedCsUserId) await this.assertStaffUserAssignable(assignedCsUserId, 'assignedCsUserId');
    }

    let note: string | null | undefined = undefined;
    if (this.hasOwn(body, 'note')) {
      if (body.note === null) {
        note = null;
      } else {
        const rawNote = String(body?.note || '').trim();
        note = rawNote || null;
      }
    }
    const status = this.hasOwn(body, 'status')
      ? this.parseTaskStatusStrict(body?.status, 'status')
      : PatentMaintenanceTaskStatus.OPEN;

    const created = await this.prisma.patentMaintenanceTask.create({
      data: {
        scheduleId,
        assignedCsUserId: assignedCsUserId === undefined ? null : assignedCsUserId,
        status,
        note: note === undefined ? null : note,
      },
      include: {
        assignedCsUser: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
      },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_TASK_CREATE',
      targetType: 'PATENT_MAINTENANCE_TASK',
      targetId: created.id,
      afterJson: this.toTaskDto(created),
    });

    return this.toTaskDto(created);
  }

  async updateTask(req: any, taskId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedTaskId = this.parseUuidParam(taskId, 'taskId');

    const existing = await this.prisma.patentMaintenanceTask.findUnique({
      where: { id: normalizedTaskId },
      include: {
        assignedCsUser: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });

    const next: Prisma.PatentMaintenanceTaskUncheckedUpdateInput = {};

    if (this.hasOwn(body, 'assignedCsUserId')) {
      const assignedCsUserId = this.parseNullableUuid(body.assignedCsUserId, 'assignedCsUserId');
      if (assignedCsUserId !== null) await this.assertStaffUserAssignable(assignedCsUserId, 'assignedCsUserId');
      next.assignedCsUserId = assignedCsUserId;
    }

    if (this.hasOwn(body, 'status')) {
      next.status = this.parseTaskStatusStrict(body?.status, 'status');
    }

    if (this.hasOwn(body, 'note')) {
      if (body.note === null) {
        next.note = null;
      } else {
        const rawNote = String(body?.note || '').trim();
        next.note = rawNote || null;
      }
    }

    if (this.hasOwn(body, 'evidenceFileId')) {
      const evidenceFileId = this.parseNullableUuid(body.evidenceFileId, 'evidenceFileId');
      if (evidenceFileId !== null) {
        const file = await this.prisma.file.findUnique({ where: { id: evidenceFileId }, select: { id: true } });
        if (!file) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'evidenceFileId is invalid' });
      }
      next.evidenceFileId = evidenceFileId;
    }

    const updated = await this.prisma.patentMaintenanceTask.update({
      where: { id: normalizedTaskId },
      data: next,
      include: {
        assignedCsUser: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
      },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_TASK_UPDATE',
      targetType: 'PATENT_MAINTENANCE_TASK',
      targetId: normalizedTaskId,
      beforeJson: this.toTaskDto(existing),
      afterJson: this.toTaskDto(updated),
    });

    return this.toTaskDto(updated);
  }

  async listOrders(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: Prisma.PatentMaintenanceOrderWhereInput = {};
    if (this.hasOwn(query, 'scheduleId')) where.scheduleId = this.parseUuidParam(query?.scheduleId, 'scheduleId');
    if (this.hasOwn(query, 'applicantUserId')) where.applicantUserId = this.parseUuidParam(query?.applicantUserId, 'applicantUserId');
    if (this.hasOwn(query, 'assignedCsUserId')) where.assignedCsUserId = this.parseUuidParam(query?.assignedCsUserId, 'assignedCsUserId');
    if (this.hasOwn(query, 'status')) where.status = this.parseOrderStatusStrict(query?.status, 'status');
    if (this.hasOwn(query, 'reconcileStatus')) {
      where.reconcileStatus = this.parseReconcileStatusStrict(query?.reconcileStatus, 'reconcileStatus');
    }

    const dueFrom = this.parseDate(query?.dueFrom, 'dueFrom', true);
    const dueTo = this.parseDate(query?.dueTo, 'dueTo', true);
    if (dueFrom || dueTo) {
      const dueDateFilter: Prisma.DateTimeFilter = {};
      if (dueFrom) dueDateFilter.gte = dueFrom;
      if (dueTo) dueDateFilter.lte = dueTo;
      where.schedule = { is: { dueDate: dueDateFilter } };
    }

    const [items, total] = await Promise.all([
      this.prisma.patentMaintenanceOrder.findMany({
        where,
        include: {
          applicantUser: {
            select: {
              nickname: true,
              verifications: {
                orderBy: { submittedAt: 'desc' },
                take: 1,
                select: { displayName: true },
              },
            },
          },
          assignedCsUser: {
            select: {
              nickname: true,
              verifications: {
                orderBy: { submittedAt: 'desc' },
                take: 1,
                select: { displayName: true },
              },
            },
          },
          schedule: {
            include: {
              patent: {
                select: {
                  title: true,
                  applicationNoDisplay: true,
                  applicationNoNorm: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentMaintenanceOrder.count({ where }),
    ]);

    return {
      items: items.map((item: any) => this.toOrderDto(item)),
      page: { page, pageSize, total },
    };
  }

  async listMyOrders(req: any, query: any) {
    this.ensureAuth(req);

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: Prisma.PatentMaintenanceOrderWhereInput = { applicantUserId: req.auth.userId };
    if (this.hasOwn(query, 'orderId')) where.id = this.parseUuidParam(query?.orderId, 'orderId');
    if (this.hasOwn(query, 'scheduleId')) where.scheduleId = this.parseUuidParam(query?.scheduleId, 'scheduleId');
    if (this.hasOwn(query, 'status')) where.status = this.parseOrderStatusStrict(query?.status, 'status');
    if (this.hasOwn(query, 'reconcileStatus')) {
      where.reconcileStatus = this.parseReconcileStatusStrict(query?.reconcileStatus, 'reconcileStatus');
    }

    const [items, total] = await Promise.all([
      this.prisma.patentMaintenanceOrder.findMany({
        where,
        include: {
          applicantUser: {
            select: {
              nickname: true,
              verifications: {
                orderBy: { submittedAt: 'desc' },
                take: 1,
                select: { displayName: true },
              },
            },
          },
          assignedCsUser: {
            select: {
              nickname: true,
              verifications: {
                orderBy: { submittedAt: 'desc' },
                take: 1,
                select: { displayName: true },
              },
            },
          },
          schedule: {
            include: {
              patent: {
                select: {
                  title: true,
                  applicationNoDisplay: true,
                  applicationNoNorm: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentMaintenanceOrder.count({ where }),
    ]);

    return {
      items: items.map((item: any) => this.toOrderDto(item)),
      page: { page, pageSize, total },
    };
  }

  async getOrder(req: any, orderId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');

    const order = await this.getOrderWithContext(normalizedOrderId);
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    return this.toOrderDto(order);
  }

  async getMyOrder(req: any, orderId: string) {
    this.ensureAuth(req);
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');

    const order = await this.getOrderWithContext(normalizedOrderId);
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    this.assertMyOrderAccess(req, order);
    return this.toOrderDto(order);
  }

  async listOrderEvents(req: any, orderId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');

    const order = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId }, select: { id: true } });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });

    const events = await this.prisma.patentMaintenanceOrderEvent.findMany({
      where: { orderId: normalizedOrderId },
      include: {
        actorUser: {
          select: {
            id: true,
            nickname: true,
            role: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { items: events.map((item: any) => this.toOrderEventDto(item)) };
  }

  async listMyOrderEvents(req: any, orderId: string) {
    this.ensureAuth(req);
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const order = await this.getOrderWithContext(normalizedOrderId);
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    this.assertMyOrderAccess(req, order);

    const events = await this.prisma.patentMaintenanceOrderEvent.findMany({
      where: { orderId: normalizedOrderId },
      include: {
        actorUser: {
          select: {
            id: true,
            nickname: true,
            role: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { items: events.map((item: any) => this.toOrderEventDto(item)) };
  }

  async createOrder(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const scheduleId = this.parseUuidParam(body?.scheduleId, 'scheduleId');
    const schedule = await this.prisma.patentMaintenanceSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        patent: {
          select: {
            ownerUserId: true,
            title: true,
            applicationNoDisplay: true,
            applicationNoNorm: true,
          },
        },
      },
    });
    if (!schedule) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });

    const applicantUserId = this.hasOwn(body, 'applicantUserId')
      ? this.parseUuidParam(body?.applicantUserId, 'applicantUserId')
      : this.parseUuidParam(schedule?.patent?.ownerUserId, 'applicantUserId');
    await this.assertUserExists(applicantUserId, 'applicantUserId');

    let assignedCsUserId: string | null = null;
    if (this.hasOwn(body, 'assignedCsUserId')) {
      assignedCsUserId = this.parseNullableUuid(body?.assignedCsUserId, 'assignedCsUserId');
      if (assignedCsUserId) await this.assertStaffUserAssignable(assignedCsUserId, 'assignedCsUserId');
    }

    const existingOpen = await this.prisma.patentMaintenanceOrder.findFirst({
      where: {
        scheduleId,
        applicantUserId,
        status: { in: OPEN_ORDER_STATUSES },
      },
      select: { id: true },
    });
    if (existingOpen) {
      throw new ConflictException({ code: 'CONFLICT', message: 'open maintenance order already exists' });
    }

    const created = await this.prisma.patentMaintenanceOrder.create({
      data: {
        scheduleId,
        applicantUserId,
        assignedCsUserId,
        status: 'REQUESTED',
      },
      include: {
        applicantUser: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
        assignedCsUser: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: created.id,
      actorUserId: req.auth.userId,
      eventType: 'CREATED',
      toStatus: 'REQUESTED',
      note: '官方年费代缴记录已创建',
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_CREATE',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: created.id,
      afterJson: this.toOrderDto(created),
    });

    return this.toOrderDto(created);
  }

  async createMyOrder(req: any, body: any) {
    this.ensureAuth(req);
    const scheduleId = this.parseUuidParam(body?.scheduleId, 'scheduleId');
    const schedule = await this.prisma.patentMaintenanceSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        patent: {
          select: {
            ownerUserId: true,
            title: true,
            applicationNoDisplay: true,
            applicationNoNorm: true,
          },
        },
      },
    });
    if (!schedule) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });
    if (schedule?.patent?.ownerUserId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }

    const existingOpen = await this.prisma.patentMaintenanceOrder.findFirst({
      where: {
        scheduleId,
        applicantUserId: req.auth.userId,
        status: { in: OPEN_ORDER_STATUSES },
      },
      select: { id: true },
    });
    if (existingOpen) {
      throw new ConflictException({ code: 'CONFLICT', message: 'open maintenance order already exists' });
    }

    const created = await this.prisma.patentMaintenanceOrder.create({
      data: {
        scheduleId,
        applicantUserId: req.auth.userId,
        status: 'REQUESTED',
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: created.id,
      actorUserId: req.auth.userId,
      eventType: 'CREATED',
      toStatus: 'REQUESTED',
      note: '专利权人已发起官方年费代缴申请',
    });

    return this.toOrderDto(created);
  }

  async createMyOrderFromListing(req: any, body: any) {
    this.ensureAuth(req);
    const ownerUserId = this.parseUuidParam(req?.auth?.userId, 'userId');
    const listingId = this.parseUuidParam(body?.listingId, 'listingId');
    const requestHash = this.hashPayload({ listingId });
    const orderInclude = {
      applicantUser: {
        select: {
          nickname: true,
          verifications: {
            orderBy: { submittedAt: 'desc' as const },
            take: 1,
            select: { displayName: true },
          },
        },
      },
      assignedCsUser: {
        select: {
          nickname: true,
          verifications: {
            orderBy: { submittedAt: 'desc' as const },
            take: 1,
            select: { displayName: true },
          },
        },
      },
      schedule: {
        include: {
          patent: {
            select: {
              title: true,
              applicationNoDisplay: true,
              applicationNoNorm: true,
            },
          },
        },
      },
    };

    return await this.withIdempotency(req, 'patent-maintenance:listing-request', requestHash, async () => {
      const order = await this.prisma.$transaction(async (tx: any) => {
        const listing = await tx.listing.findUnique({
          where: { id: listingId },
          select: {
            id: true,
            sellerUserId: true,
            patentId: true,
            status: true,
            auditStatus: true,
            patent: {
              select: {
                id: true,
                ownerUserId: true,
                filingDate: true,
                grantDate: true,
              },
            },
          },
        });
        if (!listing || listing.sellerUserId !== ownerUserId) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
        }
        if (!listing.patentId || !listing.patent) {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: '该专利缺少专利基础信息，暂不能申请年费代缴' });
        }
        if (listing.status !== 'ACTIVE' || listing.auditStatus !== 'APPROVED') {
          throw new BadRequestException({ code: 'BAD_REQUEST', message: '请先完成发布审核后再申请年费代缴' });
        }

        const [lockKey1, lockKey2] = this.advisoryLockParts(`maintenance-listing-request:${ownerUserId}:${listing.patentId}`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

        if (!listing.patent.ownerUserId) {
          await tx.patent.update({
            where: { id: listing.patentId },
            data: {
              ownerUserId,
              ownerClaimedAt: new Date(),
              ownerClaimSource: 'USER_CLAIM',
            },
          });
        } else if (listing.patent.ownerUserId !== ownerUserId) {
          throw new ForbiddenException({ code: 'FORBIDDEN', message: '专利归属与当前发布人不一致，请联系平台处理' });
        }

        const existingOpen = await tx.patentMaintenanceOrder.findFirst({
          where: {
            applicantUserId: ownerUserId,
            status: { in: OPEN_ORDER_STATUSES },
            schedule: { patentId: listing.patentId },
          },
          orderBy: { createdAt: 'desc' },
          include: orderInclude,
        });
        if (existingOpen) return existingOpen;

        let schedule = await tx.patentMaintenanceSchedule.findFirst({
          where: {
            patentId: listing.patentId,
            status: { in: ['DUE', 'OVERDUE'] },
          },
          orderBy: [{ dueDate: 'asc' }, { yearNo: 'asc' }],
          select: { id: true },
        });
        if (!schedule) {
          const baseDate = listing.patent.grantDate || listing.patent.filingDate || new Date();
          const dueDate = this.dateOnly(this.addYears(baseDate, 1));
          const gracePeriodEnd = this.dateOnly(new Date(dueDate));
          gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + 6);
          schedule = await tx.patentMaintenanceSchedule.upsert({
            where: {
              patentId_yearNo: {
                patentId: listing.patentId,
                yearNo: 1,
              },
            },
            create: {
              patentId: listing.patentId,
              yearNo: 1,
              dueDate,
              gracePeriodEnd,
              status: 'DUE',
            },
            update: {},
            select: { id: true },
          });
        }

        const created = await tx.patentMaintenanceOrder.create({
          data: {
            scheduleId: schedule.id,
            applicantUserId: ownerUserId,
            status: 'REQUESTED',
          },
          include: orderInclude,
        });
        await this.appendOrderEvent(
          {
            orderId: created.id,
            actorUserId: ownerUserId,
            eventType: 'CREATED',
            toStatus: 'REQUESTED',
            note: '专利权人从我的专利发起官方年费代缴申请',
            payloadJson: { listingId: listing.id },
          },
          tx,
        );

        return created;
      });

      return this.toOrderDto(order);
    });
  }

  async createMyDirectOrder(req: any, body: any) {
    this.ensureAuth(req);
    const ownerUserId = this.parseUuidParam(req?.auth?.userId, 'userId');
    const application = this.normalizeApplicationNo(body?.applicationNo || body?.applicationNoDisplay, 'applicationNo');
    const title = this.parseRequiredNonEmptyString(body?.title, 'title');
    const patentType = this.parsePatentTypeStrict(body?.patentType, 'patentType');
    const yearNo = this.hasOwn(body, 'yearNo') ? this.parsePositiveIntStrict(body?.yearNo, 'yearNo') : 1;
    const dueDateInput = this.parseDate(body?.dueDate, 'dueDate', true);
    const requestHash = this.hashPayload({
      applicationNoNorm: application.applicationNoNorm,
      patentType,
      yearNo,
      dueDate: dueDateInput ? dueDateInput.toISOString().slice(0, 10) : null,
      title,
    });
    const orderInclude = {
      applicantUser: {
        select: {
          nickname: true,
          verifications: {
            orderBy: { submittedAt: 'desc' as const },
            take: 1,
            select: { displayName: true },
          },
        },
      },
      assignedCsUser: {
        select: {
          nickname: true,
          verifications: {
            orderBy: { submittedAt: 'desc' as const },
            take: 1,
            select: { displayName: true },
          },
        },
      },
      schedule: {
        include: {
          patent: {
            select: {
              title: true,
              applicationNoDisplay: true,
              applicationNoNorm: true,
            },
          },
        },
      },
    };

    return await this.withIdempotency(req, 'patent-maintenance:direct-request', requestHash, async () => {
      const order = await this.prisma.$transaction(async (tx: any) => {
        const [lockKey1, lockKey2] = this.advisoryLockParts(`maintenance-direct-request:${ownerUserId}:${application.applicationNoNorm}`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

        let patent = await tx.patent.findUnique({
          where: {
            jurisdiction_applicationNoNorm: {
              jurisdiction: 'CN',
              applicationNoNorm: application.applicationNoNorm,
            },
          },
          select: {
            id: true,
            ownerUserId: true,
            filingDate: true,
            grantDate: true,
          },
        });

        if (!patent) {
          patent = await tx.patent.create({
            data: {
              jurisdiction: 'CN',
              applicationNoNorm: application.applicationNoNorm,
              applicationNoDisplay: application.applicationNoDisplay,
              patentType,
              title,
              sourcePrimary: 'USER',
              ownerUserId,
              ownerClaimedAt: new Date(),
              ownerClaimSource: 'USER_CLAIM',
            },
            select: {
              id: true,
              ownerUserId: true,
              filingDate: true,
              grantDate: true,
            },
          });
        } else if (!patent.ownerUserId) {
          patent = await tx.patent.update({
            where: { id: patent.id },
            data: {
              ownerUserId,
              ownerClaimedAt: new Date(),
              ownerClaimSource: 'USER_CLAIM',
              applicationNoDisplay: application.applicationNoDisplay,
              title,
            },
            select: {
              id: true,
              ownerUserId: true,
              filingDate: true,
              grantDate: true,
            },
          });
        } else if (patent.ownerUserId !== ownerUserId) {
          throw new ForbiddenException({ code: 'FORBIDDEN', message: '该专利已关联其他用户，请联系平台核验归属后再申请代缴' });
        }

        const existingOpen = await tx.patentMaintenanceOrder.findFirst({
          where: {
            applicantUserId: ownerUserId,
            status: { in: OPEN_ORDER_STATUSES },
            schedule: { patentId: patent.id },
          },
          orderBy: { createdAt: 'desc' },
          include: orderInclude,
        });
        if (existingOpen) return existingOpen;

        const dueDate = this.dateOnly(dueDateInput || this.addYears(patent.grantDate || patent.filingDate || new Date(), 1));
        const gracePeriodEnd = this.dateOnly(new Date(dueDate));
        gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + 6);

        const schedule = await tx.patentMaintenanceSchedule.upsert({
          where: {
            patentId_yearNo: {
              patentId: patent.id,
              yearNo,
            },
          },
          create: {
            patentId: patent.id,
            yearNo,
            dueDate,
            gracePeriodEnd,
            status: dueDate.getTime() < this.dateOnly(new Date()).getTime() ? 'OVERDUE' : 'DUE',
          },
          update: {},
          select: { id: true },
        });

        const created = await tx.patentMaintenanceOrder.create({
          data: {
            scheduleId: schedule.id,
            applicantUserId: ownerUserId,
            status: 'REQUESTED',
          },
          include: orderInclude,
        });
        await this.appendOrderEvent(
          {
            orderId: created.id,
            actorUserId: ownerUserId,
            eventType: 'CREATED',
            toStatus: 'REQUESTED',
            note: '用户添加未上架专利并发起官方年费代缴申请',
            payloadJson: {
              source: 'DIRECT',
              applicationNoDisplay: application.applicationNoDisplay,
              yearNo,
              dueDate: dueDate.toISOString().slice(0, 10),
            },
          },
          tx,
        );

        return created;
      });

      return this.toOrderDto(order);
    });
  }

  async quoteOrder(req: any, orderId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const existing = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (!['REQUESTED', 'QUOTED', 'AWAITING_PAYMENT'].includes(existing.status)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'order status cannot be quoted' });
    }

    const officialFeeFen = this.parseNonNegativeIntStrict(body?.officialFeeFen, 'officialFeeFen');
    const lateFeeFen = this.hasOwn(body, 'lateFeeFen') ? this.parseNonNegativeIntStrict(body?.lateFeeFen, 'lateFeeFen') : 0;
    const serviceFeeFen = this.parseNonNegativeIntStrict(body?.serviceFeeFen, 'serviceFeeFen');
    const paymentDeadline = this.parseDateTimeStrict(body?.paymentDeadline, 'paymentDeadline');

    let assignedCsUserId: string | null | undefined = undefined;
    if (this.hasOwn(body, 'assignedCsUserId')) {
      assignedCsUserId = this.parseNullableUuid(body?.assignedCsUserId, 'assignedCsUserId');
      if (assignedCsUserId) await this.assertStaffUserAssignable(assignedCsUserId, 'assignedCsUserId');
    }

    const totalAmountFen = this.calcTotalAmount(officialFeeFen, lateFeeFen, serviceFeeFen);
    const next = await this.prisma.patentMaintenanceOrder.update({
      where: { id: normalizedOrderId },
      data: {
        status: 'AWAITING_PAYMENT',
        officialFeeFen,
        lateFeeFen,
        serviceFeeFen,
        totalAmountFen,
        paymentDeadline,
        assignedCsUserId: assignedCsUserId === undefined ? existing.assignedCsUserId : assignedCsUserId,
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: normalizedOrderId,
      actorUserId: req.auth.userId,
      eventType: 'QUOTE_UPDATED',
      fromStatus: existing.status,
      toStatus: next.status,
      payloadJson: {
        officialFeeFen,
        lateFeeFen,
        serviceFeeFen,
        totalAmountFen,
        paymentDeadline: paymentDeadline.toISOString(),
      },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_QUOTE',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: normalizedOrderId,
      beforeJson: this.toOrderDto(existing),
      afterJson: this.toOrderDto(next),
    });
    return this.toOrderDto(next);
  }

  async confirmOrderPayment(req: any, orderId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const existing = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (existing.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'order status cannot be marked paid' });
    }

    const paymentChannel = this.parsePaymentChannelStrict(body?.paymentChannel, 'paymentChannel');
    const paymentTxnNo = this.parseRequiredNonEmptyString(body?.paymentTxnNo, 'paymentTxnNo');
    const paidAt = this.hasOwn(body, 'paidAt') ? this.parseDateTimeStrict(body?.paidAt, 'paidAt') : new Date();

    const next = await this.prisma.patentMaintenanceOrder.update({
      where: { id: normalizedOrderId },
      data: {
        status: 'PAID',
        paymentChannel,
        paymentTxnNo,
        paidAt,
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: normalizedOrderId,
      actorUserId: req.auth.userId,
      eventType: 'PAYMENT_CONFIRMED',
      fromStatus: existing.status,
      toStatus: next.status,
      payloadJson: {
        paymentChannel,
        paymentTxnNo,
        paidAt: paidAt.toISOString(),
      },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_PAYMENT_CONFIRM',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: normalizedOrderId,
      beforeJson: this.toOrderDto(existing),
      afterJson: this.toOrderDto(next),
    });
    return this.toOrderDto(next);
  }

  async submitOrderExecution(req: any, orderId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const existing = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (existing.status !== 'PAID') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'order status cannot be executed' });
    }

    const officialSubmissionNo = this.parseRequiredNonEmptyString(body?.officialSubmissionNo, 'officialSubmissionNo');
    const executedAt = this.hasOwn(body, 'executedAt') ? this.parseDateTimeStrict(body?.executedAt, 'executedAt') : new Date();

    const next = await this.prisma.patentMaintenanceOrder.update({
      where: { id: normalizedOrderId },
      data: {
        status: 'EXECUTING',
        officialSubmissionNo,
        executedAt,
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: normalizedOrderId,
      actorUserId: req.auth.userId,
      eventType: 'EXECUTION_SUBMITTED',
      fromStatus: existing.status,
      toStatus: next.status,
      payloadJson: {
        officialSubmissionNo,
        executedAt: executedAt.toISOString(),
      },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_EXECUTION_SUBMIT',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: normalizedOrderId,
      beforeJson: this.toOrderDto(existing),
      afterJson: this.toOrderDto(next),
    });
    return this.toOrderDto(next);
  }

  async uploadOrderReceipt(req: any, orderId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const existing = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (existing.status !== 'EXECUTING') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'order status cannot upload receipt' });
    }

    const officialReceiptNo = this.parseRequiredNonEmptyString(body?.officialReceiptNo, 'officialReceiptNo');
    const officialReceiptFileId = this.parseUuidParam(body?.officialReceiptFileId, 'officialReceiptFileId');
    const receiptIssuedAt = this.hasOwn(body, 'receiptIssuedAt')
      ? this.parseDateTimeStrict(body?.receiptIssuedAt, 'receiptIssuedAt')
      : new Date();
    const receiptFile = await this.prisma.file.findUnique({ where: { id: officialReceiptFileId }, select: { id: true } });
    if (!receiptFile) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'officialReceiptFileId is invalid' });

    const next = await this.prisma.patentMaintenanceOrder.update({
      where: { id: normalizedOrderId },
      data: {
        status: 'RECEIPT_UPLOADED',
        officialReceiptNo,
        officialReceiptFileId,
        receiptIssuedAt,
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: normalizedOrderId,
      actorUserId: req.auth.userId,
      eventType: 'RECEIPT_UPLOADED',
      fromStatus: existing.status,
      toStatus: next.status,
      payloadJson: {
        officialReceiptNo,
        officialReceiptFileId,
        receiptIssuedAt: receiptIssuedAt.toISOString(),
      },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_RECEIPT_UPLOAD',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: normalizedOrderId,
      beforeJson: this.toOrderDto(existing),
      afterJson: this.toOrderDto(next),
    });
    return this.toOrderDto(next);
  }

  async reconcileOrder(req: any, orderId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const existing = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (!['RECEIPT_UPLOADED', 'RECONCILED'].includes(existing.status)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'order status cannot reconcile' });
    }

    const reconcileStatus = this.parseReconcileStatusStrict(body?.reconcileStatus, 'reconcileStatus');
    const reconcileNote = this.hasOwn(body, 'reconcileNote')
      ? this.parseNullableNonEmptyStringStrict(body?.reconcileNote, 'reconcileNote')
      : null;
    const nextStatus: PatentMaintenanceOrderStatus = reconcileStatus === 'MATCHED' ? 'RECONCILED' : 'RECEIPT_UPLOADED';

    const next = await this.prisma.patentMaintenanceOrder.update({
      where: { id: normalizedOrderId },
      data: {
        status: nextStatus,
        reconcileStatus,
        reconcileNote,
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: normalizedOrderId,
      actorUserId: req.auth.userId,
      eventType: 'RECONCILED',
      fromStatus: existing.status,
      toStatus: next.status,
      payloadJson: {
        reconcileStatus,
        reconcileNote,
      },
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_RECONCILE',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: normalizedOrderId,
      beforeJson: this.toOrderDto(existing),
      afterJson: this.toOrderDto(next),
    });
    return this.toOrderDto(next);
  }

  async closeOrder(req: any, orderId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const existing = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (existing.status !== 'RECONCILED' || existing.reconcileStatus !== 'MATCHED') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'only matched reconciled orders can be closed' });
    }

    const closeNote = this.hasOwn(body, 'closeNote') ? this.parseNullableNonEmptyStringStrict(body?.closeNote, 'closeNote') : null;
    const next = await this.prisma.patentMaintenanceOrder.update({
      where: { id: normalizedOrderId },
      data: {
        status: 'CLOSED',
        closeNote,
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: normalizedOrderId,
      actorUserId: req.auth.userId,
      eventType: 'CLOSED',
      fromStatus: existing.status,
      toStatus: next.status,
      note: closeNote,
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_CLOSE',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: normalizedOrderId,
      beforeJson: this.toOrderDto(existing),
      afterJson: this.toOrderDto(next),
    });
    return this.toOrderDto(next);
  }

  async cancelOrder(req: any, orderId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');
    const normalizedOrderId = this.parseUuidParam(orderId, 'orderId');
    const existing = await this.prisma.patentMaintenanceOrder.findUnique({ where: { id: normalizedOrderId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    if (!['REQUESTED', 'QUOTED', 'AWAITING_PAYMENT', 'PAID'].includes(existing.status)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'order status cannot be cancelled' });
    }

    const closeNote = this.parseRequiredNonEmptyString(body?.closeNote, 'closeNote');
    const next = await this.prisma.patentMaintenanceOrder.update({
      where: { id: normalizedOrderId },
      data: {
        status: 'CANCELLED',
        closeNote,
      },
      include: {
        schedule: {
          include: {
            patent: {
              select: {
                title: true,
                applicationNoDisplay: true,
                applicationNoNorm: true,
              },
            },
          },
        },
      },
    });
    await this.appendOrderEvent({
      orderId: normalizedOrderId,
      actorUserId: req.auth.userId,
      eventType: 'CANCELLED',
      fromStatus: existing.status,
      toStatus: next.status,
      note: closeNote,
    });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_ORDER_CANCEL',
      targetType: 'PATENT_MAINTENANCE_ORDER',
      targetId: normalizedOrderId,
      beforeJson: this.toOrderDto(existing),
      afterJson: this.toOrderDto(next),
    });
    return this.toOrderDto(next);
  }
}
