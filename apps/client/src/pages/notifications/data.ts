export type NotificationKind = 'system' | 'cs';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  summary: string;
  time: string;
  source: string;
  content: string[];
  related?: {
    label: string;
    url: string;
  };
};

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'sys-20260202-01',
    kind: 'system',
    title: '订单进度更新',
    summary: '订金已支付，等待签署合同。',
    time: '2026-02-02T09:30:00+08:00',
    source: '交易通知',
    content: ['您的订单已完成订金支付。请尽快完成合同签署流程，以免影响后续交易。', '如需查看订单详情，请点击下方入口。'],
    related: { label: '查看订单详情', url: '/pages/orders/detail/index?id=O20260202001' },
  },
  {
    id: 'sys-20260201-02',
    kind: 'system',
    title: '审核结果通知',
    summary: '主体认证已通过，可正常发布与交易。',
    time: '2026-02-01T15:12:00+08:00',
    source: '平台审核',
    content: ['您的主体认证已审核通过。现在可以正常发布信息与进行交易操作。'],
    related: { label: '完善资料设置', url: '/pages/profile/edit/index' },
  },
  {
    id: 'sys-20260130-03',
    kind: 'system',
    title: '平台公告',
    summary: '春节期间客服与审核时间调整。',
    time: '2026-01-30T10:00:00+08:00',
    source: '平台公告',
    content: ['春节期间客服与审核时间调整为 9:30-18:00，非工作时间留言将在次日处理。'],
  },
  {
    id: 'cs-20260202-01',
    kind: 'cs',
    title: '客服回复',
    summary: '已为您更新专利材料清单。',
    time: '2026-02-02T11:05:00+08:00',
    source: '客服助手',
    content: ['已为您更新专利材料清单，请根据清单补充材料后提交。', '如有疑问请电话联系客服。'],
    related: { label: '电话联系客服', url: '/pages/support/contact/index' },
  },
  {
    id: 'cs-20260201-01',
    kind: 'cs',
    title: '咨询提醒',
    summary: '客服已受理您的问题，将在 24 小时内回复。',
    time: '2026-02-01T09:20:00+08:00',
    source: '客服中心',
    content: ['您的问题已提交成功，客服将在 24 小时内回复。紧急问题请电话联系客服。'],
    related: { label: '电话联系客服', url: '/pages/support/contact/index' },
  },
];

export function getNotificationById(id?: string | null): NotificationItem | undefined {
  if (!id) return undefined;
  return NOTIFICATIONS.find((item) => item.id === id);
}
