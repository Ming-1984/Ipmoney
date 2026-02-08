import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit-log.service';
import { addAuditLog } from '../audit-store';
import { createAchievement, getAchievement, listAchievements, seedIfEmpty, updateAchievement } from '../content-store';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

@Injectable()
export class AchievementsService {
  constructor(private readonly audit: AuditLogService) {}
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  listMine(req: any, query: any): Paged<any> {
    this.ensureAuth(req);
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const items = listAchievements().filter((d) => d.ownerId === req.auth.userId);
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  getMine(req: any, achievementId: string) {
    this.ensureAuth(req);
    const item = getAchievement(achievementId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    }
    return item;
  }

  create(req: any, body: any) {
    this.ensureAuth(req);
    const payload = { ...(body || {}), source: 'USER', status: undefined, auditStatus: undefined };
    return createAchievement(req.auth.userId, payload);
  }

  update(req: any, achievementId: string, body: any) {
    this.ensureAuth(req);
    const item = getAchievement(achievementId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    }
    const payload: any = { ...(body || {}) };
    delete payload.source;
    delete payload.status;
    delete payload.auditStatus;
    delete payload.ownerId;
    delete payload.publisherUserId;
    return updateAchievement(achievementId, payload);
  }

  submit(req: any, achievementId: string) {
    this.ensureAuth(req);
    const item = getAchievement(achievementId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    }
    return updateAchievement(achievementId, { status: 'ACTIVE', auditStatus: 'PENDING' });
  }

  offShelf(req: any, achievementId: string, _body: any) {
    this.ensureAuth(req);
    const item = getAchievement(achievementId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    }
    return updateAchievement(achievementId, { status: 'OFF_SHELF' });
  }

  search(query: any): Paged<any> {
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const items = listAchievements().filter((d) => d.status === 'ACTIVE' && d.auditStatus === 'APPROVED');
    const filtered = q ? items.filter((d) => d.title.includes(q)) : items;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: filtered.length } };
  }

  getPublic(achievementId: string) {
    seedIfEmpty();
    const item = getAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    return item;
  }

  listAdmin(req: any, query: any): Paged<any> {
    this.ensureAdmin(req);
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const auditStatus = String(query?.auditStatus || '').trim();
    const status = String(query?.status || '').trim();
    const q = String(query?.q || '').trim();
    const source = String(query?.source || '').trim().toUpperCase();
    let items = listAchievements();
    if (auditStatus) items = items.filter((d) => d.auditStatus === auditStatus);
    if (status) items = items.filter((d) => d.status === status);
    if (q) items = items.filter((d) => d.title.includes(q));
    if (source) items = items.filter((d) => String(d.source || '').toUpperCase() === source);
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  adminCreate(req: any, body: any) {
    this.ensureAdmin(req);
    const sourceInput = String(body?.source || '').trim().toUpperCase();
    const source = ['USER', 'ADMIN', 'PLATFORM'].includes(sourceInput) ? sourceInput : 'ADMIN';
    const ownerId = String(body?.publisherUserId || body?.ownerId || req?.auth?.userId || '').trim();
    const payload = { ...(body || {}), source };
    return createAchievement(ownerId || req.auth.userId, payload);
  }

  adminGetById(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = getAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    return item;
  }

  adminUpdate(req: any, achievementId: string, body: any) {
    this.ensureAdmin(req);
    const item = getAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    const payload = { ...(body || {}) };
    if (body?.publisherUserId) payload.ownerId = body.publisherUserId;
    return updateAchievement(achievementId, payload);
  }

  adminPublish(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = getAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    return updateAchievement(achievementId, { status: 'ACTIVE', auditStatus: 'APPROVED' });
  }

  adminOffShelf(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = getAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
    return updateAchievement(achievementId, { status: 'OFF_SHELF' });
  }

  adminApprove(req: any, achievementId: string) {
    this.ensureAdmin(req);
    const item = getAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    addAuditLog('ACHIEVEMENT', achievementId, 'APPROVE', undefined, req?.auth?.userId || undefined);
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ACHIEVEMENT_APPROVE',
      targetType: 'ACHIEVEMENT',
      targetId: achievementId,
      afterJson: { auditStatus: 'APPROVED' },
    });
    return updateAchievement(achievementId, {
      auditStatus: 'APPROVED',
      status: item.status === 'DRAFT' ? 'ACTIVE' : item.status,
    });
  }

  adminReject(req: any, achievementId: string, _body: any) {
    this.ensureAdmin(req);
    const item = getAchievement(achievementId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '成果不存在' });
    addAuditLog('ACHIEVEMENT', achievementId, 'REJECT', _body?.reason, req?.auth?.userId || undefined);
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ACHIEVEMENT_REJECT',
      targetType: 'ACHIEVEMENT',
      targetId: achievementId,
      afterJson: { auditStatus: 'REJECTED', reason: _body?.reason },
    });
    return updateAchievement(achievementId, { auditStatus: 'REJECTED' });
  }
}