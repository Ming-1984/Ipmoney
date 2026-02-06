import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

type Announcement = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  createdAt: string;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: randomUUID(),
    title: '广东工业大学专利开发许可清单(202601)',
    summary: '专利许可专题清单已发布，请查阅详情。',
    content: '本期许可清单包含若干高校成果，欢迎咨询平台客服获取详细材料。',
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    title: '平台系统维护通知',
    summary: '将于周末进行系统维护，服务可能短暂不可用。',
    content: '维护窗口预计 2 小时，请提前安排业务操作。',
    createdAt: new Date().toISOString(),
  },
];

@Injectable()
export class AnnouncementsService {
  list(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const items = ANNOUNCEMENTS;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  getById(id: string) {
    const item = ANNOUNCEMENTS.find((it) => it.id === id);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '公告不存在' });
    return item;
  }
}
