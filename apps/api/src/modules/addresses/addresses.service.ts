import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

type Address = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  regionCode?: string | null;
  addressLine: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

const ADDRESS_BOOK = new Map<string, Address[]>();

@Injectable()
export class AddressesService {
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  list(req: any) {
    this.ensureAuth(req);
    return ADDRESS_BOOK.get(req.auth.userId) || [];
  }

  create(req: any, body: any) {
    this.ensureAuth(req);
    const now = new Date().toISOString();
    const list = ADDRESS_BOOK.get(req.auth.userId) || [];
    const item: Address = {
      id: randomUUID(),
      userId: req.auth.userId,
      name: String(body?.name || '收货人'),
      phone: String(body?.phone || ''),
      regionCode: body?.regionCode ?? null,
      addressLine: String(body?.addressLine || ''),
      isDefault: Boolean(body?.isDefault),
      createdAt: now,
      updatedAt: now,
    };
    if (item.isDefault) {
      list.forEach((it) => (it.isDefault = false));
    }
    list.unshift(item);
    ADDRESS_BOOK.set(req.auth.userId, list);
    return item;
  }

  update(req: any, addressId: string, body: any) {
    this.ensureAuth(req);
    const list = ADDRESS_BOOK.get(req.auth.userId) || [];
    const idx = list.findIndex((a) => a.id === addressId);
    if (idx < 0) throw new NotFoundException({ code: 'NOT_FOUND', message: '地址不存在' });
    const item = list[idx];
    Object.assign(item, {
      name: body?.name ?? item.name,
      phone: body?.phone ?? item.phone,
      regionCode: body?.regionCode ?? item.regionCode,
      addressLine: body?.addressLine ?? item.addressLine,
    });
    if (body?.isDefault) {
      list.forEach((it) => (it.isDefault = false));
      item.isDefault = true;
    }
    item.updatedAt = new Date().toISOString();
    list[idx] = item;
    ADDRESS_BOOK.set(req.auth.userId, list);
    return item;
  }

  remove(req: any, addressId: string) {
    this.ensureAuth(req);
    const list = ADDRESS_BOOK.get(req.auth.userId) || [];
    const idx = list.findIndex((a) => a.id === addressId);
    if (idx < 0) throw new NotFoundException({ code: 'NOT_FOUND', message: '地址不存在' });
    list.splice(idx, 1);
    ADDRESS_BOOK.set(req.auth.userId, list);
    return { ok: true };
  }
}
