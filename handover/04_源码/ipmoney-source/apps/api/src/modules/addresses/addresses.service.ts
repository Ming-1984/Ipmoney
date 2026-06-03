import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private hasOwn(body: any, key: string) {
    return Object.prototype.hasOwnProperty.call(body || {}, key);
  }

  private parseNullableRegionCodeStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private toDto(item: any) {
    return {
      id: item.id,
      userId: item.userId,
      name: item.name,
      phone: item.phone,
      regionCode: item.regionCode ?? null,
      addressLine: item.addressLine,
      isDefault: Boolean(item.isDefault),
      createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  async list(req: any) {
    this.ensureAuth(req);
    const items = await this.prisma.address.findMany({
      where: { userId: req.auth.userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return items.map((item: any) => this.toDto(item));
  }

  async create(req: any, body: any) {
    this.ensureAuth(req);
    const userId = req.auth.userId;
    const isDefault = Boolean(body?.isDefault);
    const name = String(body?.name || '收货人');
    const phone = String(body?.phone || '');
    const addressLine = String(body?.addressLine || '');
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : null;

    return await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      const item = await tx.address.create({
        data: {
          userId,
          name,
          phone,
          regionCode,
          addressLine,
          isDefault,
        },
      });
      return this.toDto(item);
    });
  }

  async update(req: any, addressId: string, body: any) {
    this.ensureAuth(req);
    const normalizedAddressId = this.parseUuidStrict(addressId, 'addressId');
    const userId = req.auth.userId;
    const existing = await this.prisma.address.findFirst({ where: { id: normalizedAddressId, userId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: '地址不存在' });

    const hasIsDefault = body?.isDefault !== undefined;
    const nextIsDefault = hasIsDefault ? Boolean(body?.isDefault) : existing.isDefault;
    const hasRegionCode = this.hasOwn(body, 'regionCode');
    const regionCode = hasRegionCode ? this.parseNullableRegionCodeStrict(body?.regionCode, 'regionCode') : existing.regionCode;

    return await this.prisma.$transaction(async (tx) => {
      if (hasIsDefault && nextIsDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      const updated = await tx.address.update({
        where: { id: normalizedAddressId },
        data: {
          name: body?.name ?? existing.name,
          phone: body?.phone ?? existing.phone,
          regionCode,
          addressLine: body?.addressLine ?? existing.addressLine,
          isDefault: nextIsDefault,
        },
      });
      return this.toDto(updated);
    });
  }

  async remove(req: any, addressId: string) {
    this.ensureAuth(req);
    const normalizedAddressId = this.parseUuidStrict(addressId, 'addressId');
    const removed = await this.prisma.address.deleteMany({
      where: { id: normalizedAddressId, userId: req.auth.userId },
    });
    if (!removed.count) throw new NotFoundException({ code: 'NOT_FOUND', message: '地址不存在' });
    return { ok: true };
  }
}


