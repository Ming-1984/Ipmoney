import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { createArtwork, getArtwork, listArtworks, seedIfEmpty, updateArtwork } from '../content-store';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

@Injectable()
export class ArtworksService {
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
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
    return createArtwork(req.auth.userId, body);
  }

  update(req: any, artworkId: string, body: any) {
    this.ensureAuth(req);
    const item = getArtwork(artworkId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    }
    return updateArtwork(artworkId, body);
  }

  submit(req: any, artworkId: string) {
    this.ensureAuth(req);
    const item = getArtwork(artworkId);
    if (!item || item.ownerId !== req.auth.userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    }
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
    const items = listArtworks().filter((d) => d.status === 'ACTIVE' && d.auditStatus === 'APPROVED');
    const filtered = q ? items.filter((d) => d.title.includes(q)) : items;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: filtered.length } };
  }

  getPublic(artworkId: string) {
    seedIfEmpty();
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
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
    let items = listArtworks();
    if (auditStatus) items = items.filter((d) => d.auditStatus === auditStatus);
    if (status) items = items.filter((d) => d.status === status);
    if (q) items = items.filter((d) => d.title.includes(q));
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  adminApprove(req: any, artworkId: string) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    return updateArtwork(artworkId, { auditStatus: 'APPROVED', status: item.status === 'DRAFT' ? 'ACTIVE' : item.status });
  }

  adminReject(req: any, artworkId: string, _body: any) {
    this.ensureAdmin(req);
    const item = getArtwork(artworkId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '作品不存在' });
    return updateArtwork(artworkId, { auditStatus: 'REJECTED' });
  }
}
