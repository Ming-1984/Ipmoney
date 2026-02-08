import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addAuditLog } from '../audit-store';
import { createArtwork, getArtwork, listArtworks, seedIfEmpty, updateArtwork } from '../content-store';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };
@Injectable()
export class ArtworksService {
  constructor(private readonly audit: AuditLogService, private readonly prisma: PrismaService) {}
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private normalizeFileIds(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map((v) => String(v || '').trim()).filter((v) => v.length > 0);
    }
    const text = String(input || '').trim();
    return text ? [text] : [];
  }

  private async assertOwnedFiles(userId: string, fileIds: string[], label: string) {
    if (!fileIds || fileIds.length === 0) return;
    const files = await this.prisma.file.findMany({ where: { id: { in: fileIds } } });
    if (files.length !== fileIds.length) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${label} is invalid` });
    }
    const notOwned = files.filter((f: { ownerId?: string | null }) => String(f.ownerId || '') !== userId);
    if (notOwned.length > 0) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private validateArtworkForSubmit(item: any) {
    const errors: string[] = [];
    if (!item?.title) errors.push('title');
    if (!item?.creatorName) errors.push('creatorName');
    if (!item?.certificateNo) errors.push('certificateNo');
    if (!item?.creationDate && !item?.creationYear) errors.push('creationDate');
    if (!item?.summary && !item?.description) errors.push('summary');
    const media = Array.isArray(item?.media) ? item.media : [];
    if (media.length === 0) errors.push('media');
    if (errors.length > 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `missing fields: ${errors.join(', ')}` });
    }
  }

  listMine(req: any, query: any): Paged<any> {
    this.ensureAuth(req);
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const items = listArtworks().filter((d) => d.ownerId === req.auth.userId);
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  getMine(req: any, artworkId: string) {
    this.ensureAuth(req);
    const item = getArtwork(artworkId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    }
    return item;
  }

  create(req: any, body: any) {
    this.ensureAuth(req);
    const payload = { ...(body || {}), source: 'USER', status: undefined, auditStatus: undefined };
    return createArtwork(req.auth.userId, payload);
  }

  update(req: any, artworkId: string, body: any) {
    this.ensureAuth(req);
    const item = getArtwork(artworkId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    }
    const payload: any = { ...(body || {}) };
    delete payload.source;
    delete payload.status;
    delete payload.auditStatus;
    delete payload.ownerId;
    delete payload.publisherUserId;
    return updateArtwork(artworkId, payload);
  }

  async submit(req: any, artworkId: string) {
    this.ensureAuth(req);
    const item = getArtwork(artworkId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    }
    this.validateArtworkForSubmit(item);
    const certificateFileIds = this.normalizeFileIds(item?.certificateFileIds);
    await this.assertOwnedFiles(req.auth.userId, certificateFileIds, 'certificateFileIds');
    return updateArtwork(artworkId, { status: 'ACTIVE', auditStatus: 'PENDING' });
  }

  offShelf(req: any, artworkId: string, _body: any) {
    this.ensureAuth(req);
    const item = getArtwork(artworkId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    }
    return updateArtwork(artworkId, { status: 'OFF_SHELF' });
  }

  search(query: any): Paged<any> {
    seedIfEmpty();
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const category = String(query?.category || query?.artworkCategory || '').trim().toUpperCase();
    const calligraphyScript = String(query?.calligraphyScript || '').trim().toUpperCase();
    const paintingGenre = String(query?.paintingGenre || '').trim().toUpperCase();
    const creator = String(query?.creator || query?.creatorName || '').trim();
    const priceType = String(query?.priceType || '').trim().toUpperCase();
    const regionCode = String(query?.regionCode || '').trim();
    const sortBy = String(query?.sortBy || 'NEWEST').trim().toUpperCase();

    const parseNumber = (value: any) => {
      if (value === undefined || value === null || String(value).trim() === '') return undefined;
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };

    const creationYearStart = parseNumber(query?.creationYearStart);
    const creationYearEnd = parseNumber(query?.creationYearEnd);
    const priceMin = parseNumber(query?.priceMin);
    const priceMax = parseNumber(query?.priceMax);
    const depositMin = parseNumber(query?.depositMin);
    const depositMax = parseNumber(query?.depositMax);

    const items = listArtworks().filter((d) => d.status === 'ACTIVE' && d.auditStatus === 'APPROVED');
    const filtered = items.filter((d) => {
      if (q) {
        const qLower = q.toLowerCase();
        const title = String(d.title || '').toLowerCase();
        const summary = String(d.summary || '').toLowerCase();
        const creatorName = String(d.creatorName || '').toLowerCase();
        if (!title.includes(qLower) && !summary.includes(qLower) && !creatorName.includes(qLower)) return false;
      }
      if (category && String(d.category || '').toUpperCase() !== category) return false;
      if (calligraphyScript && String(d.calligraphyScript || '').toUpperCase() !== calligraphyScript) return false;
      if (paintingGenre && String(d.paintingGenre || '').toUpperCase() !== paintingGenre) return false;
      if (creator) {
        const creatorName = String(d.creatorName || '').toLowerCase();
        if (!creatorName.includes(creator.toLowerCase())) return false;
      }
      if (regionCode && String(d.regionCode || '') !== regionCode) return false;
      if (priceType && String(d.priceType || '').toUpperCase() !== priceType) return false;
      if (priceMin !== undefined || priceMax !== undefined) {
        const price = typeof d.priceAmountFen === 'number' ? d.priceAmountFen : undefined;
        if (price === undefined) return false;
        if (priceMin !== undefined && price < priceMin) return false;
        if (priceMax !== undefined && price > priceMax) return false;
      }
      if (depositMin !== undefined || depositMax !== undefined) {
        const deposit = typeof d.depositAmountFen === 'number' ? d.depositAmountFen : undefined;
        if (deposit === undefined) return false;
        if (depositMin !== undefined && deposit < depositMin) return false;
        if (depositMax !== undefined && deposit > depositMax) return false;
      }
      if (creationYearStart !== undefined || creationYearEnd !== undefined) {
        const yearText = String(d.creationYear || '').trim();
        const yearFallback = String(d.creationDate || '').slice(0, 4);
        const yearValue = Number(yearText || yearFallback);
        if (!Number.isFinite(yearValue)) return false;
        if (creationYearStart !== undefined && yearValue < creationYearStart) return false;
        if (creationYearEnd !== undefined && yearValue > creationYearEnd) return false;
      }
      return true;
    });

    const priceValue = (d: any) => (typeof d.priceAmountFen === 'number' ? d.priceAmountFen : Number.MAX_SAFE_INTEGER);
    const sorted = filtered.slice();
    if (sortBy === 'PRICE_ASC') {
      sorted.sort((a, b) => priceValue(a) - priceValue(b));
    } else if (sortBy === 'PRICE_DESC') {
      sorted.sort((a, b) => priceValue(b) - priceValue(a));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const slice = sorted.slice((page - 1) * pageSize, page * pageSize).map((item) => this.toPublic(item));
    return { items: slice, page: { page, pageSize, total: filtered.length } };
  }

  getPublic(artworkId: string) {
    seedIfEmpty();
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    return this.toPublic(item);
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
    let items = listArtworks();
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
    return createArtwork(ownerId || req.auth.userId, payload);
  }

  adminGetById(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return item;
  }

  adminUpdate(req: any, artworkId: string, body: any) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    const payload = { ...(body || {}) };
    if (body?.publisherUserId) payload.ownerId = body.publisherUserId;
    return updateArtwork(artworkId, payload);
  }

  adminPublish(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return updateArtwork(artworkId, { status: 'ACTIVE', auditStatus: 'APPROVED' });
  }

  adminOffShelf(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'artwork not found' });
    return updateArtwork(artworkId, { status: 'OFF_SHELF' });
  }

  adminApprove(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    addAuditLog('ARTWORK', artworkId, 'APPROVE', undefined, req?.auth?.userId || undefined);
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ARTWORK_APPROVE',
      targetType: 'ARTWORK',
      targetId: artworkId,
      afterJson: { auditStatus: 'APPROVED' },
    });
    return updateArtwork(artworkId, {
      auditStatus: 'APPROVED',
      status: item.status === 'DRAFT' ? 'ACTIVE' : item.status,
    });
  }

  adminReject(req: any, artworkId: string, _body: any) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    addAuditLog('ARTWORK', artworkId, 'REJECT', _body?.reason, req?.auth?.userId || undefined);
    void this.audit.log({
      actorUserId: req.auth.userId,
      action: 'ARTWORK_REJECT',
      targetType: 'ARTWORK',
      targetId: artworkId,
      afterJson: { auditStatus: 'REJECTED', reason: _body?.reason },
    });
    return updateArtwork(artworkId, { auditStatus: 'REJECTED' });
  }

  private toPublic(item: any) {
    const { certificateNo, certificateFileIds, ...rest } = item || {};
    return rest;
  }
}
