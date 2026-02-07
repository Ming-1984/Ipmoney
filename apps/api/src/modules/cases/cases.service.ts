import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { requirePermission } from '../../common/permissions';
import { randomUUID } from 'crypto';

type CaseType = 'ORDER' | 'REFUND' | 'AUDIT_MATERIAL' | 'DISPUTE';
type CaseStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_MATERIAL' | 'RESOLVED' | 'CLOSED';
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
  orderId?: string;
  requesterName?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  description?: string;
  createdAt: string;
  updatedAt?: string;
  notes: CaseNote[];
  evidenceFiles?: { id: string; name: string; url?: string }[];
  dueAt?: string;
};

const CASES: CaseRecord[] = [
  {
    id: randomUUID(),
    title: '订金支付后买家要求退款',
    type: 'REFUND',
    status: 'IN_PROGRESS',
    orderId: 'e9032d03-9b23-40ba-84a3-ac681f21c41b',
    requesterName: '张女士',
    assigneeId: 'cs-001',
    assigneeName: '客服-王',
    priority: 'HIGH',
    description: '买家反馈材料不完整，申请退款。',
    createdAt: new Date().toISOString(),
    notes: [],
    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: randomUUID(),
    title: '审核补材料提醒',
    type: 'AUDIT_MATERIAL',
    status: 'WAITING_MATERIAL',
    orderId: undefined,
    requesterName: '运营',
    assigneeId: 'cs-002',
    assigneeName: '客服-李',
    priority: 'MEDIUM',
    description: '挂牌信息缺少权属证明，等待用户补齐。',
    createdAt: new Date().toISOString(),
    notes: [],
    dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const ASSIGNEES = [
  { id: 'cs-001', name: '客服-王' },
  { id: 'cs-002', name: '客服-李' },
  { id: 'op-001', name: '运营-周' },
];

@Injectable()
export class CasesService {
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private getSlaStatus(dueAt?: string): CaseSlaStatus | undefined {
    if (!dueAt) return undefined;
    return new Date(dueAt).getTime() < Date.now() ? 'OVERDUE' : 'ON_TIME';
  }

  list(req: any, query: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const q = String(query?.q || '').trim();
    const status = query?.status as CaseStatus | undefined;
    const type = query?.type as CaseType | undefined;
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));

    let items = CASES;
    if (q) {
      items = items.filter((c) =>
        [c.id, c.title, c.orderId, c.requesterName].some((v) => (v || '').includes(q)),
      );
    }
    if (status) items = items.filter((c) => c.status === status);
    if (type) items = items.filter((c) => c.type === type);

    const slice = items.slice((page - 1) * pageSize, page * pageSize).map((c) => ({
      ...c,
      slaStatus: this.getSlaStatus(c.dueAt),
    }));
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  getDetail(req: any, caseId: string) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const item = CASES.find((c) => c.id === caseId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    return { ...item, slaStatus: this.getSlaStatus(item.dueAt) };
  }

  create(req: any, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const now = Date.now();
    const defaultDueDays = body?.type === 'AUDIT_MATERIAL' ? 3 : body?.type === 'REFUND' ? 5 : 7;
    const item: CaseRecord = {
      id: randomUUID(),
      title: String(body?.title || '新工单'),
      type: (body?.type || 'ORDER') as CaseType,
      status: 'NEW',
      orderId: body?.orderId,
      requesterName: body?.requesterName || '系统',
      assigneeId: body?.assigneeId,
      assigneeName: ASSIGNEES.find((a) => a.id === body?.assigneeId)?.name,
      priority: body?.priority || 'MEDIUM',
      description: body?.description,
      createdAt: new Date().toISOString(),
      notes: [],
      evidenceFiles: [],
      dueAt: body?.dueAt || new Date(now + defaultDueDays * 24 * 60 * 60 * 1000).toISOString(),
    };
    CASES.unshift(item);
    return item;
  }

  assign(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const item = CASES.find((c) => c.id === caseId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    item.assigneeId = body?.assigneeId || item.assigneeId;
    item.assigneeName = ASSIGNEES.find((a) => a.id === item.assigneeId)?.name || item.assigneeName;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  updateStatus(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const item = CASES.find((c) => c.id === caseId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    if (body?.status) item.status = body.status as CaseStatus;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  addNote(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const item = CASES.find((c) => c.id === caseId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    const note: CaseNote = {
      id: randomUUID(),
      authorId: req?.auth?.userId || 'admin',
      authorName: req?.auth?.nickname || '管理员',
      content: String(body?.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    if (!note.content) return item;
    item.notes.unshift(note);
    item.updatedAt = new Date().toISOString();
    return item;
  }

  addEvidence(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const item = CASES.find((c) => c.id === caseId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    const fileId = String(body?.fileId || '').trim();
    if (!fileId) return item;
    const record = {
      id: fileId,
      name: String(body?.fileName || fileId),
      url: body?.url ? String(body.url) : undefined,
    };
    item.evidenceFiles = item.evidenceFiles || [];
    item.evidenceFiles.unshift(record);
    item.updatedAt = new Date().toISOString();
    return item;
  }

  updateSla(req: any, caseId: string, body: any) {
    this.ensureAuth(req);
    requirePermission(req, 'case.manage');
    const item = CASES.find((c) => c.id === caseId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '工单不存在' });
    if (body?.dueAt) item.dueAt = String(body.dueAt);
    item.updatedAt = new Date().toISOString();
    return { ...item, slaStatus: this.getSlaStatus(item.dueAt) };
  }
}

