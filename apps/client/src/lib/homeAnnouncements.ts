import { IS_PROD_DEPLOY } from '../constants';
import { apiGet } from './api';

export type PublicHomeAnnouncementItem = {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  linkUrl: string | null;
  pinned: boolean;
  order: number;
  publishedAt: string | null;
};

export type PublicHomeAnnouncementFeed = {
  generatedAt: string;
  items: PublicHomeAnnouncementItem[];
};

const HOME_ANNOUNCEMENTS_MAX = 6;

function mockAnnouncements(): PublicHomeAnnouncementItem[] {
  return [
    {
      id: 'mock-home-announcement',
      title: '平台公告示例：公告位已启用',
      content: '当前暂无已发布公告，运营可在后台配置并发布公告内容。',
      tag: null,
      linkUrl: null,
      pinned: true,
      order: 0,
      publishedAt: null,
    },
    {
      id: 'mock-home-announcement-2',
      title: '平台公告示例：如何发布公告',
      content: '后台路径：系统设置 > 首页公告，可创建草稿并发布。',
      tag: null,
      linkUrl: null,
      pinned: false,
      order: 1,
      publishedAt: null,
    },
  ];
}

export async function fetchHomeAnnouncements(options?: {
  max?: number;
  allowMock?: boolean;
}): Promise<PublicHomeAnnouncementItem[]> {
  const max = options?.max ?? HOME_ANNOUNCEMENTS_MAX;
  const allowMock = options?.allowMock ?? true;
  const feed = await apiGet<PublicHomeAnnouncementFeed>('/public/config/home-announcements');
  const next = Array.isArray(feed?.items) ? feed.items.slice(0, max) : [];
  if (next.length) return next;
  if (!allowMock || IS_PROD_DEPLOY) return [];
  return mockAnnouncements();
}
