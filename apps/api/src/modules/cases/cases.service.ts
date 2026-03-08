import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CasePriority, CaseStatus, CaseType, Prisma } from '@prisma/client';

import { requirePermission } from '../../common/permissions';
import { PrismaService } from '../../common/prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CaseSlaStatus = 'ON_TIME' | 'OVERDUE';

type CaseNote = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type CaseRecord = {
  id: string;
  title: string;
  type: CaseType;
  status: CaseStatus;
  orderId?: string | null;
  requesterName?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority?: CasePriority;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  notes: CaseNote[];
  evidenceFiles?: { id: string; name: string; url?: string }[];
  dueAt?: string;
  slaStatus?: CaseSlaStatus;
};

const DEFAULT_TITLES: Record<CaseType, string> = {
  FOLLOWUP: '订单跟单',
  REFUND: '退款争议',
  DISPUTE: '交易争议',
};

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  private hasOwn(body: any, key: string) {
    return Object.prototype.hasOwnProperty.call(body || {}, key);
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

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private normalizeType(value: any): CaseType | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (v === 'FOLLOWUP' || v === 'REFUND' || v === 'DISPUTE') return v as CaseType;
    return undefined;
  }

  private parseTypeStrict(value: any, fieldName: string): CaseType {
    const type = this.normalizeType(value);
    if (!type) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} 不合法` });
    }
    return type;
  }

  private normalizeStatus(value: any): CaseStatus | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (v === 'OPEN' || v === 'IN_PROGRESS' || v === 'CLOSED') return v as CaseStatus;
    return undefined;
  }

  private parseStatusStrict(value: any, fieldName: string): CaseStatus {
    const status = this.normalizeStatus(value);
    if (!status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} 不合法` });
    }
    return status;
  }

  private normalizePriority(value: any): CasePriority | undefined {
    const v = String(value || '').trim().toUpperCase();
    if (v === 'LOW' || v === 'MEDIUM' || v === 'HIGH') return v as CasePriority;
    return undefined;
  }

  private parsePriorityStrict(value: any, fieldName: string): CasePriority {
    const priority = this.normalizePriority(value);
    if (!priority) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} 不合法` });
    }
    return priority;
  }

  private parseDueAt(value: any, strict = false): Date | null {
    if (value === undefined || value === null) return null;
    if (String(value).trim() === '') {
      if (strict) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dueAt 格式不正确' });
      }
      return null;
    }
    const dt = new Date(String(value));
    if (Number.isNaN(dt.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dueAt 格式不正确' });
    }
    return dt;
  }

  private getSlaStatus(dueAt?: Date | string | null): CaseSlaStatus | undefined {
    if (!dueAt) return undefined;
    const dt = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
    if (Number.isNaN(dt.getTime())) return undefined;
    return dt.getTime() < Date.now() ? 'OVERDUE' : 'ON_TIME';
  }

  private toCaseRecord(item: any): CaseRecord {
    const title = String(item.title || '').trim() || DEFAULT_TITLES[item.type as CaseType] || '客服工单';
    const notes = (item.notes || []).map((note: any) => ({
      id: note.id,
      authorId: note.authorId,
      authorName: note.authorName,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    }));
    const evidenceFiles = (item.evidences || []).map((ev: any) => {
      const fileName = ev.fileName || ev.file?.fileName || ev.fileId || ev.id;
      const url = ev.url || ev.file?.url || undefined;
      return {
        id: ev.fileId || ev.id,
        name: String(fileName || '附件'),
        url,
      };
    });

    return {
      id: item.id,
      title,
      type: item.type,
      status: item.status,
      orderId: item.orderId ?? null,
      requesterName: item.requesterName ?? undefined,
      assigneeId: item.csUserId ?? undefined,
      assigneeName: item.csUser?.nickname || item.csUser?.phone || undefined,
      priority: item.priority ?? undefined,
      description: item.description ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : undefined,
      notes,
      evidenceFiles,
      dueAt: item.dueAt ? item.dueAt.toISOString() : undefined,
      slaStatus: this.getSlaStatus(item.dueAt),
    };
  }

  private async fetchCase(caseId: string) {
    return await this.prisma.csCase.findUnique({
      where: { id: caseId },
      include: {
        csUser: true,
        notes: { orderBy: { createdAt: 'desc' } },
        evidences: { orderBy: { createdAt: 'desc' }, include: { file: true } },
      },
    });
  }

  private async ensureCaseExists(caseId: string) {
    const found = await this.prisma.csCase.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
  }

  async list(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const q = String(query?.q || '').trim();
    const hasStatus = this.hasOwn(query, 'status');
    const hasType = this.hasOwn(query, 'type');
    const status = hasStatus ? this.parseStatusStrict(query?.status, 'status') : undefined;
    const type = hasType ? this.parseTypeStrict(query?.type, 'type') : undefined;
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const where: Prisma.CsCaseWhereInput = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (q) {
      if (UUID_RE.test(q)) {
        where.OR = [{ id: q }, { orderId: q }];
      } else {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { requesterName: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.csCase.findMany({
        where,
        include: {
          csUser: true,
          notes: { orderBy: { createdAt: 'desc' } },
          evidences: { orderBy: { createdAt: 'desc' }, include: { file: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.csCase.count({ where }),
    ]);

    return {
      items: items.map((item: any) => this.toCaseRecord(item)),
      page: { page, pageSize, total },
    };
  }

  async getDetail(req: any, caseId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const item = await this.fetchCase(caseId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    return this.toCaseRecord(item);
  }

  async create(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');

    const hasType = this.hasOwn(body, 'type');
    const hasStatus = this.hasOwn(body, 'status');
    const hasPriority = this.hasOwn(body, 'priority');
    const type = hasType ? this.parseTypeStrict(body?.type, 'type') : 'FOLLOWUP';
    const status = hasStatus ? this.parseStatusStrict(body?.status, 'status') : 'OPEN';
    const priority = hasPriority ? this.parsePriorityStrict(body?.priority, 'priority') : undefined;
    const title = String(body?.title || '').trim() || DEFAULT_TITLES[type];
    const requesterName = String(body?.requesterName || '').trim() || '系统';
    const description = body?.description ? String(body.description).trim() : undefined;
    const orderId = body?.orderId ? String(body.orderId).trim() : undefined;
    const assigneeId = body?.assigneeId ? String(body.assigneeId).trim() : undefined;
    const hasDueAt = this.hasOwn(body, 'dueAt');
    const dueAt = hasDueAt ? this.parseDueAt(body?.dueAt, true) : null;
    const defaultDueDays = type === 'REFUND' ? 5 : 7;
    const normalizedDueAt = dueAt ?? new Date(Date.now() + defaultDueDays * 24 * 60 * 60 * 1000);

    if (orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: '订单不存在' });
    }

    let csUserId: string | undefined = undefined;
    if (assigneeId) {
      const user = await this.prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
      if (!user) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'assigneeId 不存在' });
      csUserId = assigneeId;
    }

    const created = await this.prisma.csCase.create({
      data: {
        orderId: orderId || null,
        csUserId: csUserId || null,
        title,
        type,
        status,
        requesterName,
        priority,
        description,
        dueAt: normalizedDueAt,
      },
      include: {
        csUser: true,
        notes: { orderBy: { createdAt: 'desc' } },
        evidences: { orderBy: { createdAt: 'desc' }, include: { file: true } },
      },
    });

    return this.toCaseRecord(created);
  }

  async assign(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const assigneeId = String(body?.assigneeId || '').trim();
    if (!assigneeId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'assigneeId is required' });

    await this.ensureCaseExists(caseId);

    const user = await this.prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
    if (!user) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'assigneeId 不存在' });

    const updated = await this.prisma.csCase.update({
      where: { id: caseId },
      data: { csUserId: assigneeId },
      include: {
        csUser: true,
        notes: { orderBy: { createdAt: 'desc' } },
        evidences: { orderBy: { createdAt: 'desc' }, include: { file: true } },
      },
    });
    return this.toCaseRecord(updated);
  }

  async updateStatus(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const status = this.normalizeStatus(body?.status);
    if (!status) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status 不合法' });

    await this.ensureCaseExists(caseId);

    const updated = await this.prisma.csCase.update({
      where: { id: caseId },
      data: { status },
      include: {
        csUser: true,
        notes: { orderBy: { createdAt: 'desc' } },
        evidences: { orderBy: { createdAt: 'desc' }, include: { file: true } },
      },
    });
    return this.toCaseRecord(updated);
  }

  async addNote(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const content = String(body?.note || '').trim();
    if (!content) {
      const item = await this.fetchCase(caseId);
      if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
      return this.toCaseRecord(item);
    }

    await this.ensureCaseExists(caseId);

    await this.prisma.csCaseNote.create({
      data: {
        caseId,
        authorId: req?.auth?.userId || 'admin',
        authorName: req?.auth?.nickname || '管理员',
        content,
      },
    });

    const updated = await this.fetchCase(caseId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    return this.toCaseRecord(updated);
  }

  async addEvidence(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const fileId = String(body?.fileId || '').trim();
    if (!fileId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'fileId is required' });

    await this.ensureCaseExists(caseId);

    const existing = await this.prisma.csCaseEvidence.findFirst({ where: { caseId, fileId } });
    if (!existing) {
      const file = await this.prisma.file.findUnique({ where: { id: fileId } });
      const fileName = body?.fileName ? String(body.fileName) : file?.fileName || fileId;
      const url = body?.url ? String(body.url) : file?.url;

      await this.prisma.csCaseEvidence.create({
        data: {
          caseId,
          fileId,
          fileName,
          url,
        },
      });
    }

    const updated = await this.fetchCase(caseId);
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    return this.toCaseRecord(updated);
  }

  async updateSla(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const dueAt = this.parseDueAt(body?.dueAt, true);
    if (!dueAt) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'dueAt is required' });

    await this.ensureCaseExists(caseId);

    const updated = await this.prisma.csCase.update({
      where: { id: caseId },
      data: { dueAt },
      include: {
        csUser: true,
        notes: { orderBy: { createdAt: 'desc' } },
        evidences: { orderBy: { createdAt: 'desc' }, include: { file: true } },
      },
    });

    return this.toCaseRecord(updated);
  }
}
