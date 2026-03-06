import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'OFF_SHELF';
type RelatedPatent = { name: string; patentNo: string };

const STATUS_SET = new Set<AnnouncementStatus>(['DRAFT', 'PUBLISHED', 'OFF_SHELF']);

function normalizeTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeRelatedPatents(input: unknown): RelatedPatent[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      name: String((item as any)?.name || '').trim(),
      patentNo: String((item as any)?.patentNo || '').trim(),
    }))
    .filter((item) => item.name || item.patentNo);
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private hasOwn(input: unknown, key: string): boolean {
    return input !== null && input !== undefined && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parseStatus(value: unknown, fieldName: string): AnnouncementStatus {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!STATUS_SET.has(normalized as AnnouncementStatus)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return normalized as AnnouncementStatus;
  }

  private toDto(item: any) {
    const createdAt = item.createdAt ? item.createdAt.toISOString() : new Date().toISOString();
    const publishedAt = item.publishedAt ? item.publishedAt.toISOString() : null;
    const tags = Array.isArray(item.tagsJson) ? item.tagsJson.filter((t: any) => typeof t === 'string') : [];
    const relatedPatents = Array.isArray(item.relatedPatentsJson)
      ? item.relatedPatentsJson.filter((p: any) => p && (p.name || p.patentNo))
      : [];
    return {
      id: item.id,
      title: item.title,
      summary: item.summary ?? null,
      content: item.content ?? null,
      publisherName: item.publisherName ?? null,
      issueNo: item.issueNo ?? null,
      sourceUrl: item.sourceUrl ?? null,
      tags,
      relatedPatents,
      status: item.status ?? 'PUBLISHED',
      createdAt,
      publishedAt: publishedAt ?? createdAt,
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : createdAt,
    };
  }

  async list(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where: { status: 'PUBLISHED' as any },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.announcement.count({ where: { status: 'PUBLISHED' as any } }),
    ]);
    return { items: items.map((item: any) => this.toDto(item)), page: { page, pageSize, total } };
  }

  async getById(id: string) {
    const item = await this.prisma.announcement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });
    if (item.status && item.status !== 'PUBLISHED') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });
    }
    return this.toDto(item);
  }

  async adminList(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const where: any = {};
    if (query?.status && STATUS_SET.has(String(query.status).toUpperCase() as AnnouncementStatus)) {
      where.status = String(query.status).toUpperCase();
    }
    if (query?.q) {
      const q = String(query.q).trim();
      if (q) where.OR = [{ title: { contains: q } }, { summary: { contains: q } }];
    }
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items: items.map((item: any) => this.toDto(item)), page: { page, pageSize, total } };
  }

  async adminCreate(request: any, payload: any) {
    const title = String(payload?.title || '').trim();
    if (!title) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });

    let status: AnnouncementStatus = 'DRAFT';
    if (this.hasOwn(payload, 'status')) {
      status = this.parseStatus(payload?.status, 'status');
    }
    const now = new Date();
    const created = await this.prisma.announcement.create({
      data: {
        title,
        summary: payload?.summary ? String(payload.summary).trim() : null,
        content: payload?.content ? String(payload.content).trim() : null,
        publisherName: payload?.publisherName ? String(payload.publisherName).trim() : null,
        issueNo: payload?.issueNo ? String(payload.issueNo).trim() : null,
        sourceUrl: payload?.sourceUrl ? String(payload.sourceUrl).trim() : null,
        tagsJson: normalizeTags(payload?.tags),
        relatedPatentsJson: normalizeRelatedPatents(payload?.relatedPatents),
        status: status as any,
        publishedAt: status === 'PUBLISHED' ? now : null,
      },
    });

    void this.audit.log({
      actorUserId: request?.auth?.userId,
      action: 'ANNOUNCEMENT_CREATE',
      targetType: 'ANNOUNCEMENT',
      targetId: created.id,
      afterJson: { status, title: created.title },
    });
    return this.toDto(created);
  }

  async adminUpdate(request: any, id: string, payload: any) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });

    const existingStatus = STATUS_SET.has(String(existing.status).toUpperCase() as AnnouncementStatus)
      ? (String(existing.status).toUpperCase() as AnnouncementStatus)
      : 'DRAFT';
    let status = existingStatus;
    if (this.hasOwn(payload, 'status')) {
      status = this.parseStatus(payload?.status, 'status');
    }
    const next: any = {
      summary: payload?.summary !== undefined ? String(payload.summary || '').trim() || null : undefined,
      content: payload?.content !== undefined ? String(payload.content || '').trim() || null : undefined,
      publisherName:
        payload?.publisherName !== undefined ? String(payload.publisherName || '').trim() || null : undefined,
      issueNo: payload?.issueNo !== undefined ? String(payload.issueNo || '').trim() || null : undefined,
      sourceUrl: payload?.sourceUrl !== undefined ? String(payload.sourceUrl || '').trim() || null : undefined,
    };
    if (this.hasOwn(payload, 'title')) {
      const nextTitle = String(payload?.title || '').trim();
      if (!nextTitle) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'title is required' });
      next.title = nextTitle;
    }
    if (payload?.tags !== undefined) next.tagsJson = normalizeTags(payload.tags);
    if (payload?.relatedPatents !== undefined) next.relatedPatentsJson = normalizeRelatedPatents(payload.relatedPatents);
    if (status !== existingStatus) {
      next.status = status as any;
      if (status === 'PUBLISHED' && !existing.publishedAt) next.publishedAt = new Date();
    }

    const updated = await this.prisma.announcement.update({ where: { id }, data: next });
    void this.audit.log({
      actorUserId: request?.auth?.userId,
      action: 'ANNOUNCEMENT_UPDATE',
      targetType: 'ANNOUNCEMENT',
      targetId: updated.id,
      beforeJson: { status: existing.status, title: existing.title },
      afterJson: { status: updated.status, title: updated.title },
    });
    return this.toDto(updated);
  }

  async adminPublish(request: any, id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { status: 'PUBLISHED' as any, publishedAt: existing.publishedAt ?? new Date() },
    });
    void this.audit.log({
      actorUserId: request?.auth?.userId,
      action: 'ANNOUNCEMENT_PUBLISH',
      targetType: 'ANNOUNCEMENT',
      targetId: updated.id,
      beforeJson: { status: existing.status },
      afterJson: { status: updated.status },
    });
    return this.toDto(updated);
  }

  async adminOffShelf(request: any, id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { status: 'OFF_SHELF' as any },
    });
    void this.audit.log({
      actorUserId: request?.auth?.userId,
      action: 'ANNOUNCEMENT_OFF_SHELF',
      targetType: 'ANNOUNCEMENT',
      targetId: updated.id,
      beforeJson: { status: existing.status },
      afterJson: { status: updated.status },
    });
    return this.toDto(updated);
  }

  async adminDelete(request: any, id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });
    await this.prisma.announcement.delete({ where: { id } });
    void this.audit.log({
      actorUserId: request?.auth?.userId,
      action: 'ANNOUNCEMENT_DELETE',
      targetType: 'ANNOUNCEMENT',
      targetId: id,
      beforeJson: { status: existing.status, title: existing.title },
    });
    return { ok: true };
  }
}
