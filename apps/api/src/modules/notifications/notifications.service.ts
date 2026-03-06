import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private toDto(item: any) {
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      source: item.source,
      time: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
    };
  }

  async create(params: {
    userId: string | null | undefined;
    title: string;
    summary: string;
    source?: string;
    kind?: 'system' | 'cs';
  }) {
    const userId = params.userId ? String(params.userId) : '';
    if (!userId || !params.title) return null;
    return await this.prisma.notification.create({
      data: {
        userId,
        kind: params.kind ?? 'system',
        title: params.title,
        summary: params.summary || '',
        source: params.source ?? 'SYSTEM',
      },
    });
  }

  async createMany(params: {
    userIds: Array<string | null | undefined>;
    title: string;
    summary: string;
    source?: string;
    kind?: 'system' | 'cs';
  }) {
    const userIds = Array.from(new Set((params.userIds || []).filter(Boolean).map((id) => String(id))));
    if (!userIds.length || !params.title) return { count: 0 };
    return await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: params.kind ?? 'system',
        title: params.title,
        summary: params.summary || '',
        source: params.source ?? 'SYSTEM',
      })),
    });
  }

  async list(req: any, query: any) {
    this.ensureAuth(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const where = { userId: req.auth.userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items: items.map((item: any) => this.toDto(item)), page: { page, pageSize, total } };
  }

  async getById(req: any, id: string) {
    this.ensureAuth(req);
    const item = await this.prisma.notification.findFirst({ where: { id, userId: req.auth.userId } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '通知不存在' });
    return this.toDto(item);
  }
}
