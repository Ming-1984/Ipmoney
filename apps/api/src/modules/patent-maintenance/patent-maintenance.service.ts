import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PatentMaintenanceStatus, PatentMaintenanceTaskStatus, Prisma } from '@prisma/client';
import { AuditLogService } from '../../common/audit-log.service';
import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';

const STATUS_SET = new Set<PatentMaintenanceStatus>(['DUE', 'PAID', 'OVERDUE', 'WAIVED']);
const TASK_STATUS_SET = new Set<PatentMaintenanceTaskStatus>([
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
]);

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
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private normalizeStatus(value: any): PatentMaintenanceStatus | undefined {
    const v = String(value || '').trim().toUpperCase() as PatentMaintenanceStatus;
    return STATUS_SET.has(v) ? v : undefined;
  }

  private normalizeTaskStatus(value: any): PatentMaintenanceTaskStatus | undefined {
    const v = String(value || '').trim().toUpperCase() as PatentMaintenanceTaskStatus;
    return TASK_STATUS_SET.has(v) ? v : undefined;
  }

  private parseStatusStrict(value: any, field: string): PatentMaintenanceStatus {
    const status = this.normalizeStatus(value);
    if (!status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return status;
  }

  private parseTaskStatusStrict(value: any, field: string): PatentMaintenanceTaskStatus {
    const status = this.normalizeTaskStatus(value);
    if (!status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return status;
  }

  private parseDate(value: any, field: string, strict = false) {
    if (value === undefined || value === null) return null;
    if (String(value).trim() === '') {
      if (strict) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
      }
      return null;
    }
    const dt = new Date(String(value));
    if (Number.isNaN(dt.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return dt;
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
    return {
      id: item.id,
      scheduleId: item.scheduleId,
      assignedCsUserId: item.assignedCsUserId ?? undefined,
      status: item.status,
      note: item.note ?? undefined,
      evidenceFileId: item.evidenceFileId ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : undefined,
    };
  }

  async listSchedules(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: any = {};
    if (query?.patentId) where.patentId = String(query.patentId).trim();
    const hasStatus = this.hasOwn(query, 'status');
    const status = hasStatus ? this.parseStatusStrict(query?.status, 'status') : undefined;
    if (status) where.status = status;

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
      items: items.map((item) => this.toScheduleDto(item)),
      page: { page, pageSize, total },
    };
  }

  async createSchedule(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const patentId = String(body?.patentId || '').trim();
    if (!patentId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentId is required' });

    const rawYearNo = body?.yearNo;
    const yearNo = typeof rawYearNo === 'number' ? rawYearNo : Number(rawYearNo);
    if (!Number.isFinite(yearNo) || !Number.isInteger(yearNo) || yearNo <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'yearNo is invalid' });
    }

    const dueDate = this.parseDate(body?.dueDate, 'dueDate');
    if (!dueDate) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dueDate is required' });

    const gracePeriodEnd = this.parseDate(body?.gracePeriodEnd, 'gracePeriodEnd');
    const hasStatus = !!body && Object.prototype.hasOwnProperty.call(body, 'status');
    const status = hasStatus ? this.parseStatusStrict(body?.status, 'status') : PatentMaintenanceStatus.DUE;

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

    const item = await this.prisma.patentMaintenanceSchedule.findUnique({ where: { id: scheduleId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });

    return this.toScheduleDto(item);
  }

  async updateSchedule(req: any, scheduleId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const existing = await this.prisma.patentMaintenanceSchedule.findUnique({ where: { id: scheduleId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });

    const next: any = {};
    if (body?.dueDate !== undefined) {
      const dueDate = this.parseDate(body?.dueDate, 'dueDate');
      if (!dueDate) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dueDate is required' });
      next.dueDate = dueDate;
    }
    if (body?.gracePeriodEnd !== undefined) {
      const grace = this.parseDate(body?.gracePeriodEnd, 'gracePeriodEnd');
      next.gracePeriodEnd = grace || null;
    }
    if (body?.status !== undefined) {
      const status = this.parseStatusStrict(body?.status, 'status');
      next.status = status;
    }

    const updated = await this.prisma.patentMaintenanceSchedule.update({ where: { id: scheduleId }, data: next });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_SCHEDULE_UPDATE',
      targetType: 'PATENT_MAINTENANCE_SCHEDULE',
      targetId: scheduleId,
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

    const where: any = {};
    if (query?.scheduleId) where.scheduleId = String(query.scheduleId).trim();
    if (query?.assignedCsUserId) where.assignedCsUserId = String(query.assignedCsUserId).trim();
    const hasStatus = this.hasOwn(query, 'status');
    const status = hasStatus ? this.parseTaskStatusStrict(query?.status, 'status') : undefined;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.patentMaintenanceTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patentMaintenanceTask.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toTaskDto(item)),
      page: { page, pageSize, total },
    };
  }

  async createTask(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'maintenance.manage');

    const scheduleId = String(body?.scheduleId || '').trim();
    if (!scheduleId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'scheduleId is required' });

    const schedule = await this.prisma.patentMaintenanceSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Schedule not found' });

    const assignedCsUserId = body?.assignedCsUserId ? String(body.assignedCsUserId).trim() : undefined;
    if (assignedCsUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: assignedCsUserId }, select: { id: true } });
      if (!user) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'assignedCsUserId is invalid' });
    }

    const note = body?.note ? String(body.note).trim() : undefined;
    const hasStatus = !!body && Object.prototype.hasOwnProperty.call(body, 'status');

    const created = await this.prisma.patentMaintenanceTask.create({
      data: {
        scheduleId,
        assignedCsUserId: assignedCsUserId || null,
        status: hasStatus ? this.parseTaskStatusStrict(body?.status, 'status') : PatentMaintenanceTaskStatus.OPEN,
        note: note || null,
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

    const existing = await this.prisma.patentMaintenanceTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });

    const next: any = {};

    if (body?.assignedCsUserId !== undefined) {
      const assignedCsUserId = body.assignedCsUserId ? String(body.assignedCsUserId).trim() : '';
      if (assignedCsUserId) {
        const user = await this.prisma.user.findUnique({ where: { id: assignedCsUserId }, select: { id: true } });
        if (!user) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'assignedCsUserId is invalid' });
        next.assignedCsUserId = assignedCsUserId;
      } else {
        next.assignedCsUserId = null;
      }
    }

    if (body?.status !== undefined) {
      const status = this.parseTaskStatusStrict(body?.status, 'status');
      next.status = status;
    }

    if (body?.note !== undefined) {
      next.note = body.note ? String(body.note).trim() : null;
    }

    if (body?.evidenceFileId !== undefined) {
      const evidenceFileId = body.evidenceFileId ? String(body.evidenceFileId).trim() : '';
      if (evidenceFileId) {
        const file = await this.prisma.file.findUnique({ where: { id: evidenceFileId }, select: { id: true } });
        if (!file) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'evidenceFileId is invalid' });
        next.evidenceFileId = evidenceFileId;
      } else {
        next.evidenceFileId = null;
      }
    }

    const updated = await this.prisma.patentMaintenanceTask.update({ where: { id: taskId }, data: next });

    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'MAINTENANCE_TASK_UPDATE',
      targetType: 'PATENT_MAINTENANCE_TASK',
      targetId: taskId,
      beforeJson: this.toTaskDto(existing),
      afterJson: this.toTaskDto(updated),
    });

    return this.toTaskDto(updated);
  }
}
