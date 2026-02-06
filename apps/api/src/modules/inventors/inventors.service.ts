import { Injectable } from '@nestjs/common';

import { INVENTORS } from '../directory-store';

@Injectable()
export class InventorsService {
  search(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const items = q ? INVENTORS.filter((i) => i.inventorName.includes(q)) : INVENTORS;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }
}
