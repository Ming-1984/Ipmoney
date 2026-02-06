import { Injectable, NotFoundException } from '@nestjs/common';

import { ORGANIZATIONS } from '../directory-store';

@Injectable()
export class OrganizationsService {
  list(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const items = q ? ORGANIZATIONS.filter((o) => o.displayName.includes(q)) : ORGANIZATIONS;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  getById(orgUserId: string) {
    const item = ORGANIZATIONS.find((o) => o.userId === orgUserId);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '机构不存在' });
    return item;
  }
}
