import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

type Notification = {
  id: string;
  kind: 'system' | 'cs';
  title: string;
  summary: string;
  source: string;
  time: string;
};

const NOTIFICATIONS: Notification[] = [
  {
    id: randomUUID(),
    kind: 'system',
    title: '订单状态更新',
    summary: '您的订单已进入尾款支付阶段。',
    source: '交易通知',
    time: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    kind: 'cs',
    title: '客服提醒',
    summary: '请补充权属材料以完成审核。',
    source: '平台客服',
    time: new Date().toISOString(),
  },
];

@Injectable()
export class NotificationsService {
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  list(req: any, query: any) {
    this.ensureAuth(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const items = NOTIFICATIONS;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice, page: { page, pageSize, total: items.length } };
  }

  getById(req: any, id: string) {
    this.ensureAuth(req);
    const item = NOTIFICATIONS.find((it) => it.id === id);
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: '通知不存在' });
    return item;
  }
}
