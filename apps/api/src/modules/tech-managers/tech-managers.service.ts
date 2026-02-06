import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { TECH_MANAGERS } from '../directory-store';

@Injectable()
export class TechManagersService {
  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  search(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const items = q ? TECH_MANAGERS.filter((t) => (t.nickname || '').includes(q)) : TECH_MANAGERS;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  getPublic(techManagerId: string) {
    const item = TECH_MANAGERS.find((t) => t.userId === techManagerId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '技术经理人不存在' });
    return item;
  }

  listAdmin(req: any, query: any) {
    this.ensureAdmin(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const items = q ? TECH_MANAGERS.filter((t) => (t.nickname || '').includes(q)) : TECH_MANAGERS;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  updateAdmin(req: any, techManagerId: string, body: any) {
    this.ensureAdmin(req);
    const idx = TECH_MANAGERS.findIndex((t) => t.userId === techManagerId);
    if (idx < 0) throw new NotFoundException({ code: 'NOT_FOUND', message: '技术经理人不存在' });
    TECH_MANAGERS[idx] = {
      ...TECH_MANAGERS[idx],
      intro: body?.intro ?? TECH_MANAGERS[idx].intro,
      serviceTags: body?.serviceTags ?? TECH_MANAGERS[idx].serviceTags,
      featuredRank: body?.featuredRank ?? TECH_MANAGERS[idx].featuredRank,
      featuredUntil: body?.featuredUntil ?? TECH_MANAGERS[idx].featuredUntil,
      regionCode: body?.regionCode ?? TECH_MANAGERS[idx].regionCode,
      rating: body?.rating ?? TECH_MANAGERS[idx].rating,
    };
    return TECH_MANAGERS[idx];
  }
}
