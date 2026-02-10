import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: any) {
    const createdAt = item.createdAt ? item.createdAt.toISOString() : new Date().toISOString();
    return {
      id: item.id,
      title: item.title,
      summary: item.summary ?? null,
      content: item.content ?? null,
      createdAt,
      publishedAt: createdAt,
    };
  }

  async list(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.announcement.count(),
    ]);
    return { items: items.map((item: any) => this.toDto(item)), page: { page, pageSize, total } };
  }

  async getById(id: string) {
    const item = await this.prisma.announcement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });
    return this.toDto(item);
  }
}
